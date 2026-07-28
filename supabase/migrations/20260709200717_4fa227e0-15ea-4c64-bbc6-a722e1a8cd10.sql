
CREATE TYPE public.inventory_category AS ENUM ('device','consumable','sensor','medicine','other');
CREATE TYPE public.assignment_status AS ENUM ('active','returned','consumed','lost','expired');

CREATE TABLE public.inventory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name_en text NOT NULL,
  name_bn text,
  sku text UNIQUE,
  category public.inventory_category NOT NULL DEFAULT 'consumable',
  is_returnable boolean NOT NULL DEFAULT false,
  unit_price_bdt numeric(12,2) NOT NULL DEFAULT 0,
  stock_qty integer NOT NULL DEFAULT 0,
  reorder_level integer NOT NULL DEFAULT 0,
  lifespan_days integer,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_items TO authenticated;
GRANT ALL ON public.inventory_items TO service_role;
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff or inventory can view items" ON public.inventory_items
FOR SELECT TO authenticated
USING (public.is_staff(auth.uid()) OR public.has_role(auth.uid(),'inventory_manager'));

CREATE POLICY "Staff or inventory can insert items" ON public.inventory_items
FOR INSERT TO authenticated
WITH CHECK (public.is_staff(auth.uid()) OR public.has_role(auth.uid(),'inventory_manager'));

CREATE POLICY "Staff or inventory can update items" ON public.inventory_items
FOR UPDATE TO authenticated
USING (public.is_staff(auth.uid()) OR public.has_role(auth.uid(),'inventory_manager'));

CREATE POLICY "Admin can delete items" ON public.inventory_items
FOR DELETE TO authenticated
USING (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_inventory_items_updated
BEFORE UPDATE ON public.inventory_items
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.inventory_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.inventory_items(id),
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  assigned_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  returned_at timestamptz,
  status public.assignment_status NOT NULL DEFAULT 'active',
  deposit_bdt numeric(12,2) DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_assignments TO authenticated;
GRANT ALL ON public.inventory_assignments TO service_role;
ALTER TABLE public.inventory_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff or inventory can view assignments" ON public.inventory_assignments
FOR SELECT TO authenticated
USING (public.is_staff(auth.uid()) OR public.has_role(auth.uid(),'inventory_manager'));

CREATE POLICY "Staff or inventory can insert assignments" ON public.inventory_assignments
FOR INSERT TO authenticated
WITH CHECK (public.is_staff(auth.uid()) OR public.has_role(auth.uid(),'inventory_manager'));

CREATE POLICY "Staff or inventory can update assignments" ON public.inventory_assignments
FOR UPDATE TO authenticated
USING (public.is_staff(auth.uid()) OR public.has_role(auth.uid(),'inventory_manager'));

CREATE POLICY "Admin can delete assignments" ON public.inventory_assignments
FOR DELETE TO authenticated
USING (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_inventory_assignments_updated
BEFORE UPDATE ON public.inventory_assignments
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Adjust stock and log on patient timeline
CREATE OR REPLACE FUNCTION public.tg_inventory_assignments_apply()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_item public.inventory_items%ROWTYPE;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT * INTO v_item FROM public.inventory_items WHERE id = NEW.item_id FOR UPDATE;
    UPDATE public.inventory_items SET stock_qty = stock_qty - NEW.quantity WHERE id = NEW.item_id;

    IF NEW.expires_at IS NULL AND v_item.lifespan_days IS NOT NULL THEN
      NEW.expires_at := NEW.assigned_at + (v_item.lifespan_days || ' days')::interval;
    END IF;

    INSERT INTO public.patient_timeline (patient_id, event_type, title, description, created_by)
    VALUES (NEW.patient_id, 'inventory',
      'Item assigned: ' || v_item.name_en,
      'Qty ' || NEW.quantity || CASE WHEN NEW.expires_at IS NOT NULL THEN ', expires ' || to_char(NEW.expires_at,'YYYY-MM-DD') ELSE '' END,
      NEW.created_by);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status = 'returned' AND OLD.status = 'active' THEN
      UPDATE public.inventory_items SET stock_qty = stock_qty + NEW.quantity WHERE id = NEW.item_id;
      IF NEW.returned_at IS NULL THEN NEW.returned_at := now(); END IF;
      INSERT INTO public.patient_timeline (patient_id, event_type, title, description)
      VALUES (NEW.patient_id, 'inventory', 'Item returned', 'Assignment ' || NEW.id::text);
    END IF;
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_inventory_assignments_apply
BEFORE INSERT OR UPDATE ON public.inventory_assignments
FOR EACH ROW EXECUTE FUNCTION public.tg_inventory_assignments_apply();

REVOKE EXECUTE ON FUNCTION public.tg_inventory_assignments_apply() FROM PUBLIC, anon, authenticated;
