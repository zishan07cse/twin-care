
-- =========================
-- NOTIFICATION ENGINE
-- =========================
CREATE TYPE public.notif_event_type AS ENUM (
  'sensor_change','doctor_consult','nutritionist_consult','lab_test',
  'payment_due','program_renewal','device_return','medicine_review','custom'
);
CREATE TYPE public.notif_channel AS ENUM ('in_app','whatsapp','email');
CREATE TYPE public.notif_status AS ENUM ('pending','sent','failed','skipped','read');

CREATE TABLE public.notification_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type public.notif_event_type NOT NULL,
  offsets_days int[] NOT NULL DEFAULT '{}',
  channels public.notif_channel[] NOT NULL DEFAULT '{in_app}',
  template_key text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_rules TO authenticated;
GRANT ALL ON public.notification_rules TO service_role;
ALTER TABLE public.notification_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read rules" ON public.notification_rules FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "admin write rules" ON public.notification_rules FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_notification_rules_updated BEFORE UPDATE ON public.notification_rules FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.notification_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key text NOT NULL,
  event_type public.notif_event_type NOT NULL,
  channel public.notif_channel NOT NULL,
  language text NOT NULL DEFAULT 'en',
  subject text,
  body text NOT NULL,
  wati_template_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (template_key, channel, language)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_templates TO authenticated;
GRANT ALL ON public.notification_templates TO service_role;
ALTER TABLE public.notification_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read templates" ON public.notification_templates FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "admin write templates" ON public.notification_templates FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_notification_templates_updated BEFORE UPDATE ON public.notification_templates FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.notification_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  whatsapp_enabled boolean NOT NULL DEFAULT true,
  email_enabled boolean NOT NULL DEFAULT true,
  in_app_enabled boolean NOT NULL DEFAULT true,
  preferred_language text NOT NULL DEFAULT 'en',
  quiet_start_hour int NOT NULL DEFAULT 22,
  quiet_end_hour int NOT NULL DEFAULT 8,
  disabled_event_types public.notif_event_type[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (patient_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_preferences TO authenticated;
GRANT ALL ON public.notification_preferences TO service_role;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff manage prefs" ON public.notification_preferences FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "patient view own prefs" ON public.notification_preferences FOR SELECT TO authenticated
  USING (patient_id = public.current_patient_id());
CREATE POLICY "patient update own prefs" ON public.notification_preferences FOR UPDATE TO authenticated
  USING (patient_id = public.current_patient_id()) WITH CHECK (patient_id = public.current_patient_id());
CREATE TRIGGER trg_notification_prefs_updated BEFORE UPDATE ON public.notification_preferences FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid REFERENCES public.patients(id) ON DELETE CASCADE,
  user_id uuid,
  event_type public.notif_event_type NOT NULL,
  channel public.notif_channel NOT NULL DEFAULT 'in_app',
  title text NOT NULL,
  body text,
  ref_table text,
  ref_id uuid,
  scheduled_for timestamptz,
  sent_at timestamptz,
  read_at timestamptz,
  status public.notif_status NOT NULL DEFAULT 'pending',
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.notifications (patient_id, created_at DESC);
CREATE INDEX ON public.notifications (user_id, status, created_at DESC);
CREATE INDEX ON public.notifications (status, scheduled_for);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff manage notifications" ON public.notifications FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "patient view own notifications" ON public.notifications FOR SELECT TO authenticated
  USING (patient_id = public.current_patient_id() OR user_id = auth.uid());
CREATE POLICY "user mark own read" ON public.notifications FOR UPDATE TO authenticated
  USING (patient_id = public.current_patient_id() OR user_id = auth.uid())
  WITH CHECK (patient_id = public.current_patient_id() OR user_id = auth.uid());

CREATE TABLE public.notification_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id uuid REFERENCES public.notifications(id) ON DELETE SET NULL,
  patient_id uuid REFERENCES public.patients(id) ON DELETE SET NULL,
  event_type public.notif_event_type NOT NULL,
  channel public.notif_channel NOT NULL,
  template_key text,
  status public.notif_status NOT NULL,
  attempt int NOT NULL DEFAULT 1,
  error text,
  payload jsonb,
  sent_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.notification_log (patient_id, sent_at DESC);
GRANT SELECT, INSERT ON public.notification_log TO authenticated;
GRANT ALL ON public.notification_log TO service_role;
ALTER TABLE public.notification_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read log" ON public.notification_log FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "patient read own log" ON public.notification_log FOR SELECT TO authenticated USING (patient_id = public.current_patient_id());

-- =========================
-- TASKS ("My Day")
-- =========================
CREATE TYPE public.task_status AS ENUM ('open','in_progress','done','snoozed','cancelled');
CREATE TYPE public.task_priority AS ENUM ('low','normal','high','urgent');

CREATE TABLE public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid REFERENCES public.patients(id) ON DELETE CASCADE,
  assigned_to uuid,
  created_by uuid,
  title text NOT NULL,
  description text,
  due_at timestamptz,
  status public.task_status NOT NULL DEFAULT 'open',
  priority public.task_priority NOT NULL DEFAULT 'normal',
  source text,
  ref_table text,
  ref_id uuid,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.tasks (assigned_to, status, due_at);
CREATE INDEX ON public.tasks (patient_id, status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks TO authenticated;
GRANT ALL ON public.tasks TO service_role;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff manage tasks" ON public.tasks FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE TRIGGER trg_tasks_updated BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- =========================
-- AUDIT LOG
-- =========================
CREATE TABLE public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL,
  record_id uuid,
  action text NOT NULL,
  actor uuid,
  before jsonb,
  after jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.audit_log (table_name, record_id, created_at DESC);
GRANT SELECT, INSERT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin read audit" ON public.audit_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.tg_audit_row() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_id := (row_to_json(OLD)::jsonb->>'id')::uuid;
    INSERT INTO public.audit_log(table_name, record_id, action, actor, before, after)
    VALUES (TG_TABLE_NAME, v_id, 'delete', auth.uid(), row_to_json(OLD)::jsonb, NULL);
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    v_id := (row_to_json(NEW)::jsonb->>'id')::uuid;
    INSERT INTO public.audit_log(table_name, record_id, action, actor, before, after)
    VALUES (TG_TABLE_NAME, v_id, 'update', auth.uid(), row_to_json(OLD)::jsonb, row_to_json(NEW)::jsonb);
    RETURN NEW;
  ELSE
    v_id := (row_to_json(NEW)::jsonb->>'id')::uuid;
    INSERT INTO public.audit_log(table_name, record_id, action, actor, before, after)
    VALUES (TG_TABLE_NAME, v_id, 'insert', auth.uid(), NULL, row_to_json(NEW)::jsonb);
    RETURN NEW;
  END IF;
END;
$$;

CREATE TRIGGER trg_audit_patients AFTER INSERT OR UPDATE OR DELETE ON public.patients FOR EACH ROW EXECUTE FUNCTION public.tg_audit_row();
CREATE TRIGGER trg_audit_payments AFTER INSERT OR UPDATE OR DELETE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.tg_audit_row();
CREATE TRIGGER trg_audit_prescriptions AFTER INSERT OR UPDATE OR DELETE ON public.prescriptions FOR EACH ROW EXECUTE FUNCTION public.tg_audit_row();

-- =========================
-- REFERRAL COMMISSIONS
-- =========================
CREATE TYPE public.commission_status AS ENUM ('accrued','approved','paid','void');
CREATE TYPE public.referrer_kind AS ENUM ('doctor','hospital');

CREATE TABLE public.referral_commissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  enrollment_id uuid REFERENCES public.patient_enrollments(id) ON DELETE SET NULL,
  referrer_kind public.referrer_kind NOT NULL,
  doctor_id uuid REFERENCES public.doctors(id),
  hospital_id uuid REFERENCES public.hospitals(id),
  basis text NOT NULL DEFAULT 'flat',
  amount_bdt numeric(12,2) NOT NULL DEFAULT 0,
  percent numeric(5,2),
  status public.commission_status NOT NULL DEFAULT 'accrued',
  accrued_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz,
  paid_at timestamptz,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.referral_commissions (status, accrued_at DESC);
CREATE INDEX ON public.referral_commissions (doctor_id, status);
CREATE INDEX ON public.referral_commissions (hospital_id, status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.referral_commissions TO authenticated;
GRANT ALL ON public.referral_commissions TO service_role;
ALTER TABLE public.referral_commissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "finance read commissions" ON public.referral_commissions FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()) OR public.has_role(auth.uid(),'finance'));
CREATE POLICY "finance write commissions" ON public.referral_commissions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'finance'))
  WITH CHECK (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'finance'));
CREATE TRIGGER trg_commissions_updated BEFORE UPDATE ON public.referral_commissions FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.commission_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  commission_id uuid NOT NULL REFERENCES public.referral_commissions(id) ON DELETE CASCADE,
  amount_bdt numeric(12,2) NOT NULL,
  paid_at timestamptz NOT NULL DEFAULT now(),
  method text,
  reference text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.commission_payments TO authenticated;
GRANT ALL ON public.commission_payments TO service_role;
ALTER TABLE public.commission_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "finance manage commission payments" ON public.commission_payments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'finance'))
  WITH CHECK (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'finance'));

-- Auto-accrue commission on enrollment
CREATE OR REPLACE FUNCTION public.tg_enrollments_accrue_commission()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_patient public.patients%ROWTYPE;
  v_doctor public.doctors%ROWTYPE;
  v_hospital public.hospitals%ROWTYPE;
  v_amount numeric := 0;
  v_kind public.referrer_kind;
BEGIN
  SELECT * INTO v_patient FROM public.patients WHERE id = NEW.patient_id;
  IF v_patient.referring_doctor_id IS NOT NULL THEN
    SELECT * INTO v_doctor FROM public.doctors WHERE id = v_patient.referring_doctor_id;
    v_kind := 'doctor';
    IF v_doctor.commission_flat_bdt IS NOT NULL AND v_doctor.commission_flat_bdt > 0 THEN
      v_amount := v_doctor.commission_flat_bdt;
    ELSIF v_doctor.commission_percent IS NOT NULL AND v_doctor.commission_percent > 0 THEN
      v_amount := (NEW.total_price_bdt * v_doctor.commission_percent) / 100.0;
    END IF;
    IF v_amount > 0 THEN
      INSERT INTO public.referral_commissions(patient_id, enrollment_id, referrer_kind, doctor_id, basis, amount_bdt, percent)
      VALUES (NEW.patient_id, NEW.id, v_kind, v_doctor.id,
              CASE WHEN v_doctor.commission_flat_bdt IS NOT NULL AND v_doctor.commission_flat_bdt > 0 THEN 'flat' ELSE 'percent' END,
              v_amount, v_doctor.commission_percent);
    END IF;
  ELSIF v_patient.referring_hospital_id IS NOT NULL THEN
    SELECT * INTO v_hospital FROM public.hospitals WHERE id = v_patient.referring_hospital_id;
    v_kind := 'hospital';
    IF v_hospital.commission_flat_bdt IS NOT NULL AND v_hospital.commission_flat_bdt > 0 THEN
      v_amount := v_hospital.commission_flat_bdt;
    ELSIF v_hospital.commission_percent IS NOT NULL AND v_hospital.commission_percent > 0 THEN
      v_amount := (NEW.total_price_bdt * v_hospital.commission_percent) / 100.0;
    END IF;
    IF v_amount > 0 THEN
      INSERT INTO public.referral_commissions(patient_id, enrollment_id, referrer_kind, hospital_id, basis, amount_bdt, percent)
      VALUES (NEW.patient_id, NEW.id, v_kind, v_hospital.id,
              CASE WHEN v_hospital.commission_flat_bdt IS NOT NULL AND v_hospital.commission_flat_bdt > 0 THEN 'flat' ELSE 'percent' END,
              v_amount, v_hospital.commission_percent);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_enrollments_commission AFTER INSERT ON public.patient_enrollments FOR EACH ROW EXECUTE FUNCTION public.tg_enrollments_accrue_commission();

-- =========================
-- CGM SENSOR APPLICATIONS
-- =========================
CREATE TABLE public.sensor_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  item_id uuid REFERENCES public.inventory_items(id),
  assignment_id uuid REFERENCES public.inventory_assignments(id) ON DELETE SET NULL,
  applied_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  batch_no text,
  removed_at timestamptz,
  removal_reason text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.sensor_applications (patient_id, applied_at DESC);
CREATE INDEX ON public.sensor_applications (expires_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sensor_applications TO authenticated;
GRANT ALL ON public.sensor_applications TO service_role;
ALTER TABLE public.sensor_applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff manage sensors" ON public.sensor_applications FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "patient view own sensors" ON public.sensor_applications FOR SELECT TO authenticated
  USING (patient_id = public.current_patient_id());
CREATE TRIGGER trg_sensors_updated BEFORE UPDATE ON public.sensor_applications FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE OR REPLACE FUNCTION public.tg_sensor_default_expiry() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.expires_at IS NULL THEN
    NEW.expires_at := NEW.applied_at + interval '14 days';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_sensors_expiry BEFORE INSERT ON public.sensor_applications FOR EACH ROW EXECUTE FUNCTION public.tg_sensor_default_expiry();

-- =========================
-- MESSAGE LOG + WA TEMPLATES + ANNOUNCEMENTS
-- =========================
CREATE TYPE public.msg_channel AS ENUM ('whatsapp','sms','email','in_app');
CREATE TYPE public.msg_direction AS ENUM ('outbound','inbound');
CREATE TYPE public.msg_status AS ENUM ('queued','sent','delivered','read','failed');

CREATE TABLE public.whatsapp_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  language text NOT NULL DEFAULT 'en',
  category text,
  body text NOT NULL,
  variables text[] NOT NULL DEFAULT '{}',
  wati_template_name text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_templates TO authenticated;
GRANT ALL ON public.whatsapp_templates TO service_role;
ALTER TABLE public.whatsapp_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read wa templates" ON public.whatsapp_templates FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "admin write wa templates" ON public.whatsapp_templates FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_wa_templates_updated BEFORE UPDATE ON public.whatsapp_templates FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.message_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid REFERENCES public.patients(id) ON DELETE CASCADE,
  channel public.msg_channel NOT NULL DEFAULT 'whatsapp',
  direction public.msg_direction NOT NULL DEFAULT 'outbound',
  template_name text,
  body text,
  variables jsonb,
  status public.msg_status NOT NULL DEFAULT 'queued',
  provider_ref text,
  error text,
  sent_by uuid,
  sent_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.message_log (patient_id, sent_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.message_log TO authenticated;
GRANT ALL ON public.message_log TO service_role;
ALTER TABLE public.message_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff manage messages" ON public.message_log FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "patient read own messages" ON public.message_log FOR SELECT TO authenticated
  USING (patient_id = public.current_patient_id());

CREATE TABLE public.announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  language text NOT NULL DEFAULT 'en',
  audience text NOT NULL DEFAULT 'all_active',
  channel public.msg_channel NOT NULL DEFAULT 'whatsapp',
  sent_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.announcements TO authenticated;
GRANT ALL ON public.announcements TO service_role;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff manage announcements" ON public.announcements FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- =========================
-- PROGRAM OUTCOMES SNAPSHOT
-- =========================
CREATE TABLE public.patient_outcomes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE UNIQUE,
  baseline_hba1c numeric(4,2),
  current_hba1c numeric(4,2),
  hba1c_delta numeric(4,2),
  baseline_weight_kg numeric(6,2),
  current_weight_kg numeric(6,2),
  weight_delta_kg numeric(6,2),
  baseline_med_count int,
  current_med_count int,
  insulin_stopped boolean,
  in_remission boolean,
  computed_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.patient_outcomes TO authenticated;
GRANT ALL ON public.patient_outcomes TO service_role;
ALTER TABLE public.patient_outcomes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read outcomes" ON public.patient_outcomes FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "staff write outcomes" ON public.patient_outcomes FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "patient read own outcomes" ON public.patient_outcomes FOR SELECT TO authenticated
  USING (patient_id = public.current_patient_id());

-- =========================
-- SEED DEFAULT NOTIFICATION RULES
-- =========================
INSERT INTO public.notification_rules (event_type, offsets_days, channels, template_key) VALUES
  ('sensor_change', ARRAY[-3,-1,0], ARRAY['in_app']::notif_channel[], 'sensor_change'),
  ('doctor_consult', ARRAY[-3,-1,0], ARRAY['in_app']::notif_channel[], 'doctor_consult'),
  ('nutritionist_consult', ARRAY[-2,-1], ARRAY['in_app']::notif_channel[], 'nutritionist_consult'),
  ('lab_test', ARRAY[-7,-3,0], ARRAY['in_app']::notif_channel[], 'lab_test'),
  ('payment_due', ARRAY[-3,0,3,7,14], ARRAY['in_app']::notif_channel[], 'payment_due'),
  ('program_renewal', ARRAY[-60,-30,-15], ARRAY['in_app']::notif_channel[], 'program_renewal'),
  ('device_return', ARRAY[-7,-1,0], ARRAY['in_app']::notif_channel[], 'device_return');
