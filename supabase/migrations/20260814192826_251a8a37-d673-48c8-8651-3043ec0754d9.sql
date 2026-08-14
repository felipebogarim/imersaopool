
ALTER TABLE public.gerador_performance_salvos ADD COLUMN categoria_metas JSONB;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gerador_performance_salvos TO authenticated;
GRANT ALL ON public.gerador_performance_salvos TO service_role;
