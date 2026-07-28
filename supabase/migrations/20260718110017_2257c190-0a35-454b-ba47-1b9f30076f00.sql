
-- Vehicles table
CREATE TABLE public.vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  make text,
  model text,
  plate_number text,
  capacity int,
  status text NOT NULL DEFAULT 'available' CHECK (status IN ('available','in_use','maintenance','retired')),
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicles TO authenticated;
GRANT ALL ON public.vehicles TO service_role;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vehicles_select_auth" ON public.vehicles FOR SELECT TO authenticated USING (true);
CREATE POLICY "vehicles_admin_insert" ON public.vehicles FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "vehicles_admin_update" ON public.vehicles FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "vehicles_admin_delete" ON public.vehicles FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

CREATE TRIGGER trg_vehicles_updated_at BEFORE UPDATE ON public.vehicles
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Vehicle trips
CREATE TABLE public.vehicle_trips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE RESTRICT,
  driver_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  from_location text NOT NULL,
  to_location text NOT NULL,
  purpose text,
  start_at timestamptz NOT NULL DEFAULT now(),
  end_at timestamptz,
  start_odometer numeric,
  end_odometer numeric,
  passengers int,
  status text NOT NULL DEFAULT 'ongoing' CHECK (status IN ('ongoing','completed','cancelled')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX vehicle_trips_vehicle_idx ON public.vehicle_trips(vehicle_id);
CREATE INDEX vehicle_trips_driver_idx ON public.vehicle_trips(driver_user_id);
CREATE UNIQUE INDEX vehicle_trips_one_ongoing_per_vehicle
  ON public.vehicle_trips(vehicle_id) WHERE status = 'ongoing';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicle_trips TO authenticated;
GRANT ALL ON public.vehicle_trips TO service_role;
ALTER TABLE public.vehicle_trips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trips_select_own_or_admin" ON public.vehicle_trips FOR SELECT TO authenticated
  USING (driver_user_id = auth.uid()
    OR public.has_role(auth.uid(),'admin')
    OR public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "trips_insert_self" ON public.vehicle_trips FOR INSERT TO authenticated
  WITH CHECK (driver_user_id = auth.uid());
CREATE POLICY "trips_update_own_or_admin" ON public.vehicle_trips FOR UPDATE TO authenticated
  USING (driver_user_id = auth.uid()
    OR public.has_role(auth.uid(),'admin')
    OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (driver_user_id = auth.uid()
    OR public.has_role(auth.uid(),'admin')
    OR public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "trips_admin_delete" ON public.vehicle_trips FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

CREATE TRIGGER trg_vehicle_trips_updated_at BEFORE UPDATE ON public.vehicle_trips
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Sync vehicle status with trip lifecycle
CREATE OR REPLACE FUNCTION public.tg_vehicle_trips_sync_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE v_status text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT status INTO v_status FROM public.vehicles WHERE id = NEW.vehicle_id FOR UPDATE;
    IF v_status IS DISTINCT FROM 'available' AND NEW.status = 'ongoing' THEN
      RAISE EXCEPTION 'Vehicle is not available (status: %)', v_status;
    END IF;
    IF NEW.status = 'ongoing' THEN
      UPDATE public.vehicles SET status = 'in_use' WHERE id = NEW.vehicle_id;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status = 'ongoing' AND NEW.status IN ('completed','cancelled') THEN
      UPDATE public.vehicles SET status = 'available' WHERE id = NEW.vehicle_id AND status = 'in_use';
      IF NEW.status = 'completed' AND NEW.end_at IS NULL THEN
        NEW.end_at := now();
      END IF;
    END IF;
    RETURN NEW;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_vehicle_trips_sync
  BEFORE INSERT OR UPDATE ON public.vehicle_trips
  FOR EACH ROW EXECUTE FUNCTION public.tg_vehicle_trips_sync_status();
