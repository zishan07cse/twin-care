
CREATE TYPE public.appointment_mode AS ENUM ('in_person','tele','phone');
CREATE TYPE public.appointment_status AS ENUM ('scheduled','completed','missed','cancelled','rescheduled');
CREATE TYPE public.provider_kind AS ENUM ('doctor','nutritionist','coordinator');

CREATE TABLE public.appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  provider_kind public.provider_kind NOT NULL,
  doctor_id uuid REFERENCES public.doctors(id),
  nutritionist_id uuid REFERENCES public.nutritionists(id),
  coordinator_user_id uuid REFERENCES auth.users(id),
  scheduled_at timestamptz NOT NULL,
  duration_minutes integer NOT NULL DEFAULT 30 CHECK (duration_minutes > 0),
  mode public.appointment_mode NOT NULL DEFAULT 'in_person',
  location text,
  meeting_link text,
  reason text,
  notes text,
  status public.appointment_status NOT NULL DEFAULT 'scheduled',
  completed_at timestamptz,
  reminder_sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

CREATE INDEX idx_appointments_scheduled_at ON public.appointments(scheduled_at);
CREATE INDEX idx_appointments_patient ON public.appointments(patient_id);
CREATE INDEX idx_appointments_doctor ON public.appointments(doctor_id);
CREATE INDEX idx_appointments_nutritionist ON public.appointments(nutritionist_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.appointments TO authenticated;
GRANT ALL ON public.appointments TO service_role;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view appointments" ON public.appointments
FOR SELECT TO authenticated
USING (
  public.is_staff(auth.uid())
  OR public.has_role(auth.uid(),'doctor')
  OR public.has_role(auth.uid(),'nutritionist')
);

CREATE POLICY "Staff can insert appointments" ON public.appointments
FOR INSERT TO authenticated
WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "Staff can update appointments" ON public.appointments
FOR UPDATE TO authenticated
USING (public.is_staff(auth.uid()));

CREATE POLICY "Admin can delete appointments" ON public.appointments
FOR DELETE TO authenticated
USING (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_appointments_updated
BEFORE UPDATE ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Log appointment lifecycle on patient timeline
CREATE OR REPLACE FUNCTION public.tg_appointments_timeline()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.patient_timeline (patient_id, event_type, title, description, created_by)
    VALUES (NEW.patient_id, 'appointment',
      'Appointment scheduled',
      to_char(NEW.scheduled_at AT TIME ZONE 'Asia/Dhaka','DD Mon YYYY, HH24:MI') || ' · ' || NEW.provider_kind::text,
      NEW.created_by);
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.patient_timeline (patient_id, event_type, title, description)
    VALUES (NEW.patient_id, 'appointment',
      'Appointment ' || NEW.status::text,
      to_char(NEW.scheduled_at AT TIME ZONE 'Asia/Dhaka','DD Mon YYYY, HH24:MI'));
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.tg_appointments_timeline() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_appointments_timeline
AFTER INSERT OR UPDATE ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.tg_appointments_timeline();
