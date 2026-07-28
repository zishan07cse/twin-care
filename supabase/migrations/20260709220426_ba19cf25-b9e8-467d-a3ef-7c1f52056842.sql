-- Add lifecycle tracking columns to enrollments
ALTER TABLE public.patient_enrollments
  ADD COLUMN IF NOT EXISTS renewed_from_enrollment_id uuid REFERENCES public.patient_enrollments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS closure_type text,
  ADD COLUMN IF NOT EXISTS closure_reason text,
  ADD COLUMN IF NOT EXISTS closed_at timestamptz,
  ADD COLUMN IF NOT EXISTS closed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.patient_enrollments
  DROP CONSTRAINT IF EXISTS enrollments_closure_type_check;
ALTER TABLE public.patient_enrollments
  ADD CONSTRAINT enrollments_closure_type_check
  CHECK (closure_type IS NULL OR closure_type IN ('renewed','completed','dropped'));

CREATE INDEX IF NOT EXISTS idx_enrollments_end_date ON public.patient_enrollments(end_date);
CREATE INDEX IF NOT EXISTS idx_enrollments_closure_type ON public.patient_enrollments(closure_type);
