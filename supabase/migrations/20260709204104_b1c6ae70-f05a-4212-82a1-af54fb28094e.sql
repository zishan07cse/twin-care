
-- 1) Link
ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS patients_user_id_key ON public.patients(user_id) WHERE user_id IS NOT NULL;

-- 2) Helper: current patient id for auth.uid()
CREATE OR REPLACE FUNCTION public.current_patient_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.patients WHERE user_id = auth.uid() LIMIT 1
$$;

-- 3) Self-read policies (idempotent-ish: drop then create)
DROP POLICY IF EXISTS "Patients can view own record" ON public.patients;
CREATE POLICY "Patients can view own record" ON public.patients
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Patients can view own timeline" ON public.patient_timeline;
CREATE POLICY "Patients can view own timeline" ON public.patient_timeline
  FOR SELECT TO authenticated
  USING (patient_id = public.current_patient_id());

DROP POLICY IF EXISTS "Patients can view own appointments" ON public.appointments;
CREATE POLICY "Patients can view own appointments" ON public.appointments
  FOR SELECT TO authenticated
  USING (patient_id = public.current_patient_id());

DROP POLICY IF EXISTS "Patients can view own prescriptions" ON public.prescriptions;
CREATE POLICY "Patients can view own prescriptions" ON public.prescriptions
  FOR SELECT TO authenticated
  USING (patient_id = public.current_patient_id());

DROP POLICY IF EXISTS "Patients can view own prescription items" ON public.prescription_items;
CREATE POLICY "Patients can view own prescription items" ON public.prescription_items
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.prescriptions p
    WHERE p.id = prescription_items.prescription_id
      AND p.patient_id = public.current_patient_id()
  ));

DROP POLICY IF EXISTS "Patients can view own diet plans" ON public.diet_plans;
CREATE POLICY "Patients can view own diet plans" ON public.diet_plans
  FOR SELECT TO authenticated
  USING (patient_id = public.current_patient_id());

DROP POLICY IF EXISTS "Patients can view own lab results" ON public.lab_results;
CREATE POLICY "Patients can view own lab results" ON public.lab_results
  FOR SELECT TO authenticated
  USING (patient_id = public.current_patient_id());

DROP POLICY IF EXISTS "Patients can view own vitals" ON public.vitals;
CREATE POLICY "Patients can view own vitals" ON public.vitals
  FOR SELECT TO authenticated
  USING (patient_id = public.current_patient_id());

DROP POLICY IF EXISTS "Patients can view own enrollments" ON public.patient_enrollments;
CREATE POLICY "Patients can view own enrollments" ON public.patient_enrollments
  FOR SELECT TO authenticated
  USING (patient_id = public.current_patient_id());

DROP POLICY IF EXISTS "Patients can view own schedule" ON public.payment_schedule;
CREATE POLICY "Patients can view own schedule" ON public.payment_schedule
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.patient_enrollments e
    WHERE e.id = payment_schedule.enrollment_id
      AND e.patient_id = public.current_patient_id()
  ));

DROP POLICY IF EXISTS "Patients can view own payments" ON public.payments;
CREATE POLICY "Patients can view own payments" ON public.payments
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.patient_enrollments e
    WHERE e.id = payments.enrollment_id
      AND e.patient_id = public.current_patient_id()
  ));

DROP POLICY IF EXISTS "Patients can view own inventory" ON public.inventory_assignments;
CREATE POLICY "Patients can view own inventory" ON public.inventory_assignments
  FOR SELECT TO authenticated
  USING (patient_id = public.current_patient_id());
