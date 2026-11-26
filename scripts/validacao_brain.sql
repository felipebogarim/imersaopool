-- Validação pós-migration 20261127100000_brain_comercial.sql (SOMENTE LEITURA).
-- Cole no SQL Editor do projeto hfcvrcjbzivuzfdpmzqc. Resultado: uma linha por verificação,
-- coluna "ok" deve ser true em todas.
SET TRANSACTION READ ONLY;

SELECT verificacao, ok, detalhe FROM (
  SELECT 1 AS n, 'Tabelas brain_* criadas (8)' AS verificacao,
    count(*) = 8 AS ok, string_agg(c.relname, ', ' ORDER BY c.relname) AS detalhe
  FROM pg_class c JOIN pg_namespace s ON s.oid = c.relnamespace
  WHERE s.nspname = 'public' AND c.relkind = 'r' AND c.relname IN ('brain_settings',
    'brain_role_capabilities', 'brain_conversations', 'brain_messages', 'brain_attachments',
    'brain_knowledge', 'brain_knowledge_versions', 'brain_audit')
  UNION ALL
  SELECT 2, 'RLS ligada em todas as tabelas brain_*',
    bool_and(c.relrowsecurity), string_agg(c.relname || '=' || c.relrowsecurity, ', ')
  FROM pg_class c JOIN pg_namespace s ON s.oid = c.relnamespace
  WHERE s.nspname = 'public' AND c.relkind = 'r' AND c.relname LIKE 'brain\_%'
  UNION ALL
  SELECT 3, 'block_external_rep em todas as tabelas brain_*',
    count(*) = 8, count(*)::text
  FROM pg_policies WHERE schemaname = 'public' AND tablename LIKE 'brain\_%'
    AND policyname = 'block_external_rep' AND permissive = 'RESTRICTIVE'
  UNION ALL
  SELECT 4, 'Sem escrita direta de authenticated/anon nas tabelas brain_*',
    NOT EXISTS (SELECT 1 FROM information_schema.role_table_grants
      WHERE table_schema = 'public' AND table_name LIKE 'brain\_%'
        AND grantee IN ('anon', 'authenticated') AND privilege_type <> 'SELECT'),
    (SELECT string_agg(DISTINCT grantee || ':' || privilege_type, ', ')
      FROM information_schema.role_table_grants
      WHERE table_schema = 'public' AND table_name LIKE 'brain\_%' AND grantee IN ('anon', 'authenticated'))
  UNION ALL
  SELECT 5, 'role_permissions/user_nav_permissions: só policies oficiais',
    count(*) FILTER (WHERE policyname NOT IN ('Authenticated can read role permissions',
      'Admins manage role permissions', 'Users can read own nav permissions',
      'Admins manage nav permissions', 'block_external_rep')) = 0,
    string_agg(tablename || '.' || policyname, ', ' ORDER BY tablename, policyname)
  FROM pg_policies WHERE schemaname = 'public'
    AND tablename IN ('role_permissions', 'user_nav_permissions')
  UNION ALL
  SELECT 6, 'Escrita em role_permissions só para admin',
    bool_and(cmd <> 'ALL' OR (qual LIKE '%has_role%admin%' AND with_check LIKE '%has_role%admin%')),
    string_agg(policyname || ' [' || cmd || ']', ', ')
  FROM pg_policies WHERE schemaname = 'public'
    AND tablename IN ('role_permissions', 'user_nav_permissions') AND permissive = 'PERMISSIVE'
  UNION ALL
  SELECT 7, 'anon sem acesso a role_permissions/user_nav_permissions',
    NOT EXISTS (SELECT 1 FROM information_schema.role_table_grants
      WHERE table_schema = 'public' AND table_name IN ('role_permissions', 'user_nav_permissions')
        AND grantee = 'anon'), NULL
  UNION ALL
  SELECT 8, 'Chat do representante DESLIGADO (feature flag)',
    COALESCE((SELECT valor = 'false'::jsonb FROM public.brain_settings
      WHERE chave = 'portal_representante_habilitado'), false),
    (SELECT valor::text FROM public.brain_settings WHERE chave = 'portal_representante_habilitado')
  UNION ALL
  SELECT 9, 'Capacidades: admin 9, gestor 6, gestor_comercial 6, representante só chat',
    (SELECT count(*) FROM public.brain_role_capabilities WHERE role = 'admin') = 9
      AND (SELECT count(*) FROM public.brain_role_capabilities WHERE role = 'gestor') = 6
      AND (SELECT count(*) FROM public.brain_role_capabilities WHERE role = 'gestor_comercial') = 6
      AND (SELECT array_agg(capability) FROM public.brain_role_capabilities
        WHERE role = 'representante') = ARRAY['chat'],
    (SELECT string_agg(role || ':' || n, ', ') FROM (SELECT role::text, count(*) n
      FROM public.brain_role_capabilities GROUP BY 1 ORDER BY 1) x)
  UNION ALL
  SELECT 10, 'Menu Inteligência Comercial liberado para gestor e gestor_comercial',
    count(*) = 6, string_agg(role || ':' || nav_key, ', ')
  FROM public.role_permissions
  WHERE nav_key IN ('inteligencia', 'inteligencia.chat', 'inteligencia.gestao') AND allowed
    AND role IN ('gestor', 'gestor_comercial')
  UNION ALL
  SELECT 11, 'Busca textual do conhecimento (índice GIN)',
    EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'brain_knowledge_busca_idx'), NULL
  UNION ALL
  SELECT 12, 'Expurgo por retenção instalado',
    EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'brain_purge_expired'),
    CASE WHEN EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')
      THEN 'pg_cron disponível' ELSE 'pg_cron ausente: expurgo manual' END
) v ORDER BY n;
