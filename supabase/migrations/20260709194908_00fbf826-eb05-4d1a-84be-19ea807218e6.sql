
-- Access requests table
CREATE TABLE public.access_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  full_name text NOT NULL,
  phone text,
  requested_role app_role NOT NULL,
  message text,
  status text NOT NULL DEFAULT 'pending', -- pending | approved | rejected | completed
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT access_requests_status_check CHECK (status IN ('pending','approved','rejected','completed')),
  CONSTRAINT access_requests_role_check CHECK (requested_role <> 'super_admin')
);

GRANT SELECT, INSERT, UPDATE ON public.access_requests TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.access_requests TO authenticated;
GRANT ALL ON public.access_requests TO service_role;

ALTER TABLE public.access_requests ENABLE ROW LEVEL SECURITY;

-- Anyone (unauthenticated request form) can create a pending request
CREATE POLICY "Anyone can submit access request"
ON public.access_requests FOR INSERT
TO anon, authenticated
WITH CHECK (status = 'pending');

-- Super admins & admins can view all
CREATE POLICY "Admins view access requests"
ON public.access_requests FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'admin'));

-- Super admins & admins can update (approve/reject)
CREATE POLICY "Admins update access requests"
ON public.access_requests FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'admin'));

-- Super admins can delete
CREATE POLICY "Super admin deletes access requests"
ON public.access_requests FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER access_requests_set_updated_at
BEFORE UPDATE ON public.access_requests
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Replace signup trigger:
--  * First ever user -> super_admin
--  * Otherwise -> role from matching approved access_request (if any)
--  * Otherwise -> no role assigned (user has no app access until an admin grants one)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_count int;
  v_req public.access_requests%ROWTYPE;
  v_assigned_role app_role;
  v_full_name text;
  v_phone text;
BEGIN
  SELECT count(*) INTO v_user_count FROM auth.users WHERE id <> NEW.id;

  IF v_user_count = 0 THEN
    v_assigned_role := 'super_admin';
    v_full_name := coalesce(NEW.raw_user_meta_data->>'full_name', NEW.email);
    v_phone := NEW.raw_user_meta_data->>'phone';
  ELSE
    SELECT * INTO v_req
    FROM public.access_requests
    WHERE lower(email) = lower(NEW.email)
      AND status = 'approved'
    LIMIT 1;

    IF FOUND THEN
      v_assigned_role := v_req.requested_role;
      v_full_name := coalesce(v_req.full_name, NEW.raw_user_meta_data->>'full_name', NEW.email);
      v_phone := coalesce(v_req.phone, NEW.raw_user_meta_data->>'phone');

      UPDATE public.access_requests
      SET status = 'completed', updated_at = now()
      WHERE id = v_req.id;
    ELSE
      v_assigned_role := NULL;
      v_full_name := coalesce(NEW.raw_user_meta_data->>'full_name', NEW.email);
      v_phone := NEW.raw_user_meta_data->>'phone';
    END IF;
  END IF;

  INSERT INTO public.profiles (id, full_name, phone, preferred_language)
  VALUES (
    NEW.id,
    v_full_name,
    v_phone,
    coalesce(NEW.raw_user_meta_data->>'preferred_language', 'en')
  )
  ON CONFLICT (id) DO NOTHING;

  IF v_assigned_role IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, v_assigned_role)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$function$;

-- Ensure trigger is attached (safe re-create)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
