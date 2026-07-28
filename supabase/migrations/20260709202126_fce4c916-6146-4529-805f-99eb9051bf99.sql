
-- Lab test catalog
CREATE TABLE public.lab_tests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text,
  unit text,
  reference_low numeric,
  reference_high numeric,
  reference_text text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lab_tests TO authenticated;
GRANT ALL ON public.lab_tests TO service_role;
ALTER TABLE public.lab_tests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Clinical view lab tests" ON public.lab_tests FOR SELECT TO authenticated USING (public.is_staff(auth.uid()) OR public.has_role(auth.uid(),'doctor') OR public.has_role(auth.uid(),'nutritionist'));
CREATE POLICY "Staff insert lab tests" ON public.lab_tests FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Staff update lab tests" ON public.lab_tests FOR UPDATE TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Admins delete lab tests" ON public.lab_tests FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_lab_tests_updated BEFORE UPDATE ON public.lab_tests FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Lab results
CREATE TABLE public.lab_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  test_id uuid REFERENCES public.lab_tests(id),
  test_name text NOT NULL,
  value_numeric numeric,
  value_text text,
  unit text,
  performed_on date NOT NULL DEFAULT current_date,
  lab_name text,
  file_url text,
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lab_results TO authenticated;
GRANT ALL ON public.lab_results TO service_role;
ALTER TABLE public.lab_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Clinical view lab results" ON public.lab_results FOR SELECT TO authenticated USING (public.is_staff(auth.uid()) OR public.has_role(auth.uid(),'doctor') OR public.has_role(auth.uid(),'nutritionist'));
CREATE POLICY "Clinical insert lab results" ON public.lab_results FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()) OR public.has_role(auth.uid(),'doctor') OR public.has_role(auth.uid(),'nutritionist'));
CREATE POLICY "Clinical update lab results" ON public.lab_results FOR UPDATE TO authenticated USING (public.is_staff(auth.uid()) OR public.has_role(auth.uid(),'doctor')) WITH CHECK (public.is_staff(auth.uid()) OR public.has_role(auth.uid(),'doctor'));
CREATE POLICY "Admins delete lab results" ON public.lab_results FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin'));

-- Vitals / measurements
CREATE TABLE public.vitals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  recorded_on date NOT NULL DEFAULT current_date,
  weight_kg numeric(6,2),
  height_cm numeric(6,2),
  waist_cm numeric(6,2),
  bp_systolic int,
  bp_diastolic int,
  pulse_bpm int,
  fasting_glucose numeric(6,2),
  post_meal_glucose numeric(6,2),
  hba1c numeric(4,2),
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vitals TO authenticated;
GRANT ALL ON public.vitals TO service_role;
ALTER TABLE public.vitals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Clinical view vitals" ON public.vitals FOR SELECT TO authenticated USING (public.is_staff(auth.uid()) OR public.has_role(auth.uid(),'doctor') OR public.has_role(auth.uid(),'nutritionist'));
CREATE POLICY "Clinical insert vitals" ON public.vitals FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()) OR public.has_role(auth.uid(),'doctor') OR public.has_role(auth.uid(),'nutritionist'));
CREATE POLICY "Clinical update vitals" ON public.vitals FOR UPDATE TO authenticated USING (public.is_staff(auth.uid()) OR public.has_role(auth.uid(),'doctor')) WITH CHECK (public.is_staff(auth.uid()) OR public.has_role(auth.uid(),'doctor'));
CREATE POLICY "Admins delete vitals" ON public.vitals FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin'));

-- Timeline triggers
CREATE OR REPLACE FUNCTION public.tg_lab_results_timeline()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  INSERT INTO public.patient_timeline (patient_id, event_type, title, description, created_by)
  VALUES (NEW.patient_id, 'lab_result',
    'Lab: ' || NEW.test_name,
    coalesce(NEW.value_text, NEW.value_numeric::text, '') || coalesce(' ' || NEW.unit, ''),
    NEW.created_by);
  RETURN NEW;
END;$$;
CREATE TRIGGER trg_lab_results_timeline AFTER INSERT ON public.lab_results FOR EACH ROW EXECUTE FUNCTION public.tg_lab_results_timeline();
REVOKE EXECUTE ON FUNCTION public.tg_lab_results_timeline() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.tg_vitals_timeline()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  parts text[] := ARRAY[]::text[];
BEGIN
  IF NEW.weight_kg IS NOT NULL THEN parts := array_append(parts, 'Wt ' || NEW.weight_kg || 'kg'); END IF;
  IF NEW.bp_systolic IS NOT NULL AND NEW.bp_diastolic IS NOT NULL THEN parts := array_append(parts, 'BP ' || NEW.bp_systolic || '/' || NEW.bp_diastolic); END IF;
  IF NEW.hba1c IS NOT NULL THEN parts := array_append(parts, 'HbA1c ' || NEW.hba1c || '%'); END IF;
  IF NEW.fasting_glucose IS NOT NULL THEN parts := array_append(parts, 'FBS ' || NEW.fasting_glucose); END IF;
  INSERT INTO public.patient_timeline (patient_id, event_type, title, description, created_by)
  VALUES (NEW.patient_id, 'vitals', 'Vitals recorded', array_to_string(parts, ' · '), NEW.created_by);
  RETURN NEW;
END;$$;
CREATE TRIGGER trg_vitals_timeline AFTER INSERT ON public.vitals FOR EACH ROW EXECUTE FUNCTION public.tg_vitals_timeline();
REVOKE EXECUTE ON FUNCTION public.tg_vitals_timeline() FROM PUBLIC, anon, authenticated;

CREATE INDEX idx_lab_results_patient ON public.lab_results(patient_id, performed_on DESC);
CREATE INDEX idx_vitals_patient ON public.vitals(patient_id, recorded_on DESC);
