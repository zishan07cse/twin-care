
-- ================= PHARMACIES =================
CREATE TABLE public.pharmacies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  name_bn text,
  address text,
  city text,
  phone text,
  contact_person text,
  latitude double precision,
  longitude double precision,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pharmacies TO authenticated;
GRANT ALL ON public.pharmacies TO service_role;

ALTER TABLE public.pharmacies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sales/staff can view pharmacies" ON public.pharmacies
  FOR SELECT TO authenticated
  USING (public.is_sales_or_staff(auth.uid()));

CREATE POLICY "Sales/staff can insert pharmacies" ON public.pharmacies
  FOR INSERT TO authenticated
  WITH CHECK (public.is_sales_or_staff(auth.uid()));

CREATE POLICY "Sales/staff can update pharmacies" ON public.pharmacies
  FOR UPDATE TO authenticated
  USING (public.is_sales_or_staff(auth.uid()))
  WITH CHECK (public.is_sales_or_staff(auth.uid()));

CREATE POLICY "Admins can delete pharmacies" ON public.pharmacies
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

CREATE TRIGGER trg_pharmacies_updated_at
  BEFORE UPDATE ON public.pharmacies
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============ VISIT FORM FIELDS (admin-managed) ============
CREATE TYPE public.visit_field_type AS ENUM ('text','textarea','number','select','date','checkbox');

CREATE TABLE public.visit_form_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  field_key text NOT NULL UNIQUE,
  label text NOT NULL,
  field_type public.visit_field_type NOT NULL DEFAULT 'text',
  options jsonb,           -- ["Option A", "Option B"] for select
  placeholder text,
  required boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.visit_form_fields TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.visit_form_fields TO authenticated;
GRANT ALL ON public.visit_form_fields TO service_role;

ALTER TABLE public.visit_form_fields ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone signed-in can view visit fields" ON public.visit_form_fields
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage visit fields" ON public.visit_form_fields
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

CREATE TRIGGER trg_visit_form_fields_updated_at
  BEFORE UPDATE ON public.visit_form_fields
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- =================== VISITS ===================
CREATE TYPE public.visit_target_type AS ENUM ('doctor','hospital','patient','dealer','pharmacy','other');
CREATE TYPE public.visit_status AS ENUM ('planned','checked_in','completed','cancelled','missed');

CREATE SEQUENCE IF NOT EXISTS public.visit_seq;

CREATE TABLE public.visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_no text UNIQUE,

  target_type public.visit_target_type NOT NULL,
  doctor_id uuid REFERENCES public.doctors(id) ON DELETE SET NULL,
  hospital_id uuid REFERENCES public.hospitals(id) ON DELETE SET NULL,
  patient_id uuid REFERENCES public.patients(id) ON DELETE SET NULL,
  dealer_id uuid REFERENCES public.dealers(id) ON DELETE SET NULL,
  pharmacy_id uuid REFERENCES public.pharmacies(id) ON DELETE SET NULL,
  other_name text,
  other_address text,

  planned_at timestamptz,
  purpose text,
  action_plan text,
  outcome text,
  next_action text,
  notes text,
  status public.visit_status NOT NULL DEFAULT 'planned',

  -- GPS
  checkin_at timestamptz,
  checkin_lat double precision,
  checkin_lng double precision,
  checkin_accuracy_m double precision,
  checkout_at timestamptz,
  checkout_lat double precision,
  checkout_lng double precision,
  checkout_accuracy_m double precision,

  -- Optional target coordinates snapshot + computed distance for flagging
  target_lat double precision,
  target_lng double precision,
  distance_from_target_m double precision,
  distance_flagged boolean NOT NULL DEFAULT false,

  custom_data jsonb NOT NULL DEFAULT '{}'::jsonb,

  assigned_to uuid NOT NULL REFERENCES auth.users(id),
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_visits_assigned_at ON public.visits (assigned_to, planned_at DESC);
CREATE INDEX idx_visits_target ON public.visits (target_type, doctor_id, hospital_id, patient_id, dealer_id, pharmacy_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.visits TO authenticated;
GRANT ALL ON public.visits TO service_role;

ALTER TABLE public.visits ENABLE ROW LEVEL SECURITY;

-- Sales can see and manage their own visits
CREATE POLICY "Sales view own visits" ON public.visits
  FOR SELECT TO authenticated
  USING (assigned_to = auth.uid() OR created_by = auth.uid());

CREATE POLICY "Sales insert own visits" ON public.visits
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_sales_or_staff(auth.uid())
    AND (assigned_to = auth.uid() OR public.is_staff(auth.uid()))
  );

CREATE POLICY "Sales update own visits" ON public.visits
  FOR UPDATE TO authenticated
  USING (assigned_to = auth.uid() OR created_by = auth.uid())
  WITH CHECK (assigned_to = auth.uid() OR created_by = auth.uid());

-- Staff see and manage all
CREATE POLICY "Staff view all visits" ON public.visits
  FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE POLICY "Staff manage all visits" ON public.visits
  FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "Admins delete visits" ON public.visits
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

CREATE TRIGGER trg_visits_updated_at
  BEFORE UPDATE ON public.visits
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Auto visit number
CREATE OR REPLACE FUNCTION public.tg_visits_set_no()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_year text;
BEGIN
  IF NEW.visit_no IS NULL OR NEW.visit_no='' THEN
    v_year := to_char((now() AT TIME ZONE 'Asia/Dhaka'), 'YYYY');
    NEW.visit_no := 'VST-'||v_year||'-'||lpad(nextval('public.visit_seq')::text,6,'0');
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_visits_set_no
  BEFORE INSERT ON public.visits
  FOR EACH ROW EXECUTE FUNCTION public.tg_visits_set_no();

-- Seed a couple of default custom fields (admin can edit/remove)
INSERT INTO public.visit_form_fields (field_key, label, field_type, required, sort_order) VALUES
  ('products_discussed','Products discussed','text',false,10),
  ('samples_left','Samples left','number',false,20),
  ('follow_up_required','Follow-up required','checkbox',false,30);
