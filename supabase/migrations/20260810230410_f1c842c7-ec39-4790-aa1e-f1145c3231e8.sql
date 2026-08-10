REVOKE SELECT ON public.manuais FROM anon;
GRANT SELECT (id, slug, titulo, descricao, tipo, conteudo, pdf_path, publicado, created_at, updated_at) ON public.manuais TO anon;