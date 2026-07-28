
-- Enums
CREATE TYPE public.enrollment_status AS ENUM ('active','completed','cancelled','paused');
CREATE TYPE public.schedule_status AS ENUM ('pending','paid','overdue','waived','partial');
CREATE TYPE public.payment_method AS ENUM ('cash','bkash','nagad','card','bank_transfer','cheque','other');
CREATE TYPE public.billing_frequency AS ENUM ('one_time','monthly','quarterly','custom');

-- Program plans
CREATE TABLE public.program_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  name_bn text,
  description text,
  duration_months int NOT NULL DEFAULT 12,
  total_price_bdt numeric(12,2) NOT NULL,
  billing_frequency billing_frequency NOT NULL DEFAULT 'monthly',
  installment_count int,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.program_plans TO authenticated;
GRANT ALL ON public.program_plans TO service_role;
ALTER TABLE public.program_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff view plans" ON public.program_plans
  FOR SELECT TO authenticated USING (
    public.is_staff(auth.uid()) OR public.has_role(auth.uid(),'finance')
  );
CREATE POLICY "Staff insert plans" ON public.program_plans
  FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Staff update plans" ON public.program_plans
  FOR UPDATE TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Admin delete plans" ON public.program_plans
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin'));

CREATE TRIGGER program_plans_set_updated_at
  BEFORE UPDATE ON public.program_plans
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Patient enrollments
CREATE TABLE public.patient_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES public.program_plans(id) ON DELETE RESTRICT,
  start_date date NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Dhaka')::date,
  end_date date,
  total_amount_bdt numeric(12,2) NOT NULL,
  discount_bdt numeric(12,2) NOT NULL DEFAULT 0,
  net_amount_bdt numeric(12,2) NOT NULL,
  status enrollment_status NOT NULL DEFAULT 'active',
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_enrollments_patient ON public.patient_enrollments(patient_id);
CREATE INDEX idx_enrollments_status ON public.patient_enrollments(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.patient_enrollments TO authenticated;
GRANT ALL ON public.patient_enrollments TO service_role;
ALTER TABLE public.patient_enrollments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff+finance view enrollments" ON public.patient_enrollments
  FOR SELECT TO authenticated USING (
    public.is_staff(auth.uid()) OR public.has_role(auth.uid(),'finance')
  );
CREATE POLICY "Staff+finance insert enrollments" ON public.patient_enrollments
  FOR INSERT TO authenticated WITH CHECK (
    public.is_staff(auth.uid()) OR public.has_role(auth.uid(),'finance')
  );
CREATE POLICY "Staff+finance update enrollments" ON public.patient_enrollments
  FOR UPDATE TO authenticated USING (
    public.is_staff(auth.uid()) OR public.has_role(auth.uid(),'finance')
  ) WITH CHECK (
    public.is_staff(auth.uid()) OR public.has_role(auth.uid(),'finance')
  );
CREATE POLICY "Admin delete enrollments" ON public.patient_enrollments
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin'));

CREATE TRIGGER enrollments_set_updated_at
  BEFORE UPDATE ON public.patient_enrollments
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Payment schedule (installments)
CREATE TABLE public.payment_schedule (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id uuid NOT NULL REFERENCES public.patient_enrollments(id) ON DELETE CASCADE,
  installment_no int NOT NULL,
  due_date date NOT NULL,
  amount_bdt numeric(12,2) NOT NULL,
  paid_amount_bdt numeric(12,2) NOT NULL DEFAULT 0,
  status schedule_status NOT NULL DEFAULT 'pending',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (enrollment_id, installment_no)
);

CREATE INDEX idx_schedule_enrollment ON public.payment_schedule(enrollment_id);
CREATE INDEX idx_schedule_due ON public.payment_schedule(due_date, status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_schedule TO authenticated;
GRANT ALL ON public.payment_schedule TO service_role;
ALTER TABLE public.payment_schedule ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff+finance view schedule" ON public.payment_schedule
  FOR SELECT TO authenticated USING (
    public.is_staff(auth.uid()) OR public.has_role(auth.uid(),'finance')
  );
CREATE POLICY "Staff+finance manage schedule" ON public.payment_schedule
  FOR ALL TO authenticated USING (
    public.is_staff(auth.uid()) OR public.has_role(auth.uid(),'finance')
  ) WITH CHECK (
    public.is_staff(auth.uid()) OR public.has_role(auth.uid(),'finance')
  );

CREATE TRIGGER schedule_set_updated_at
  BEFORE UPDATE ON public.payment_schedule
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Payments (transactions)
CREATE SEQUENCE IF NOT EXISTS public.receipt_seq START 1;

CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_no text UNIQUE NOT NULL,
  enrollment_id uuid NOT NULL REFERENCES public.patient_enrollments(id) ON DELETE RESTRICT,
  schedule_id uuid REFERENCES public.payment_schedule(id) ON DELETE SET NULL,
  amount_bdt numeric(12,2) NOT NULL CHECK (amount_bdt > 0),
  method payment_method NOT NULL,
  reference text,
  paid_on date NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Dhaka')::date,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_payments_enrollment ON public.payments(enrollment_id);
CREATE INDEX idx_payments_paid_on ON public.payments(paid_on DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff+finance view payments" ON public.payments
  FOR SELECT TO authenticated USING (
    public.is_staff(auth.uid()) OR public.has_role(auth.uid(),'finance')
  );
CREATE POLICY "Staff+finance insert payments" ON public.payments
  FOR INSERT TO authenticated WITH CHECK (
    public.is_staff(auth.uid()) OR public.has_role(auth.uid(),'finance')
  );
CREATE POLICY "Staff+finance update payments" ON public.payments
  FOR UPDATE TO authenticated USING (
    public.is_staff(auth.uid()) OR public.has_role(auth.uid(),'finance')
  ) WITH CHECK (
    public.is_staff(auth.uid()) OR public.has_role(auth.uid(),'finance')
  );
CREATE POLICY "Admin delete payments" ON public.payments
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin'));

CREATE TRIGGER payments_set_updated_at
  BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Auto receipt number: RCP-YYYY-000001
CREATE OR REPLACE FUNCTION public.tg_payments_set_receipt()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_year text;
BEGIN
  IF NEW.receipt_no IS NULL OR NEW.receipt_no = '' THEN
    v_year := to_char((now() AT TIME ZONE 'Asia/Dhaka'), 'YYYY');
    NEW.receipt_no := 'RCP-' || v_year || '-' || lpad(nextval('public.receipt_seq')::text, 6, '0');
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.tg_payments_set_receipt() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER payments_set_receipt
  BEFORE INSERT ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.tg_payments_set_receipt();

-- After payment insert/update: update linked schedule item + timeline
CREATE OR REPLACE FUNCTION public.tg_payments_apply()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_patient uuid;
  v_sched public.payment_schedule%ROWTYPE;
BEGIN
  SELECT patient_id INTO v_patient FROM public.patient_enrollments WHERE id = NEW.enrollment_id;

  IF NEW.schedule_id IS NOT NULL THEN
    SELECT * INTO v_sched FROM public.payment_schedule WHERE id = NEW.schedule_id FOR UPDATE;
    IF FOUND THEN
      UPDATE public.payment_schedule
      SET paid_amount_bdt = paid_amount_bdt + NEW.amount_bdt,
          status = CASE
            WHEN paid_amount_bdt + NEW.amount_bdt >= amount_bdt THEN 'paid'::schedule_status
            ELSE 'partial'::schedule_status
          END
      WHERE id = NEW.schedule_id;
    END IF;
  END IF;

  INSERT INTO public.patient_timeline (patient_id, event_type, title, description, created_by)
  VALUES (
    v_patient,
    'payment',
    'Payment received: ৳' || NEW.amount_bdt::text,
    'Receipt ' || NEW.receipt_no || ' via ' || NEW.method::text,
    NEW.created_by
  );
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.tg_payments_apply() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER payments_apply_after_insert
  AFTER INSERT ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.tg_payments_apply();
