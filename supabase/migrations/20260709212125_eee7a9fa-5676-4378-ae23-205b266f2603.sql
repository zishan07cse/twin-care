
-- Admin-only storage.objects policies for db-backups bucket
CREATE POLICY "Admins read backups"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'db-backups' AND (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin')));

CREATE POLICY "Admins insert backups"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'db-backups' AND (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin')));

CREATE POLICY "Admins delete backups"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'db-backups' AND (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin')));

-- Helpful index for audit log browsing
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON public.audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_table_name ON public.audit_log (table_name, created_at DESC);
