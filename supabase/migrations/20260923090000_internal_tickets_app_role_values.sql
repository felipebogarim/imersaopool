-- Módulo "Solicitações Internas" — Fase 1: novos papéis.
--
-- Em transação separada da que os usa (mesmo padrão da migration
-- 20260716171516, que adicionou 'comercial'): o Postgres não permite usar um
-- valor de enum recém-adicionado na mesma transação que o cria.
--
-- gestor_comercial é um papel NOVO, distinto do 'gestor' já existente:
-- 'gestor' já é tratado como elevado em is_admin_or_gestor() e em políticas
-- de outros módulos (ex.: kanban). Reaproveitá-lo para "Gestor Comercial"
-- daria a essa pessoa acesso elevado em áreas do sistema fora do escopo de
-- Solicitações Internas — por isso um papel dedicado.
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'gestor_comercial';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'diretoria';
