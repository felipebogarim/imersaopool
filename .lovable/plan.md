# Rodada 2 — Blindagem de Privacidade e Conformidade

Quatro frentes independentes. Vou executar em 4 fases, cada uma com verificação antes da seguinte.

## Fase 1 — Auditoria técnica + frase absoluta sobre admins

**Objetivo:** garantir que nenhum humano (inclusive admin) enxerga valores brutos de metas/vendas, e então trocar a frase condicional dos Termos pela absoluta.

Varredura e correção:
- RLS de `rep_performance_uploads`, `rep_performance_rows`, `client_bi_uploads`, `rep_bi_uploads`, `gerador_performance_salvos`, `perf_acoes_sugeridas`: revogar SELECT direto de colunas monetárias para todo humano; leitura só via RPCs `SECURITY DEFINER` que retornam percentuais/faróis.
- Mover qualquer coluna monetária residual em tabelas `public` para o schema `performance_private` (se ainda houver). Confirmar via `information_schema.columns`.
- Revogar EXECUTE de RPCs que retornam valores brutos para `authenticated` e `anon`; manter apenas `service_role` + funções compute que devolvem só %.
- Exports (PDF/XLSX do gerador, do BI, das ações sugeridas): auditar o código e garantir que nenhum caminho lê `performance_private.*` para renderizar na UI.
- Logs (`security_events`, `email_send_log`, edge/worker logs): validar que payloads não incluem valores monetários.
- `admin_list_users`, `admin_list_terms_conformidade`, painéis admin: revisar colunas retornadas — nenhuma numérica financeira.

Após verificação, atualizar o texto v1.1 dos Termos com a **frase absoluta**: publica nova versão em `terms_versions`, marca v1.0 como inativa, força reaceite de todos.

## Fase 2 — MFA obrigatório para admins

- Habilitar TOTP no Supabase Auth (`configure_auth`).
- Página `/mfa/setup` (QR code + verificação) usando `supabase.auth.mfa.enroll/challenge/verify`.
- Gate no `_authenticated/route.tsx`: se `has_role(user, 'admin')` e `aal !== 'aal2'`, redirecionar para `/mfa/setup` (enrollment) ou `/mfa/challenge` (verificação por sessão).
- Bloquear rotas `/admin/*` server-side: middleware `requireAdminAAL2` em cada server fn admin (verifica `context.claims.aal === 'aal2'`).
- Painel de conformidade mostra status MFA por admin.

## Fase 3 — Marca d'água nas telas sensíveis

- Componente `<Watermark />`: overlay `pointer-events-none` `fixed inset-0 z-[9999]` com email do usuário + timestamp + IP hash, repetido em grid diagonal, opacidade ~7%.
- Aplicar em: `/representantes/performance`, `/clientes-bi/*`, `/admin/gerador-performance`, `/admin/conformidade`, `/admin/auditoria-seguranca`, resposta da IA em BI.
- Registrar evento `watermark_view` em `security_events` na entrada de cada tela sensível (frequência limitada — 1x por sessão por rota).

## Fase 4 — Revogação de acesso + expurgo LGPD

Banco:
- Tabela `data_purge_requests` (solicitante, alvo, tipo: `revoke_sessions` | `anonymize` | `delete`, status, motivo, executor, data).
- Tabela `revoked_sessions` (user_id, revoked_at, motivo).
- Função `admin_revoke_user_sessions(user_id)` → chama Supabase Auth Admin API para deslogar todas sessões (via `supabaseAdmin.auth.admin.signOut`).
- Função `admin_anonymize_user(user_id)`: substitui email/nome em `profiles`, marca `deleted_at`, mantém FK.
- Função `admin_delete_user_data(user_id)`: expurgo em cascata (respostas de forms, ações sugeridas, cards Kanban criados, uploads); registrado em `security_events`.

UI `/admin/lgpd`:
- Lista de usuários com ações: **Revogar sessões**, **Anonimizar**, **Excluir dados** (cada uma exige senha do gestor + justificativa obrigatória).
- Lista pública `privacy_requests` (já existe) integrada — solicitações vindas de titulares.
- Histórico imutável de expurgos.

## Detalhes técnicos

- Todas migrações seguem GRANT explícito, RLS, `search_path=public`, `SECURITY DEFINER` só onde necessário com REVOKE de anon/authenticated quando aplicável.
- MFA: `configure_auth` não expõe TOTP toggle direto — verificar com `supabase--project_info`; se não, orientar via dashboard. Fallback: exigir reautenticação recente (`aal1` + timestamp < 15min) em rotas admin sem MFA.
- Marca d'água: hash do IP calculado server-side via server fn `get_watermark_token` para evitar expor IP no bundle.
- Expurgo: `supabaseAdmin.auth.admin.deleteUser` para exclusão total; cascade FK já cobre a maioria das tabelas.

## Ordem de execução

1. Fase 1 (auditoria + v1.1 Termos) — impacta todos usuários (reaceite obrigatório).
2. Fase 2 (MFA) — impacta só admins.
3. Fase 3 (marca d'água) — puramente visual, sem migração.
4. Fase 4 (LGPD) — nova área admin.

Cada fase termina com verificação antes de seguir. Confirma para começar pela Fase 1?
