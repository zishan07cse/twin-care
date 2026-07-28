
CREATE TYPE public.lead_stage AS ENUM ('new','contacted','qualified','proposal','converted','lost');
CREATE TYPE public.lead_source AS ENUM ('walk_in','phone','whatsapp','facebook','instagram','website','referral','doctor','event','other');

CREATE TABLE public.leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  phone text NOT NULL,
  email text,
  age integer,
  gender text,
  city text,
  source public.lead_source NOT NULL DEFAULT 'other',
  source_detail text,
  referrer_doctor_id uuid REFERENCES public.doctors(id),
  stage public.lead_stage NOT NULL DEFAULT 'new',
  assigned_to uuid REFERENCES auth.users(id),
  interest_summary text,
  next_follow_up_at timestamptz,
  lost_reason text,
  converted_patient_id uuid REFERENCES public.patients(id),
  converted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

CREATE INDEX idx_leads_stage ON public.leads(stage);
CREATE INDEX idx_leads_assigned ON public.leads(assigned_to);
CREATE INDEX idx_leads_next_followup ON public.leads(next_follow_up_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.leads TO authenticated;
GRANT ALL ON public.leads TO service_role;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view leads" ON public.leads
FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Staff can insert leads" ON public.leads
FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Staff can update leads" ON public.leads
FOR UPDATE TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Admin can delete leads" ON public.leads
FOR DELETE TO authenticated
USING (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_leads_updated
BEFORE UPDATE ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.lead_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  note text NOT NULL,
  activity_type text NOT NULL DEFAULT 'note',
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

CREATE INDEX idx_lead_notes_lead ON public.lead_notes(lead_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_notes TO authenticated;
GRANT ALL ON public.lead_notes TO service_role;
ALTER TABLE public.lead_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view lead notes" ON public.lead_notes
FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Staff can insert lead notes" ON public.lead_notes
FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Admin can delete lead notes" ON public.lead_notes
FOR DELETE TO authenticated
USING (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin'));

-- Log stage changes to lead_notes automatically
CREATE OR REPLACE FUNCTION public.tg_leads_log_stage()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.stage IS DISTINCT FROM OLD.stage THEN
    INSERT INTO public.lead_notes (lead_id, note, activity_type, created_by)
    VALUES (NEW.id, 'Stage: ' || OLD.stage::text || ' → ' || NEW.stage::text, 'stage_change', NEW.assigned_to);
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.tg_leads_log_stage() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_leads_log_stage
AFTER UPDATE ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.tg_leads_log_stage();
