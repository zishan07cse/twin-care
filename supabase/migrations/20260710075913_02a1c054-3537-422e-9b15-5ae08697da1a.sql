
CREATE TABLE public.inventory_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  quantity integer NOT NULL CHECK (quantity > 0),
  unit_cost_bdt numeric NOT NULL DEFAULT 0 CHECK (unit_cost_bdt >= 0),
  total_cost_bdt numeric GENERATED ALWAYS AS (quantity * unit_cost_bdt) STORED,
  supplier text,
  invoice_no text,
  purchased_at timestamptz NOT NULL DEFAULT now(),
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_purchases TO authenticated;
GRANT ALL ON public.inventory_purchases TO service_role;

ALTER TABLE public.inventory_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff and inventory managers can view purchases"
  ON public.inventory_purchases FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()) OR public.has_role(auth.uid(), 'inventory_manager'));

CREATE POLICY "Staff and inventory managers can add purchases"
  ON public.inventory_purchases FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()) OR public.has_role(auth.uid(), 'inventory_manager'));

CREATE POLICY "Admins can update purchases"
  ON public.inventory_purchases FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete purchases"
  ON public.inventory_purchases FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_inventory_purchases_updated_at
  BEFORE UPDATE ON public.inventory_purchases
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE INDEX idx_inventory_purchases_item ON public.inventory_purchases(item_id, purchased_at DESC);

-- Trigger: add to stock on insert, adjust on update/delete
CREATE OR REPLACE FUNCTION public.tg_inventory_purchases_apply()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.inventory_items
      SET stock_qty = stock_qty + NEW.quantity
      WHERE id = NEW.item_id;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.quantity <> OLD.quantity OR NEW.item_id <> OLD.item_id THEN
      UPDATE public.inventory_items SET stock_qty = stock_qty - OLD.quantity WHERE id = OLD.item_id;
      UPDATE public.inventory_items SET stock_qty = stock_qty + NEW.quantity WHERE id = NEW.item_id;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.inventory_items
      SET stock_qty = GREATEST(stock_qty - OLD.quantity, 0)
      WHERE id = OLD.item_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_inventory_purchases_apply
  AFTER INSERT OR UPDATE OR DELETE ON public.inventory_purchases
  FOR EACH ROW EXECUTE FUNCTION public.tg_inventory_purchases_apply();
