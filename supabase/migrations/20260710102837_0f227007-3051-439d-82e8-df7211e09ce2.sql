
CREATE TABLE IF NOT EXISTS public.dealer_dunning_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  dealer_id uuid REFERENCES public.dealers(id) ON DELETE CASCADE,
  ref_table text,
  ref_id uuid,
  subject text,
  body text,
  status text NOT NULL DEFAULT 'queued',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dealer_dunning_log TO authenticated;
GRANT ALL ON public.dealer_dunning_log TO service_role;
ALTER TABLE public.dealer_dunning_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff view dunning log" ON public.dealer_dunning_log FOR SELECT TO authenticated
  USING (public.is_sales_or_staff(auth.uid()));
CREATE POLICY "Service manages dunning log" ON public.dealer_dunning_log FOR ALL TO service_role
  USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_dealer_dunning_log_dealer ON public.dealer_dunning_log(dealer_id);
CREATE INDEX IF NOT EXISTS idx_dealer_dunning_log_created ON public.dealer_dunning_log(created_at DESC);
