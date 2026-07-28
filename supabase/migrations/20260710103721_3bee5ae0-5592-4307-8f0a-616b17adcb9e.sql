-- Add dealer role and dealer user mapping
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'dealer';

CREATE TABLE IF NOT EXISTS public.dealer_users (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  dealer_id uuid NOT NULL REFERENCES public.dealers(id) ON DELETE CASCADE,
  is_primary boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, dealer_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dealer_users TO authenticated;
GRANT ALL ON public.dealer_users TO service_role;

ALTER TABLE public.dealer_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dealer_users self read"
  ON public.dealer_users FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "dealer_users admin write"
  ON public.dealer_users FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

-- Helper: resolve current user's dealer id (returns NULL if none)
CREATE OR REPLACE FUNCTION public.current_dealer_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT dealer_id FROM public.dealer_users
  WHERE user_id = auth.uid()
  ORDER BY is_primary DESC
  LIMIT 1;
$$;

-- Read-own policies for the dealer portal
CREATE POLICY "dealer self read own dealer"
  ON public.dealers FOR SELECT
  TO authenticated
  USING (id = public.current_dealer_id());

CREATE POLICY "dealer self read own sales orders"
  ON public.sales_orders FOR SELECT
  TO authenticated
  USING (dealer_id = public.current_dealer_id());

CREATE POLICY "dealer self read own sales order items"
  ON public.sales_order_items FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.sales_orders o
    WHERE o.id = sales_order_items.order_id
      AND o.dealer_id = public.current_dealer_id()
  ));

CREATE POLICY "dealer self read own challans"
  ON public.delivery_challans FOR SELECT
  TO authenticated
  USING (dealer_id = public.current_dealer_id());

CREATE POLICY "dealer self read own trade invoices"
  ON public.trade_invoices FOR SELECT
  TO authenticated
  USING (dealer_id = public.current_dealer_id());

CREATE POLICY "dealer self read own invoice items"
  ON public.trade_invoice_items FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.trade_invoices i
    WHERE i.id = trade_invoice_items.invoice_id
      AND i.dealer_id = public.current_dealer_id()
  ));

CREATE POLICY "dealer self read own payments"
  ON public.dealer_payments FOR SELECT
  TO authenticated
  USING (dealer_id = public.current_dealer_id());

CREATE POLICY "dealer self read own cheques"
  ON public.cheques FOR SELECT
  TO authenticated
  USING (dealer_id = public.current_dealer_id());