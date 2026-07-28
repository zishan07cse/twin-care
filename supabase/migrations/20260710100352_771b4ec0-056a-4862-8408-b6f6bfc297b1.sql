
-- ============ Phase B: Orders → Challans → Invoices → Payments ============

-- Sequences for numbering
CREATE SEQUENCE IF NOT EXISTS public.sales_order_seq START 1;
CREATE SEQUENCE IF NOT EXISTS public.challan_seq START 1;
CREATE SEQUENCE IF NOT EXISTS public.trade_invoice_seq START 1;

-- Enums
DO $$ BEGIN
  CREATE TYPE public.sales_order_status AS ENUM ('draft','confirmed','partially_delivered','delivered','closed','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.trade_invoice_status AS ENUM ('unpaid','partial','paid','overdue','disputed','void');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.dealer_payment_method AS ENUM ('cash','bank','cheque','bkash','nagad','card','other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.cheque_status AS ENUM ('received','deposited','cleared','bounced','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============ sales_orders ============
CREATE TABLE public.sales_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_no text UNIQUE,
  dealer_id uuid NOT NULL REFERENCES public.dealers(id) ON DELETE RESTRICT,
  order_date date NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Dhaka')::date,
  status public.sales_order_status NOT NULL DEFAULT 'draft',
  subtotal_bdt numeric(14,2) NOT NULL DEFAULT 0,
  discount_bdt numeric(14,2) NOT NULL DEFAULT 0,
  vat_pct numeric(5,2) NOT NULL DEFAULT 15,
  ait_pct numeric(5,2) NOT NULL DEFAULT 5,
  vat_bdt numeric(14,2) NOT NULL DEFAULT 0,
  ait_bdt numeric(14,2) NOT NULL DEFAULT 0,
  total_bdt numeric(14,2) NOT NULL DEFAULT 0,
  notes text,
  credit_override_by uuid REFERENCES auth.users(id),
  credit_override_reason text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales_orders TO authenticated;
GRANT ALL ON public.sales_orders TO service_role;
ALTER TABLE public.sales_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sales_orders staff full" ON public.sales_orders FOR ALL TO authenticated
  USING (public.is_sales_or_staff(auth.uid())) WITH CHECK (public.is_sales_or_staff(auth.uid()));
CREATE TRIGGER trg_sales_orders_updated_at BEFORE UPDATE ON public.sales_orders
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE OR REPLACE FUNCTION public.tg_sales_orders_set_no() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_year text;
BEGIN
  IF NEW.order_no IS NULL OR NEW.order_no = '' THEN
    v_year := to_char((now() AT TIME ZONE 'Asia/Dhaka'), 'YYYY');
    NEW.order_no := 'SO-' || v_year || '-' || lpad(nextval('public.sales_order_seq')::text, 6, '0');
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_sales_orders_set_no BEFORE INSERT ON public.sales_orders
  FOR EACH ROW EXECUTE FUNCTION public.tg_sales_orders_set_no();

CREATE TABLE public.sales_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.sales_orders(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.inventory_items(id) ON DELETE RESTRICT,
  quantity integer NOT NULL CHECK (quantity > 0),
  unit_price_bdt numeric(14,2) NOT NULL DEFAULT 0,
  discount_pct numeric(5,2) NOT NULL DEFAULT 0,
  line_total_bdt numeric(14,2) NOT NULL DEFAULT 0,
  delivered_qty integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales_order_items TO authenticated;
GRANT ALL ON public.sales_order_items TO service_role;
ALTER TABLE public.sales_order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sales_order_items staff full" ON public.sales_order_items FOR ALL TO authenticated
  USING (public.is_sales_or_staff(auth.uid())) WITH CHECK (public.is_sales_or_staff(auth.uid()));

-- ============ delivery_challans ============
CREATE TABLE public.delivery_challans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challan_no text UNIQUE,
  order_id uuid NOT NULL REFERENCES public.sales_orders(id) ON DELETE RESTRICT,
  dealer_id uuid NOT NULL REFERENCES public.dealers(id) ON DELETE RESTRICT,
  dispatch_date date NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Dhaka')::date,
  courier text,
  transport_ref text,
  receiver_ack_url text,
  delivered_by uuid REFERENCES auth.users(id),
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.delivery_challans TO authenticated;
GRANT ALL ON public.delivery_challans TO service_role;
ALTER TABLE public.delivery_challans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "delivery_challans staff full" ON public.delivery_challans FOR ALL TO authenticated
  USING (public.is_sales_or_staff(auth.uid())) WITH CHECK (public.is_sales_or_staff(auth.uid()));
CREATE TRIGGER trg_delivery_challans_updated_at BEFORE UPDATE ON public.delivery_challans
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE OR REPLACE FUNCTION public.tg_challans_set_no() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_year text;
BEGIN
  IF NEW.challan_no IS NULL OR NEW.challan_no = '' THEN
    v_year := to_char((now() AT TIME ZONE 'Asia/Dhaka'), 'YYYY');
    NEW.challan_no := 'CHL-' || v_year || '-' || lpad(nextval('public.challan_seq')::text, 6, '0');
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_challans_set_no BEFORE INSERT ON public.delivery_challans
  FOR EACH ROW EXECUTE FUNCTION public.tg_challans_set_no();

CREATE TABLE public.challan_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challan_id uuid NOT NULL REFERENCES public.delivery_challans(id) ON DELETE CASCADE,
  order_item_id uuid NOT NULL REFERENCES public.sales_order_items(id) ON DELETE RESTRICT,
  item_id uuid NOT NULL REFERENCES public.inventory_items(id) ON DELETE RESTRICT,
  delivered_qty integer NOT NULL CHECK (delivered_qty > 0),
  serials text[],
  batch_no text,
  expiry_date date,
  unit_price_bdt numeric(14,2) NOT NULL DEFAULT 0,
  line_total_bdt numeric(14,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.challan_items TO authenticated;
GRANT ALL ON public.challan_items TO service_role;
ALTER TABLE public.challan_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "challan_items staff full" ON public.challan_items FOR ALL TO authenticated
  USING (public.is_sales_or_staff(auth.uid())) WITH CHECK (public.is_sales_or_staff(auth.uid()));

-- Challan item insert: reduce trade_stock_qty and bump order item delivered
CREATE OR REPLACE FUNCTION public.tg_challan_items_apply() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_available integer; v_order_id uuid; v_total integer; v_delivered integer;
BEGIN
  SELECT trade_stock_qty INTO v_available FROM public.inventory_items WHERE id = NEW.item_id FOR UPDATE;
  IF v_available IS NULL OR v_available < NEW.delivered_qty THEN
    RAISE EXCEPTION 'Insufficient trade stock (% available) for item', COALESCE(v_available,0);
  END IF;
  UPDATE public.inventory_items SET trade_stock_qty = trade_stock_qty - NEW.delivered_qty WHERE id = NEW.item_id;
  UPDATE public.sales_order_items SET delivered_qty = delivered_qty + NEW.delivered_qty WHERE id = NEW.order_item_id;

  -- Update order status
  SELECT order_id INTO v_order_id FROM public.sales_order_items WHERE id = NEW.order_item_id;
  SELECT COALESCE(SUM(quantity),0), COALESCE(SUM(delivered_qty),0) INTO v_total, v_delivered
    FROM public.sales_order_items WHERE order_id = v_order_id;
  IF v_delivered >= v_total THEN
    UPDATE public.sales_orders SET status = 'delivered' WHERE id = v_order_id AND status IN ('confirmed','partially_delivered');
  ELSIF v_delivered > 0 THEN
    UPDATE public.sales_orders SET status = 'partially_delivered' WHERE id = v_order_id AND status = 'confirmed';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_challan_items_apply BEFORE INSERT ON public.challan_items
  FOR EACH ROW EXECUTE FUNCTION public.tg_challan_items_apply();

-- ============ trade_invoices ============
CREATE TABLE public.trade_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_no text UNIQUE,
  dealer_id uuid NOT NULL REFERENCES public.dealers(id) ON DELETE RESTRICT,
  challan_id uuid REFERENCES public.delivery_challans(id) ON DELETE SET NULL,
  order_id uuid REFERENCES public.sales_orders(id) ON DELETE SET NULL,
  invoice_date date NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Dhaka')::date,
  due_date date NOT NULL,
  subtotal_bdt numeric(14,2) NOT NULL DEFAULT 0,
  discount_bdt numeric(14,2) NOT NULL DEFAULT 0,
  vat_pct numeric(5,2) NOT NULL DEFAULT 15,
  ait_pct numeric(5,2) NOT NULL DEFAULT 5,
  vat_bdt numeric(14,2) NOT NULL DEFAULT 0,
  ait_bdt numeric(14,2) NOT NULL DEFAULT 0,
  total_bdt numeric(14,2) NOT NULL DEFAULT 0,
  paid_amount_bdt numeric(14,2) NOT NULL DEFAULT 0,
  status public.trade_invoice_status NOT NULL DEFAULT 'unpaid',
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trade_invoices TO authenticated;
GRANT ALL ON public.trade_invoices TO service_role;
ALTER TABLE public.trade_invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "trade_invoices staff full" ON public.trade_invoices FOR ALL TO authenticated
  USING (public.is_sales_or_staff(auth.uid())) WITH CHECK (public.is_sales_or_staff(auth.uid()));
CREATE TRIGGER trg_trade_invoices_updated_at BEFORE UPDATE ON public.trade_invoices
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE OR REPLACE FUNCTION public.tg_trade_invoices_set_no() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_year text;
BEGIN
  IF NEW.invoice_no IS NULL OR NEW.invoice_no = '' THEN
    v_year := to_char((now() AT TIME ZONE 'Asia/Dhaka'), 'YYYY');
    NEW.invoice_no := 'INV-' || v_year || '-' || lpad(nextval('public.trade_invoice_seq')::text, 6, '0');
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_trade_invoices_set_no BEFORE INSERT ON public.trade_invoices
  FOR EACH ROW EXECUTE FUNCTION public.tg_trade_invoices_set_no();

CREATE TABLE public.trade_invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.trade_invoices(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.inventory_items(id) ON DELETE RESTRICT,
  description text,
  quantity integer NOT NULL,
  unit_price_bdt numeric(14,2) NOT NULL DEFAULT 0,
  line_total_bdt numeric(14,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trade_invoice_items TO authenticated;
GRANT ALL ON public.trade_invoice_items TO service_role;
ALTER TABLE public.trade_invoice_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "trade_invoice_items staff full" ON public.trade_invoice_items FOR ALL TO authenticated
  USING (public.is_sales_or_staff(auth.uid())) WITH CHECK (public.is_sales_or_staff(auth.uid()));

-- ============ dealer_payments + allocations + cheques ============
CREATE TABLE public.dealer_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id uuid NOT NULL REFERENCES public.dealers(id) ON DELETE RESTRICT,
  amount_bdt numeric(14,2) NOT NULL CHECK (amount_bdt > 0),
  payment_date date NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Dhaka')::date,
  method public.dealer_payment_method NOT NULL,
  reference text,
  received_by uuid REFERENCES auth.users(id),
  deposit_slip_url text,
  notes text,
  unallocated_bdt numeric(14,2) NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dealer_payments TO authenticated;
GRANT ALL ON public.dealer_payments TO service_role;
ALTER TABLE public.dealer_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dealer_payments staff full" ON public.dealer_payments FOR ALL TO authenticated
  USING (public.is_sales_or_staff(auth.uid())) WITH CHECK (public.is_sales_or_staff(auth.uid()));
CREATE TRIGGER trg_dealer_payments_updated_at BEFORE UPDATE ON public.dealer_payments
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.payment_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL REFERENCES public.dealer_payments(id) ON DELETE CASCADE,
  invoice_id uuid NOT NULL REFERENCES public.trade_invoices(id) ON DELETE RESTRICT,
  amount_bdt numeric(14,2) NOT NULL CHECK (amount_bdt > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_allocations TO authenticated;
GRANT ALL ON public.payment_allocations TO service_role;
ALTER TABLE public.payment_allocations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payment_allocations staff full" ON public.payment_allocations FOR ALL TO authenticated
  USING (public.is_sales_or_staff(auth.uid())) WITH CHECK (public.is_sales_or_staff(auth.uid()));

-- Allocation trigger: bump invoice paid_amount + status
CREATE OR REPLACE FUNCTION public.tg_payment_allocations_apply() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_inv public.trade_invoices%ROWTYPE;
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.trade_invoices SET paid_amount_bdt = paid_amount_bdt + NEW.amount_bdt WHERE id = NEW.invoice_id;
    SELECT * INTO v_inv FROM public.trade_invoices WHERE id = NEW.invoice_id;
    UPDATE public.trade_invoices SET status = CASE
      WHEN v_inv.paid_amount_bdt >= v_inv.total_bdt THEN 'paid'::trade_invoice_status
      WHEN v_inv.paid_amount_bdt > 0 THEN 'partial'::trade_invoice_status
      ELSE 'unpaid'::trade_invoice_status
    END WHERE id = NEW.invoice_id;
    UPDATE public.dealer_payments SET unallocated_bdt = GREATEST(unallocated_bdt - NEW.amount_bdt, 0) WHERE id = NEW.payment_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.trade_invoices SET paid_amount_bdt = GREATEST(paid_amount_bdt - OLD.amount_bdt, 0) WHERE id = OLD.invoice_id;
    SELECT * INTO v_inv FROM public.trade_invoices WHERE id = OLD.invoice_id;
    UPDATE public.trade_invoices SET status = CASE
      WHEN v_inv.paid_amount_bdt >= v_inv.total_bdt THEN 'paid'::trade_invoice_status
      WHEN v_inv.paid_amount_bdt > 0 THEN 'partial'::trade_invoice_status
      ELSE 'unpaid'::trade_invoice_status
    END WHERE id = OLD.invoice_id;
    UPDATE public.dealer_payments SET unallocated_bdt = unallocated_bdt + OLD.amount_bdt WHERE id = OLD.payment_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER trg_payment_allocations_apply AFTER INSERT OR DELETE ON public.payment_allocations
  FOR EACH ROW EXECUTE FUNCTION public.tg_payment_allocations_apply();

CREATE TABLE public.cheques (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid REFERENCES public.dealer_payments(id) ON DELETE CASCADE,
  dealer_id uuid NOT NULL REFERENCES public.dealers(id) ON DELETE RESTRICT,
  cheque_no text NOT NULL,
  bank text,
  branch text,
  cheque_date date NOT NULL,
  amount_bdt numeric(14,2) NOT NULL,
  status public.cheque_status NOT NULL DEFAULT 'received',
  deposited_on date,
  cleared_on date,
  bounced_on date,
  bounce_reason text,
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cheques TO authenticated;
GRANT ALL ON public.cheques TO service_role;
ALTER TABLE public.cheques ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cheques staff full" ON public.cheques FOR ALL TO authenticated
  USING (public.is_sales_or_staff(auth.uid())) WITH CHECK (public.is_sales_or_staff(auth.uid()));
CREATE TRIGGER trg_cheques_updated_at BEFORE UPDATE ON public.cheques
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
