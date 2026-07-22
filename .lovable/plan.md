
# Fechamento do MFA obrigatório

Objetivo: sair do estado "meio implantado" e deixar o MFA administrativo totalmente funcional, testado e ativável em modo enforcement com período oficial de 7 dias. **A ativação do enforcement só acontece no último passo, após todos os testes aprovados.**

## 1. Auditoria do que já existe

Já temos:
- Tabelas `admin_mfa_policy` e `admin_mfa_audit` com RLS.
- RPCs `get_admin_mfa_status()`, `require_admin_aal2()`, `assert_aal2()`, `log_mfa_event()`, trigger `admin_mfa_policy_guard`.
- Hook `use-admin-mfa.ts`, componentes `MfaEnrollDialog`, `MfaChallengeDialog`, `AdminMfaBanner`.
- Rotas `/admin/mfa` (self-service), `/admin/mfa-politica` (superadmin), `/admin/mfa-recuperacao` (superadmin).
- Server functions `adminMfaRecoverUser` e `adminMfaSetPolicy` em `src/lib/admin-mfa.functions.ts`.
- Gate no `_authenticated/route.tsx` redirecionando admins expirados para `/admin/mfa`.
- `require_admin_aal2()` já aplicado em: `admin_anonymize_profile`, `admin_log_purge_action`, `admin_mfa_policy_guard`.

Faltando (o que esta rodada fecha):
- Cobertura incompleta de `require_admin_aal2()` em RPCs sensíveis (LGPD delete, revogação de sessão, terms publish, backups, gerador de performance admin, criação/promoção de admin, etc.).
- Gate de UI sem checagem de `currentLevel` via `getAuthenticatorAssuranceLevel()` — hoje só olha `has_verified_factor`.
- Banner sem contagem regressiva com data/hora exatas do fim do prazo.
- Bloqueio "hard" após expiração cobre apenas `/admin/*` — precisa cobrir toda a área administrativa (LGPD, conformidade, gerador de performance, MFA-política, MFA-recuperação).
- Enforcement do challenge aal1→aal2 antes de operações sensíveis no frontend (hoje o backend recusa, mas o usuário não é levado ao challenge automaticamente).
- Testes ponta a ponta ainda não executados.
- Política não ativada (enforcement_started_at = NULL).

## 2. Ordem de execução

1. **Migração SQL** — endurecer o backend antes de tocar em UI:
   - Ampliar `require_admin_aal2()` para checar cumulativamente: usuário autenticado, papel admin, conta não bloqueada (`auth.users.banned_until`), política vigente. Continua falhando de forma segura (raise exception, sem vazar códigos/tokens).
   - Nova RPC `admin_revoke_user_sessions(_target_user_id, _justificativa)` com `require_admin_aal2()` + log em `admin_mfa_audit` (chamada por edge-side; a revogação real acontece via `supabaseAdmin.auth.admin.signOut` numa server fn).
   - Nova RPC `admin_publish_terms_version(...)` protegida por `require_admin_aal2()` (se ainda não existir, wrap do insert em `terms_versions`).
   - Adicionar `PERFORM public.require_admin_aal2();` em: `admin_list_users`, `admin_list_terms_conformidade`, qualquer função `SECURITY DEFINER` administrativa que hoje só cheque `has_role(_, 'admin')`.
   - Nova RPC `admin_mfa_start_enforcement(_grace_days int default 7)` que só um admin com aal2 pode chamar; grava `enforcement_started_at = now()` e emite evento `policy_changed` + `enforcement_started`. Deadline = `enforcement_started_at + grace_period_days`.
   - Novo enum value `enforcement_started` em `admin_mfa_event` se ainda não existir.
   - Garantir que `admin_mfa_audit` não permite UPDATE nem DELETE (RLS somente INSERT/SELECT para admin).

2. **Server functions** (`src/lib/admin-mfa.functions.ts`):
   - `adminMfaSetPolicy` passa a exigir aal2 (chamando a RPC nova, não gravando direto).
   - `adminMfaRecoverUser`: além de remover fator, chamar `supabaseAdmin.auth.admin.signOut(userId, 'global')` para revogar sessões, exigir `justificativa` mínima de 10 chars, exigir aal2 do caller, logar `mfa_recovered` + `sessions_revoked` + `enrollment_required`.
   - Nova `adminStartMfaEnforcement({ graceDays })` para o botão "Ativar enforcement".

3. **Gate de autenticação** (`src/routes/_authenticated/route.tsx` + hook):
   - Ler `getAuthenticatorAssuranceLevel()` no client e expor `currentLevel`/`nextLevel` via `useAdminMfa`.
   - Se admin && sem fator && prazo expirado → forçar `/admin/mfa` (já existe).
   - Se admin && fator verificado && `currentLevel==='aal1'` e rota em lista de rotas sensíveis (`/admin/lgpd`, `/admin/mfa-politica`, `/admin/mfa-recuperacao`, `/admin/conformidade`, `/admin/gerador-performance` quando operação admin) → abrir `MfaChallengeDialog` automaticamente e bloquear conteúdo até promover a sessão.

4. **Banner** (`AdminMfaBanner.tsx`):
   - Exibir data/hora exatas do fim do prazo (persistida no backend, não relógio do browser — usar `deadline` que vem de `get_admin_mfa_status`).
   - Contagem regressiva em dias/horas.
   - Botões "Configurar agora" e "Lembrar no próximo login" durante o prazo.
   - Após expirar: remover botão de adiamento, forçar enrollment.
   - Primeiro login após ativação da política mostra o aviso obrigatório (texto exato do briefing) em modal, uma vez por sessão.

5. **Enrollment/Challenge** — auditar dialogs existentes para garantir:
   - Nada de secret/QR/código/token é persistido nem logado.
   - Após `verify`, chamar `supabase.auth.refreshSession()` e reconfirmar `aal2`.
   - Registrar eventos `enroll_started`, `enroll_completed`, `enroll_abandoned`, `challenge_started`, `challenge_verified`, `challenge_failed` via `log_mfa_event`.

6. **Testes ponta a ponta** — script Playwright em `/tmp/browser/mfa/`:
   - Criar conta admin de teste (via `supabaseAdmin` num script) — não afetar admins reais.
   - Rodar cenários críticos: enrollment por QR + manual, código correto/incorreto/expirado, refresh no meio, challenge aal1→aal2, tentativa de RPC LGPD com aal1 (deve falhar), recuperação por superadmin, sessão revogada, re-enroll, tentativa de admin comum remover próprio fator (deve falhar), usuário comum sem MFA acessando `/admin/*` (deve ser negado sem exigir MFA).
   - Documentar resultado de cada caso.

7. **Ativação controlada**:
   - Só depois dos testes aprovados, superadmin clica em "Iniciar período de adaptação (7 dias)" em `/admin/mfa-politica`.
   - Sistema grava `enforcement_started_at = now()`, deadline = +7d.
   - Banner e gate passam a usar essas datas persistidas.

8. **Security scan** — rodar `security--run_security_scan`, tratar findings críticos ligados a MFA/RLS/edge/segredos. Ignorar (com justificativa) o resto para não expandir o escopo.

## 3. Fora do escopo desta rodada

Explicitamente não faremos agora: e-mail de aviso (a menos que a infra já pronta permita sem escopo novo), resumo ampliado em /admin/conformidade, relatório semanal, BI, parser, Kanban, Forms, auditoria de PDFs antigos.

## 4. Entrega final

Ao terminar, respondo com o checklist do item 14 do briefing: o que existia, o que foi corrigido, o que foi criado, RPCs protegidas, políticas RLS alteradas, data de início e fim do período (se ativado), resultado individual dos testes, eventos gravados em `admin_mfa_audit`, resultado do security scan, limitações e confirmação de que usuários comuns não foram impactados.

## Detalhes técnicos (para referência)

- Todas as novas RPCs administrativas: `LANGUAGE plpgsql SECURITY DEFINER SET search_path = public`, com `PERFORM public.require_admin_aal2();` como primeira linha após validar `has_role`.
- `admin_mfa_audit`: policies existentes já são INSERT/SELECT-only; confirmar ausência de UPDATE/DELETE policy e negar explicitamente (`REVOKE UPDATE, DELETE ON public.admin_mfa_audit FROM authenticated`).
- Gate de rota sensível é lista whitelist no client E `require_admin_aal2()` no backend — defesa em profundidade, sem depender só do frontend.
- `useAdminMfa` recebe um `refreshAAL()` para chamar após verify; router invalida em `USER_UPDATED`.

Pronto para começar pela migração SQL assim que você aprovar.
