
DROP POLICY "Staff update prescriptions" ON public.prescriptions;
CREATE POLICY "Staff update prescriptions" ON public.prescriptions FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid()) OR public.has_role(auth.uid(),'doctor'))
  WITH CHECK (public.is_staff(auth.uid()) OR public.has_role(auth.uid(),'doctor'));

DROP POLICY "Staff update diet plans" ON public.diet_plans;
CREATE POLICY "Staff update diet plans" ON public.diet_plans FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid()) OR public.has_role(auth.uid(),'nutritionist'))
  WITH CHECK (public.is_staff(auth.uid()) OR public.has_role(auth.uid(),'nutritionist'));

DROP POLICY "Staff update med reductions" ON public.medication_reductions;
CREATE POLICY "Staff update med reductions" ON public.medication_reductions FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid()) OR public.has_role(auth.uid(),'doctor'))
  WITH CHECK (public.is_staff(auth.uid()) OR public.has_role(auth.uid(),'doctor'));
