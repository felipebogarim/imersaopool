DROP INDEX IF EXISTS public.idx_perf_import_audit_sucesso_unico;
CREATE INDEX IF NOT EXISTS idx_perf_import_audit_lookup
  ON public.performance_import_audit (representative_id, periodo_label, file_hash, created_at DESC);