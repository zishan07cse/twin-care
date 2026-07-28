
-- Reusable helper: current user is staff (super_admin OR admin OR care_coordinator)
CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('super_admin','admin','care_coordinator')
  )
$$;

REVOKE EXECUTE ON FUNCTION public.is_staff(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.is_staff(uuid) TO authenticated, service_role;

-- Hospitals
CREATE TABLE public.hospitals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  name_bn text,
  address text,
  city text,
  phone text,
  email text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.hospitals TO authenticated;
GRANT ALL ON public.hospitals TO service_role;

ALTER TABLE public.hospitals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff read hospitals" ON public.hospitals
FOR SELECT TO authenticated
USING (public.is_staff(auth.uid()));

CREATE POLICY "Staff insert hospitals" ON public.hospitals
FOR INSERT TO authenticated
WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "Staff update hospitals" ON public.hospitals
FOR UPDATE TO authenticated
USING (public.is_staff(auth.uid()))
WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "Staff delete hospitals" ON public.hospitals
FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'admin'));

CREATE TRIGGER hospitals_set_updated_at
BEFORE UPDATE ON public.hospitals
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE INDEX hospitals_name_idx ON public.hospitals (lower(name));

-- Doctors
CREATE TABLE public.doctors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  full_name_bn text,
  bmdc_number text UNIQUE,
  specialization text,
  phone text,
  email text,
  hospital_id uuid REFERENCES public.hospitals(id) ON DELETE SET NULL,
  is_referrer boolean NOT NULL DEFAULT false,
  is_treating boolean NOT NULL DEFAULT true,
  referral_commission_pct numeric(5,2) NOT NULL DEFAULT 0,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT doctors_commission_range CHECK (referral_commission_pct >= 0 AND referral_commission_pct <= 100)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.doctors TO authenticated;
GRANT ALL ON public.doctors TO service_role;

ALTER TABLE public.doctors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff read doctors" ON public.doctors
FOR SELECT TO authenticated
USING (public.is_staff(auth.uid()));

CREATE POLICY "Staff insert doctors" ON public.doctors
FOR INSERT TO authenticated
WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "Staff update doctors" ON public.doctors
FOR UPDATE TO authenticated
USING (public.is_staff(auth.uid()))
WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "Staff delete doctors" ON public.doctors
FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'admin'));

CREATE TRIGGER doctors_set_updated_at
BEFORE UPDATE ON public.doctors
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE INDEX doctors_name_idx ON public.doctors (lower(full_name));
CREATE INDEX doctors_hospital_idx ON public.doctors (hospital_id);

-- Nutritionists
CREATE TABLE public.nutritionists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  full_name_bn text,
  qualification text,
  phone text,
  email text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.nutritionists TO authenticated;
GRANT ALL ON public.nutritionists TO service_role;

ALTER TABLE public.nutritionists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff read nutritionists" ON public.nutritionists
FOR SELECT TO authenticated
USING (public.is_staff(auth.uid()));

CREATE POLICY "Staff insert nutritionists" ON public.nutritionists
FOR INSERT TO authenticated
WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "Staff update nutritionists" ON public.nutritionists
FOR UPDATE TO authenticated
USING (public.is_staff(auth.uid()))
WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "Staff delete nutritionists" ON public.nutritionists
FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'admin'));

CREATE TRIGGER nutritionists_set_updated_at
BEFORE UPDATE ON public.nutritionists
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE INDEX nutritionists_name_idx ON public.nutritionists (lower(full_name));
