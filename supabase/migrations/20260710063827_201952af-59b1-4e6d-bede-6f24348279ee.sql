CREATE OR REPLACE FUNCTION public.tg_enrollments_accrue_commission()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_patient public.patients%ROWTYPE;
  v_doctor public.doctors%ROWTYPE;
  v_amount numeric := 0;
  v_pct numeric;
BEGIN
  SELECT * INTO v_patient FROM public.patients WHERE id = NEW.patient_id;
  IF v_patient.referring_doctor_id IS NOT NULL THEN
    SELECT * INTO v_doctor FROM public.doctors WHERE id = v_patient.referring_doctor_id;
    v_pct := v_doctor.referral_commission_pct;
    IF v_pct IS NOT NULL AND v_pct > 0 THEN
      v_amount := (COALESCE(NEW.net_amount_bdt, NEW.total_price_bdt, 0) * v_pct) / 100.0;
      IF v_amount > 0 THEN
        INSERT INTO public.referral_commissions(patient_id, enrollment_id, referrer_kind, doctor_id, basis, amount_bdt, percent)
        VALUES (NEW.patient_id, NEW.id, 'doctor', v_doctor.id, 'percent', v_amount, v_pct);
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;