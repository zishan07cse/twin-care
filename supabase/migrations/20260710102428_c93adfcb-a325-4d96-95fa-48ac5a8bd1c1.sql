
-- Sequences
CREATE SEQUENCE IF NOT EXISTS public.credit_note_seq START 1;
CREATE SEQUENCE IF NOT EXISTS public.debit_note_seq START 1;
CREATE SEQUENCE IF NOT EXISTS public.sales_return_seq START 1;

-- Enums
DO $$ BEGIN
  CREATE TYPE public.credit_note_reason AS ENUM ('return','discount','adjustment','damage','other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.debit_note_reason AS ENUM ('freight','penalty','extra_charge','adjustment','other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.sales_return_status AS ENUM ('draft','received','restocked','closed','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.warranty_claim_status AS ENUM ('open','under_review','approved','rejected','replaced','closed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Credit notes
CREATE TABLE IF NOT EXISTS public.credit_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cn_no text UNIQUE,
  dealer_id uuid NOT NULL REFERENCES public.dealers(id) ON DELETE RESTRICT,
  invoice_id uuid REFERENCES public.trade_invoices(id) ON DELETE SET NULL,
  cn_date date NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Dhaka')::date,
  reason public.credit_note_reason NOT NULL DEFAULT 'adjustment',
  amount_bdt numeric(14,2) NOT NULL CHECK (amount_bdt > 0),
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.credit_notes TO authenticated;
GRANT ALL ON public.credit_notes TO service_role;
ALTER TABLE public.credit_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage credit notes" ON public.credit_notes FOR ALL TO authenticated
  USING (public.is_sales_or_staff(auth.uid())) WITH CHECK (public.is_sales_or_staff(auth.uid()));

CREATE OR REPLACE FUNCTION public.tg_credit_notes_set_no()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE v_year text;
BEGIN
  IF NEW.cn_no IS NULL OR NEW.cn_no='' THEN
    v_year := to_char((now() AT TIME ZONE 'Asia/Dhaka'), 'YYYY');
    NEW.cn_no := 'CN-'||v_year||'-'||lpad(nextval('public.credit_note_seq')::text,6,'0');
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_credit_notes_set_no BEFORE INSERT ON public.credit_notes
  FOR EACH ROW EXECUTE FUNCTION public.tg_credit_notes_set_no();
CREATE TRIGGER trg_credit_notes_updated BEFORE UPDATE ON public.credit_notes
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Debit notes
CREATE TABLE IF NOT EXISTS public.debit_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dn_no text UNIQUE,
  dealer_id uuid NOT NULL REFERENCES public.dealers(id) ON DELETE RESTRICT,
  invoice_id uuid REFERENCES public.trade_invoices(id) ON DELETE SET NULL,
  dn_date date NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Dhaka')::date,
  reason public.debit_note_reason NOT NULL DEFAULT 'adjustment',
  amount_bdt numeric(14,2) NOT NULL CHECK (amount_bdt > 0),
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.debit_notes TO authenticated;
GRANT ALL ON public.debit_notes TO service_role;
ALTER TABLE public.debit_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage debit notes" ON public.debit_notes FOR ALL TO authenticated
  USING (public.is_sales_or_staff(auth.uid())) WITH CHECK (public.is_sales_or_staff(auth.uid()));

CREATE OR REPLACE FUNCTION public.tg_debit_notes_set_no()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE v_year text;
BEGIN
  IF NEW.dn_no IS NULL OR NEW.dn_no='' THEN
    v_year := to_char((now() AT TIME ZONE 'Asia/Dhaka'), 'YYYY');
    NEW.dn_no := 'DN-'||v_year||'-'||lpad(nextval('public.debit_note_seq')::text,6,'0');
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_debit_notes_set_no BEFORE INSERT ON public.debit_notes
  FOR EACH ROW EXECUTE FUNCTION public.tg_debit_notes_set_no();
CREATE TRIGGER trg_debit_notes_updated BEFORE UPDATE ON public.debit_notes
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Sales returns
CREATE TABLE IF NOT EXISTS public.sales_returns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  return_no text UNIQUE,
  dealer_id uuid NOT NULL REFERENCES public.dealers(id) ON DELETE RESTRICT,
  invoice_id uuid REFERENCES public.trade_invoices(id) ON DELETE SET NULL,
  return_date date NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Dhaka')::date,
  status public.sales_return_status NOT NULL DEFAULT 'draft',
  reason text,
  notes text,
  credit_note_id uuid REFERENCES public.credit_notes(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales_returns TO authenticated;
GRANT ALL ON public.sales_returns TO service_role;
ALTER TABLE public.sales_returns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage returns" ON public.sales_returns FOR ALL TO authenticated
  USING (public.is_sales_or_staff(auth.uid())) WITH CHECK (public.is_sales_or_staff(auth.uid()));

CREATE OR REPLACE FUNCTION public.tg_sales_returns_set_no()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE v_year text;
BEGIN
  IF NEW.return_no IS NULL OR NEW.return_no='' THEN
    v_year := to_char((now() AT TIME ZONE 'Asia/Dhaka'), 'YYYY');
    NEW.return_no := 'SR-'||v_year||'-'||lpad(nextval('public.sales_return_seq')::text,6,'0');
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_sales_returns_set_no BEFORE INSERT ON public.sales_returns
  FOR EACH ROW EXECUTE FUNCTION public.tg_sales_returns_set_no();
CREATE TRIGGER trg_sales_returns_updated BEFORE UPDATE ON public.sales_returns
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE IF NOT EXISTS public.sales_return_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id uuid NOT NULL REFERENCES public.sales_returns(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.inventory_items(id) ON DELETE RESTRICT,
  quantity integer NOT NULL CHECK (quantity > 0),
  good_qty integer NOT NULL DEFAULT 0 CHECK (good_qty >= 0),
  damaged_qty integer NOT NULL DEFAULT 0 CHECK (damaged_qty >= 0),
  unit_price_bdt numeric(14,2) NOT NULL DEFAULT 0,
  line_total_bdt numeric(14,2) NOT NULL DEFAULT 0,
  restocked boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales_return_items TO authenticated;
GRANT ALL ON public.sales_return_items TO service_role;
ALTER TABLE public.sales_return_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage return items" ON public.sales_return_items FOR ALL TO authenticated
  USING (public.is_sales_or_staff(auth.uid())) WITH CHECK (public.is_sales_or_staff(auth.uid()));

-- Trigger: when return marked 'restocked', add good_qty back to trade_stock_qty
CREATE OR REPLACE FUNCTION public.tg_sales_returns_restock()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE r public.sales_return_items%ROWTYPE;
BEGIN
  IF NEW.status = 'restocked' AND OLD.status IS DISTINCT FROM 'restocked' THEN
    FOR r IN SELECT * FROM public.sales_return_items WHERE return_id = NEW.id AND restocked = false LOOP
      IF r.good_qty > 0 THEN
        UPDATE public.inventory_items SET trade_stock_qty = trade_stock_qty + r.good_qty WHERE id = r.item_id;
      END IF;
      UPDATE public.sales_return_items SET restocked = true WHERE id = r.id;
    END LOOP;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_sales_returns_restock AFTER UPDATE ON public.sales_returns
  FOR EACH ROW EXECUTE FUNCTION public.tg_sales_returns_restock();

-- Warranty claims
CREATE TABLE IF NOT EXISTS public.warranty_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id uuid NOT NULL REFERENCES public.dealers(id) ON DELETE RESTRICT,
  item_id uuid NOT NULL REFERENCES public.inventory_items(id) ON DELETE RESTRICT,
  serial_no text,
  batch_no text,
  claim_date date NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Dhaka')::date,
  status public.warranty_claim_status NOT NULL DEFAULT 'open',
  issue_description text,
  resolution text,
  replaced_serial text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.warranty_claims TO authenticated;
GRANT ALL ON public.warranty_claims TO service_role;
ALTER TABLE public.warranty_claims ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage warranty claims" ON public.warranty_claims FOR ALL TO authenticated
  USING (public.is_sales_or_staff(auth.uid())) WITH CHECK (public.is_sales_or_staff(auth.uid()));

CREATE TRIGGER trg_warranty_claims_updated BEFORE UPDATE ON public.warranty_claims
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Dealer ledger view (unified debit/credit entries for statements)
CREATE OR REPLACE VIEW public.dealer_ledger_view AS
  SELECT
    i.dealer_id,
    i.invoice_date AS entry_date,
    'invoice'::text AS entry_type,
    i.invoice_no AS reference,
    i.total_bdt AS debit_bdt,
    0::numeric AS credit_bdt,
    i.id AS source_id
  FROM public.trade_invoices i
  WHERE i.status <> 'void'
  UNION ALL
  SELECT
    p.dealer_id,
    p.payment_date,
    'payment',
    coalesce(p.reference, p.method::text),
    0,
    p.amount_bdt,
    p.id
  FROM public.dealer_payments p
  UNION ALL
  SELECT
    c.dealer_id,
    c.cn_date,
    'credit_note',
    c.cn_no,
    0,
    c.amount_bdt,
    c.id
  FROM public.credit_notes c
  UNION ALL
  SELECT
    d.dealer_id,
    d.dn_date,
    'debit_note',
    d.dn_no,
    d.amount_bdt,
    0,
    d.id
  FROM public.debit_notes d;

GRANT SELECT ON public.dealer_ledger_view TO authenticated;
GRANT SELECT ON public.dealer_ledger_view TO service_role;
