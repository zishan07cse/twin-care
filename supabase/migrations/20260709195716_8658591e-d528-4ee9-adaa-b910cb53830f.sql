
-- Enums
CREATE TYPE public.patient_status AS ENUM ('active','paused','completed','dropped');
CREATE TYPE public.gender AS ENUM ('male','female','other');

-- Patients table
CREATE TABLE public.patients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_code text UNIQUE NOT NULL,
  full_name text NOT NULL,
  full_name_bn text,
  phone text NOT NULL,
  alt_phone text,
  email text,
  gender gender,
  date_of_birth date,
  address text,
  city text,
  nid text,
  emergency_contact_name text,
  emergency_contact_phone text,
  preferred_language text NOT NULL DEFAULT 'en',
  status patient_status NOT NULL DEFAULT 'active',
  enrolled_on date NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Dhaka')::date,
  -- Medical baseline
  height_cm numeric(5,2),
  weight_kg numeric(5,2),
  hba1c_baseline numeric(4,2),
  fbg_baseline numeric(6,2),
  ppbg_baseline numeric(6,2),
  bp_systolic_baseline int,
  bp_diastolic_baseline int,
  diabetes_years int,
  comorbidities text[],
  current_medications text,
  allergies text,
  -- Assignments
  referring_doctor_id uuid REFERENCES public.doctors(id) ON DELETE SET NULL,
  treating_doctor_id uuid REFERENCES public.doctors(id) ON DELETE SET NULL,
  nutritionist_id uuid REFERENCES public.nutritionists(id) ON DELETE SET NULL,
  hospital_id uuid REFERENCES public.hospitals(id) ON DELETE SET NULL,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_patients_status ON public.patients(status);
CREATE INDEX idx_patients_phone ON public.patients(phone);
CREATE INDEX idx_patients_treating_doctor ON public.patients(treating_doctor_id);
CREATE INDEX idx_patients_nutritionist ON public.patients(nutritionist_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.patients TO authenticated;
GRANT ALL ON public.patients TO service_role;

ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view all patients" ON public.patients
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Staff can insert patients" ON public.patients
  FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Staff can update patients" ON public.patients
  FOR UPDATE TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Admins can delete patients" ON public.patients
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin'));

CREATE TRIGGER patients_set_updated_at
  BEFORE UPDATE ON public.patients
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Auto-generate patient code EXP-YYYY-0001
CREATE SEQUENCE IF NOT EXISTS public.patient_code_seq START 1;

CREATE OR REPLACE FUNCTION public.tg_patients_set_code()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_year text;
  v_num int;
BEGIN
  IF NEW.patient_code IS NULL OR NEW.patient_code = '' THEN
    v_year := to_char((now() AT TIME ZONE 'Asia/Dhaka'), 'YYYY');
    v_num := nextval('public.patient_code_seq');
    NEW.patient_code := 'EXP-' || v_year || '-' || lpad(v_num::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER patients_set_code
  BEFORE INSERT ON public.patients
  FOR EACH ROW EXECUTE FUNCTION public.tg_patients_set_code();

-- Patient timeline / activity log
CREATE TABLE public.patient_timeline (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  title text NOT NULL,
  description text,
  metadata jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_timeline_patient ON public.patient_timeline(patient_id, created_at DESC);

GRANT SELECT, INSERT ON public.patient_timeline TO authenticated;
GRANT ALL ON public.patient_timeline TO service_role;

ALTER TABLE public.patient_timeline ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view timeline" ON public.patient_timeline
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Staff can add timeline" ON public.patient_timeline
  FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));

-- Auto-timeline: on patient create
CREATE OR REPLACE FUNCTION public.tg_patients_timeline_insert()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  INSERT INTO public.patient_timeline (patient_id, event_type, title, description, created_by)
  VALUES (NEW.id, 'enrollment', 'Patient enrolled', 'Patient ' || NEW.patient_code || ' enrolled in program.', NEW.created_by);
  RETURN NEW;
END;
$$;

CREATE TRIGGER patients_timeline_insert
  AFTER INSERT ON public.patients
  FOR EACH ROW EXECUTE FUNCTION public.tg_patients_timeline_insert();

-- Auto-timeline: on status change
CREATE OR REPLACE FUNCTION public.tg_patients_timeline_status()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.patient_timeline (patient_id, event_type, title, description)
    VALUES (NEW.id, 'status_change', 'Status changed', 'Status: ' || OLD.status::text || ' → ' || NEW.status::text);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER patients_timeline_status
  AFTER UPDATE ON public.patients
  FOR EACH ROW EXECUTE FUNCTION public.tg_patients_timeline_status();
