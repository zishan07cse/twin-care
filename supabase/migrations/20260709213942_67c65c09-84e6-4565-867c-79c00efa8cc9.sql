-- Ownership mode enum
DO $$ BEGIN
  CREATE TYPE public.ownership_mode AS ENUM ('free','deposit','sold');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 1) Package entitlement matrix
CREATE TABLE public.package_device_entitlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.program_plans(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.inventory_items(id) ON DELETE RESTRICT,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity >= 0),
  ownership_mode public.ownership_mode NOT NULL DEFAULT 'free',
  deposit_bdt numeric NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (plan_id, item_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.package_device_entitlements TO authenticated;
GRANT ALL ON public.package_device_entitlements TO service_role;
ALTER TABLE public.package_device_entitlements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage package entitlements" ON public.package_device_entitlements
  FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()) OR public.has_role(auth.uid(),'inventory_manager'))
  WITH CHECK (public.is_staff(auth.uid()) OR public.has_role(auth.uid(),'inventory_manager'));
CREATE TRIGGER tg_package_entitlements_touch BEFORE UPDATE ON public.package_device_entitlements
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 2) Patient entitlement snapshot
CREATE TABLE public.patient_entitlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id uuid NOT NULL REFERENCES public.patient_enrollments(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.inventory_items(id) ON DELETE RESTRICT,
  quantity_entitled integer NOT NULL DEFAULT 0,
  quantity_delivered integer NOT NULL DEFAULT 0,
  ownership_mode public.ownership_mode NOT NULL DEFAULT 'free',
  deposit_bdt numeric NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (enrollment_id, item_id)
);
CREATE INDEX ix_patient_entitlements_patient ON public.patient_entitlements(patient_id);
CREATE INDEX ix_patient_entitlements_item ON public.patient_entitlements(item_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.patient_entitlements TO authenticated;
GRANT ALL ON public.patient_entitlements TO service_role;
ALTER TABLE public.patient_entitlements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage patient entitlements" ON public.patient_entitlements
  FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()) OR public.has_role(auth.uid(),'inventory_manager'))
  WITH CHECK (public.is_staff(auth.uid()) OR public.has_role(auth.uid(),'inventory_manager'));
CREATE POLICY "Patient sees own entitlements" ON public.patient_entitlements
  FOR SELECT TO authenticated
  USING (patient_id = public.current_patient_id());
CREATE TRIGGER tg_patient_entitlements_touch BEFORE UPDATE ON public.patient_entitlements
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 3) Extra issuances (over-entitlement approvals)
CREATE TABLE public.extra_issuances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.inventory_items(id) ON DELETE RESTRICT,
  quantity integer NOT NULL CHECK (quantity > 0),
  reason text NOT NULL,
  chargeable boolean NOT NULL DEFAULT false,
  amount_bdt numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','consumed')),
  requested_by uuid,
  approved_by uuid,
  approved_at timestamptz,
  assignment_id uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_extra_issuances_patient ON public.extra_issuances(patient_id);
CREATE INDEX ix_extra_issuances_status ON public.extra_issuances(status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.extra_issuances TO authenticated;
GRANT ALL ON public.extra_issuances TO service_role;
ALTER TABLE public.extra_issuances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage extra issuances" ON public.extra_issuances
  FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()) OR public.has_role(auth.uid(),'inventory_manager'))
  WITH CHECK (public.is_staff(auth.uid()) OR public.has_role(auth.uid(),'inventory_manager'));
CREATE TRIGGER tg_extra_issuances_touch BEFORE UPDATE ON public.extra_issuances
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Link assignment -> extra_issuance for override traceability
ALTER TABLE public.inventory_assignments
  ADD COLUMN IF NOT EXISTS extra_issuance_id uuid REFERENCES public.extra_issuances(id) ON DELETE SET NULL;

-- FK back from extra_issuances -> assignment (deferred to avoid circular problems)
ALTER TABLE public.extra_issuances
  ADD CONSTRAINT extra_issuances_assignment_fk
  FOREIGN KEY (assignment_id) REFERENCES public.inventory_assignments(id) ON DELETE SET NULL;

-- Snapshot entitlements on enrollment
CREATE OR REPLACE FUNCTION public.tg_snapshot_entitlements()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  INSERT INTO public.patient_entitlements
    (enrollment_id, patient_id, item_id, quantity_entitled, ownership_mode, deposit_bdt)
  SELECT NEW.id, NEW.patient_id, e.item_id, e.quantity, e.ownership_mode, e.deposit_bdt
  FROM public.package_device_entitlements e
  WHERE e.plan_id = NEW.plan_id
  ON CONFLICT (enrollment_id, item_id) DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER tg_enrollments_snapshot_entitlements
  AFTER INSERT ON public.patient_enrollments
  FOR EACH ROW EXECUTE FUNCTION public.tg_snapshot_entitlements();

-- Validate assignment against entitlement (and increment delivered)
CREATE OR REPLACE FUNCTION public.tg_assignment_validate_entitlement()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_ent public.patient_entitlements%ROWTYPE;
  v_remaining integer;
BEGIN
  SELECT pe.* INTO v_ent
  FROM public.patient_entitlements pe
  JOIN public.patient_enrollments en ON en.id = pe.enrollment_id
  WHERE pe.patient_id = NEW.patient_id
    AND pe.item_id = NEW.item_id
    AND en.status IN ('active','paused')
  ORDER BY en.created_at DESC
  LIMIT 1;

  IF NEW.extra_issuance_id IS NOT NULL THEN
    PERFORM 1 FROM public.extra_issuances ei
    WHERE ei.id = NEW.extra_issuance_id
      AND ei.status IN ('approved','consumed')
      AND ei.patient_id = NEW.patient_id
      AND ei.item_id = NEW.item_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Extra issuance is not approved for this patient / item';
    END IF;
  ELSIF v_ent.id IS NOT NULL THEN
    v_remaining := v_ent.quantity_entitled - v_ent.quantity_delivered;
    IF NEW.quantity > v_remaining THEN
      RAISE EXCEPTION 'Assignment quantity % exceeds remaining entitlement % — request an admin-approved extra issuance to override.', NEW.quantity, v_remaining;
    END IF;
    UPDATE public.patient_entitlements
       SET quantity_delivered = quantity_delivered + NEW.quantity
     WHERE id = v_ent.id;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER tg_assignments_validate_entitlement
  BEFORE INSERT ON public.inventory_assignments
  FOR EACH ROW EXECUTE FUNCTION public.tg_assignment_validate_entitlement();

-- When assignment is linked to an approved extra_issuance, mark it consumed
CREATE OR REPLACE FUNCTION public.tg_extra_issuance_consume()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.assignment_id IS NOT NULL AND OLD.assignment_id IS DISTINCT FROM NEW.assignment_id
     AND NEW.status = 'approved' THEN
    NEW.status := 'consumed';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER tg_extra_issuance_consume_row
  BEFORE UPDATE ON public.extra_issuances
  FOR EACH ROW EXECUTE FUNCTION public.tg_extra_issuance_consume();