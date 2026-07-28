
-- =========================================================
-- Distribution / Dealer module — Phase A schema
-- =========================================================

-- Enums
DO $$ BEGIN
  CREATE TYPE public.dealer_type AS ENUM ('distributor','sub_dealer','retailer','pharmacy','hospital_shop');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.dealer_status AS ENUM ('active','suspended','terminated');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.dealer_price_tier AS ENUM ('distributor','dealer','retailer');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.credit_period AS ENUM ('cash','net_7','net_15','net_30','net_45');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.stock_pool AS ENUM ('program','trade');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.target_period AS ENUM ('month','quarter','year');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Sequence for dealer codes DLR-0001
CREATE SEQUENCE IF NOT EXISTS public.dealer_code_seq START 1;

-- Helper: is_sales_or_staff — extends is_staff with sales_officer
CREATE OR REPLACE FUNCTION public.is_sales_or_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('super_admin','admin','care_coordinator','finance','inventory_manager','sales_officer')
  )
$$;

REVOKE ALL ON FUNCTION public.is_sales_or_staff(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_sales_or_staff(uuid) TO authenticated, service_role;

-- =========================================================
-- Extend inventory_items with trade fields
-- =========================================================
ALTER TABLE public.inventory_items
  ADD COLUMN IF NOT EXISTS mrp_bdt numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS trade_stock_qty integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_trade_sellable boolean NOT NULL DEFAULT false;

-- =========================================================
-- Dealers
-- =========================================================
CREATE TABLE IF NOT EXISTS public.dealers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_code text UNIQUE NOT NULL,
  business_name text NOT NULL,
  business_name_bn text,
  proprietor_name text,
  trade_license_no text,
  tin text,
  bin text,
  address text,
  district text,
  division text,
  territory text,
  phone text,
  whatsapp text,
  email text,
  dealer_type public.dealer_type NOT NULL DEFAULT 'retailer',
  onboarded_at date NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Dhaka')::date,
  agreement_url text,
  security_deposit_bdt numeric(14,2) NOT NULL DEFAULT 0,
  status public.dealer_status NOT NULL DEFAULT 'active',
  sales_officer_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  price_tier public.dealer_price_tier NOT NULL DEFAULT 'dealer',
  credit_limit_bdt numeric(14,2) NOT NULL DEFAULT 0,
  credit_period public.credit_period NOT NULL DEFAULT 'cash',
  early_payment_discount_pct numeric(5,2) NOT NULL DEFAULT 0,
  penalty_pct numeric(5,2) NOT NULL DEFAULT 0,
  overdue_grace_days integer NOT NULL DEFAULT 0,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dealers TO authenticated;
GRANT ALL ON public.dealers TO service_role;

ALTER TABLE public.dealers ENABLE ROW LEVEL SECURITY;

-- Admins / staff full access; sales officers see own dealers
CREATE POLICY "Staff can view dealers"
  ON public.dealers FOR SELECT
  TO authenticated
  USING (
    public.is_staff(auth.uid())
    OR (public.has_role(auth.uid(),'sales_officer') AND sales_officer_id = auth.uid())
  );

CREATE POLICY "Staff can insert dealers"
  ON public.dealers FOR INSERT
  TO authenticated
  WITH CHECK (public.is_staff(auth.uid()) OR public.has_role(auth.uid(),'sales_officer'));

CREATE POLICY "Staff can update dealers"
  ON public.dealers FOR UPDATE
  TO authenticated
  USING (
    public.is_staff(auth.uid())
    OR (public.has_role(auth.uid(),'sales_officer') AND sales_officer_id = auth.uid())
  )
  WITH CHECK (
    public.is_staff(auth.uid())
    OR (public.has_role(auth.uid(),'sales_officer') AND sales_officer_id = auth.uid())
  );

CREATE POLICY "Admins can delete dealers"
  ON public.dealers FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin'));

-- Auto dealer_code + updated_at
CREATE OR REPLACE FUNCTION public.tg_dealers_set_code()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.dealer_code IS NULL OR NEW.dealer_code = '' THEN
    NEW.dealer_code := 'DLR-' || lpad(nextval('public.dealer_code_seq')::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER dealers_set_code
  BEFORE INSERT ON public.dealers
  FOR EACH ROW EXECUTE FUNCTION public.tg_dealers_set_code();

CREATE TRIGGER dealers_set_updated_at
  BEFORE UPDATE ON public.dealers
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TRIGGER dealers_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.dealers
  FOR EACH ROW EXECUTE FUNCTION public.tg_audit_row();

CREATE INDEX IF NOT EXISTS idx_dealers_status ON public.dealers(status);
CREATE INDEX IF NOT EXISTS idx_dealers_district ON public.dealers(district);
CREATE INDEX IF NOT EXISTS idx_dealers_sales_officer ON public.dealers(sales_officer_id);

-- =========================================================
-- Dealer price tiers (per item per tier)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.dealer_price_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  tier public.dealer_price_tier NOT NULL,
  unit_price_bdt numeric(14,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (item_id, tier)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dealer_price_tiers TO authenticated;
GRANT ALL ON public.dealer_price_tiers TO service_role;

ALTER TABLE public.dealer_price_tiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view tier prices"
  ON public.dealer_price_tiers FOR SELECT
  TO authenticated
  USING (public.is_sales_or_staff(auth.uid()));

CREATE POLICY "Admins can manage tier prices"
  ON public.dealer_price_tiers FOR ALL
  TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

CREATE TRIGGER dealer_price_tiers_set_updated_at
  BEFORE UPDATE ON public.dealer_price_tiers
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- =========================================================
-- Stock allocation log (program <-> trade)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.stock_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  from_pool public.stock_pool NOT NULL,
  to_pool public.stock_pool NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  note text,
  moved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (from_pool <> to_pool)
);

GRANT SELECT, INSERT ON public.stock_allocations TO authenticated;
GRANT ALL ON public.stock_allocations TO service_role;

ALTER TABLE public.stock_allocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff view stock allocations"
  ON public.stock_allocations FOR SELECT
  TO authenticated
  USING (public.is_sales_or_staff(auth.uid()));

CREATE POLICY "Staff insert stock allocations"
  ON public.stock_allocations FOR INSERT
  TO authenticated
  WITH CHECK (public.is_staff(auth.uid()) OR public.has_role(auth.uid(),'inventory_manager'));

-- Trigger applies the stock move to inventory_items pools
CREATE OR REPLACE FUNCTION public.tg_stock_allocations_apply()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_item public.inventory_items%ROWTYPE;
BEGIN
  SELECT * INTO v_item FROM public.inventory_items WHERE id = NEW.item_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Item not found'; END IF;

  IF NEW.from_pool = 'program' THEN
    IF v_item.stock_qty < NEW.quantity THEN
      RAISE EXCEPTION 'Insufficient program stock (% available)', v_item.stock_qty;
    END IF;
    UPDATE public.inventory_items
      SET stock_qty = stock_qty - NEW.quantity,
          trade_stock_qty = trade_stock_qty + NEW.quantity
      WHERE id = NEW.item_id;
  ELSIF NEW.from_pool = 'trade' THEN
    IF v_item.trade_stock_qty < NEW.quantity THEN
      RAISE EXCEPTION 'Insufficient trade stock (% available)', v_item.trade_stock_qty;
    END IF;
    UPDATE public.inventory_items
      SET trade_stock_qty = trade_stock_qty - NEW.quantity,
          stock_qty = stock_qty + NEW.quantity
      WHERE id = NEW.item_id;
  END IF;
  NEW.moved_by := COALESCE(NEW.moved_by, auth.uid());
  RETURN NEW;
END;
$$;

CREATE TRIGGER stock_allocations_apply
  BEFORE INSERT ON public.stock_allocations
  FOR EACH ROW EXECUTE FUNCTION public.tg_stock_allocations_apply();

CREATE INDEX IF NOT EXISTS idx_stock_allocations_item ON public.stock_allocations(item_id, created_at DESC);

-- =========================================================
-- Dealer targets
-- =========================================================
CREATE TABLE IF NOT EXISTS public.dealer_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id uuid NOT NULL REFERENCES public.dealers(id) ON DELETE CASCADE,
  period public.target_period NOT NULL,
  period_start date NOT NULL,
  target_bdt numeric(14,2) NOT NULL DEFAULT 0,
  target_units integer NOT NULL DEFAULT 0,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (dealer_id, period, period_start)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dealer_targets TO authenticated;
GRANT ALL ON public.dealer_targets TO service_role;

ALTER TABLE public.dealer_targets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view targets"
  ON public.dealer_targets FOR SELECT
  TO authenticated
  USING (
    public.is_staff(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.dealers d
      WHERE d.id = dealer_id AND d.sales_officer_id = auth.uid()
    )
  );

CREATE POLICY "Staff can manage targets"
  ON public.dealer_targets FOR ALL
  TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

CREATE TRIGGER dealer_targets_set_updated_at
  BEFORE UPDATE ON public.dealer_targets
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE INDEX IF NOT EXISTS idx_dealer_targets_dealer ON public.dealer_targets(dealer_id, period_start DESC);
