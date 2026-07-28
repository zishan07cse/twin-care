-- Service inclusions for program plans (doctor visits, nutritionist sessions, lab bundles, etc.)
CREATE TYPE public.plan_service_type AS ENUM (
  'doctor_visit',
  'nutritionist_visit',
  'care_coordinator_checkin',
  'lab_test',
  'group_session',
  'home_visit',
  'teleconsult',
  'custom'
);

CREATE TYPE public.plan_service_frequency AS ENUM (
  'total',
  'per_month',
  'per_quarter',
  'unlimited'
);

CREATE TABLE public.plan_service_inclusions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.program_plans(id) ON DELETE CASCADE,
  service_type public.plan_service_type NOT NULL,
  label text NOT NULL,
  label_bn text,
  quantity integer NOT NULL DEFAULT 1,
  frequency public.plan_service_frequency NOT NULL DEFAULT 'total',
  notes text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ON public.plan_service_inclusions(plan_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.plan_service_inclusions TO authenticated;
GRANT ALL ON public.plan_service_inclusions TO service_role;

ALTER TABLE public.plan_service_inclusions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view plan services"
  ON public.plan_service_inclusions FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()) OR public.has_role(auth.uid(), 'finance'));

CREATE POLICY "Admins manage plan services"
  ON public.plan_service_inclusions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER trg_plan_service_inclusions_updated_at
  BEFORE UPDATE ON public.plan_service_inclusions
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
