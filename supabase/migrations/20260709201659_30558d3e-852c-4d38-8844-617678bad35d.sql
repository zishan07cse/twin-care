
-- Medicines master catalog
CREATE TABLE public.medicines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  generic_name text,
  strength text,
  form text, -- tablet, capsule, syrup, injection
  manufacturer text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.medicines TO authenticated;
GRANT ALL ON public.medicines TO service_role;
ALTER TABLE public.medicines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff view medicines" ON public.medicines FOR SELECT TO authenticated USING (public.is_staff(auth.uid()) OR public.has_role(auth.uid(),'doctor') OR public.has_role(auth.uid(),'nutritionist'));
CREATE POLICY "Staff manage medicines" ON public.medicines FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Staff update medicines" ON public.medicines FOR UPDATE TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Admins delete medicines" ON public.medicines FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_medicines_updated BEFORE UPDATE ON public.medicines FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Prescriptions
CREATE TABLE public.prescriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  doctor_id uuid REFERENCES public.doctors(id),
  appointment_id uuid REFERENCES public.appointments(id),
  issued_at timestamptz NOT NULL DEFAULT now(),
  diagnosis text,
  advice text,
  follow_up_at timestamptz,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prescriptions TO authenticated;
GRANT ALL ON public.prescriptions TO service_role;
ALTER TABLE public.prescriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff view prescriptions" ON public.prescriptions FOR SELECT TO authenticated USING (public.is_staff(auth.uid()) OR public.has_role(auth.uid(),'doctor') OR public.has_role(auth.uid(),'nutritionist'));
CREATE POLICY "Staff insert prescriptions" ON public.prescriptions FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()) OR public.has_role(auth.uid(),'doctor'));
CREATE POLICY "Staff update prescriptions" ON public.prescriptions FOR UPDATE TO authenticated USING (public.is_staff(auth.uid()) OR public.has_role(auth.uid(),'doctor')) WITH CHECK (true);
CREATE POLICY "Admins delete prescriptions" ON public.prescriptions FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_prescriptions_updated BEFORE UPDATE ON public.prescriptions FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Prescription items
CREATE TABLE public.prescription_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prescription_id uuid NOT NULL REFERENCES public.prescriptions(id) ON DELETE CASCADE,
  medicine_id uuid REFERENCES public.medicines(id),
  medicine_name text NOT NULL,
  dose text,
  frequency text,
  duration text,
  instructions text,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prescription_items TO authenticated;
GRANT ALL ON public.prescription_items TO service_role;
ALTER TABLE public.prescription_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff view rx items" ON public.prescription_items FOR SELECT TO authenticated USING (public.is_staff(auth.uid()) OR public.has_role(auth.uid(),'doctor') OR public.has_role(auth.uid(),'nutritionist'));
CREATE POLICY "Staff manage rx items" ON public.prescription_items FOR ALL TO authenticated USING (public.is_staff(auth.uid()) OR public.has_role(auth.uid(),'doctor')) WITH CHECK (public.is_staff(auth.uid()) OR public.has_role(auth.uid(),'doctor'));

-- Diet plans
CREATE TABLE public.diet_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  nutritionist_id uuid REFERENCES public.nutritionists(id),
  title text NOT NULL,
  start_date date NOT NULL DEFAULT current_date,
  end_date date,
  daily_calories int,
  notes text,
  meals jsonb NOT NULL DEFAULT '[]'::jsonb, -- [{meal:"breakfast", items:[], time:"08:00"}]
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.diet_plans TO authenticated;
GRANT ALL ON public.diet_plans TO service_role;
ALTER TABLE public.diet_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff view diet plans" ON public.diet_plans FOR SELECT TO authenticated USING (public.is_staff(auth.uid()) OR public.has_role(auth.uid(),'nutritionist') OR public.has_role(auth.uid(),'doctor'));
CREATE POLICY "Staff manage diet plans" ON public.diet_plans FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()) OR public.has_role(auth.uid(),'nutritionist'));
CREATE POLICY "Staff update diet plans" ON public.diet_plans FOR UPDATE TO authenticated USING (public.is_staff(auth.uid()) OR public.has_role(auth.uid(),'nutritionist')) WITH CHECK (true);
CREATE POLICY "Admins delete diet plans" ON public.diet_plans FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_diet_plans_updated BEFORE UPDATE ON public.diet_plans FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Medication reduction tracker
CREATE TABLE public.medication_reductions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  medicine_id uuid REFERENCES public.medicines(id),
  medicine_name text NOT NULL,
  baseline_dose text,
  current_dose text,
  recorded_on date NOT NULL DEFAULT current_date,
  reduction_percent numeric(5,2),
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.medication_reductions TO authenticated;
GRANT ALL ON public.medication_reductions TO service_role;
ALTER TABLE public.medication_reductions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff view med reductions" ON public.medication_reductions FOR SELECT TO authenticated USING (public.is_staff(auth.uid()) OR public.has_role(auth.uid(),'doctor') OR public.has_role(auth.uid(),'nutritionist'));
CREATE POLICY "Staff manage med reductions" ON public.medication_reductions FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()) OR public.has_role(auth.uid(),'doctor'));
CREATE POLICY "Staff update med reductions" ON public.medication_reductions FOR UPDATE TO authenticated USING (public.is_staff(auth.uid()) OR public.has_role(auth.uid(),'doctor')) WITH CHECK (true);
CREATE POLICY "Admins delete med reductions" ON public.medication_reductions FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin'));

-- Timeline triggers
CREATE OR REPLACE FUNCTION public.tg_prescriptions_timeline()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  INSERT INTO public.patient_timeline (patient_id, event_type, title, description, created_by)
  VALUES (NEW.patient_id, 'prescription', 'Prescription issued', coalesce(NEW.diagnosis,'New prescription'), NEW.created_by);
  RETURN NEW;
END;$$;
CREATE TRIGGER trg_prescriptions_timeline AFTER INSERT ON public.prescriptions FOR EACH ROW EXECUTE FUNCTION public.tg_prescriptions_timeline();
REVOKE EXECUTE ON FUNCTION public.tg_prescriptions_timeline() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.tg_diet_plans_timeline()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  INSERT INTO public.patient_timeline (patient_id, event_type, title, description, created_by)
  VALUES (NEW.patient_id, 'diet_plan', 'Diet plan created', NEW.title, NEW.created_by);
  RETURN NEW;
END;$$;
CREATE TRIGGER trg_diet_plans_timeline AFTER INSERT ON public.diet_plans FOR EACH ROW EXECUTE FUNCTION public.tg_diet_plans_timeline();
REVOKE EXECUTE ON FUNCTION public.tg_diet_plans_timeline() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.tg_med_reductions_timeline()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  INSERT INTO public.patient_timeline (patient_id, event_type, title, description, created_by)
  VALUES (NEW.patient_id, 'med_reduction',
    'Medication updated: ' || NEW.medicine_name,
    coalesce('From ' || NEW.baseline_dose || ' to ' || NEW.current_dose, NEW.current_dose),
    NEW.created_by);
  RETURN NEW;
END;$$;
CREATE TRIGGER trg_med_reductions_timeline AFTER INSERT ON public.medication_reductions FOR EACH ROW EXECUTE FUNCTION public.tg_med_reductions_timeline();
REVOKE EXECUTE ON FUNCTION public.tg_med_reductions_timeline() FROM PUBLIC, anon, authenticated;

CREATE INDEX idx_prescriptions_patient ON public.prescriptions(patient_id, issued_at DESC);
CREATE INDEX idx_rx_items_rx ON public.prescription_items(prescription_id);
CREATE INDEX idx_diet_plans_patient ON public.diet_plans(patient_id, start_date DESC);
CREATE INDEX idx_med_reductions_patient ON public.medication_reductions(patient_id, recorded_on DESC);
