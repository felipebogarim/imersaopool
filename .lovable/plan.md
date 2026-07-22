
# MFA obrigatório para administradores

Implementação completa em fases. Nada é ativado como bloqueio até que enrollment, challenge, verify, recuperação e auditoria estejam validados. Depois disso, inicia-se automaticamente o período de adaptação de 7 dias.

## Fase 1 — Base de dados e auditoria

Nova tabela `admin_mfa_policy` (linha única, singleton):
- `enforcement_started_at timestamptz` — marca o início dos 7 dias.
- `grace_period_days int default 7`.
- `enforcement_deadline timestamptz` (gerada).
- `created_by`, timestamps.

Nova tabela `admin_mfa_audit` (histórico imutável, RLS somente admins podem ler; escrita via SECURITY DEFINER):
- `user_id`, `actor_id`, `event_type` (enum), `metadata jsonb`, `created_at`.
- Eventos: `enroll_started`, `enroll_completed`, `enroll_abandoned`, `verify_failed`, `challenge_completed`, `admin_blocked_no_mfa`, `factor_removed_admin`, `recovery_executed`, `enroll_after_recovery`, `deadline_changed`, `policy_changed`, `admin_op_rejected_aal1`.
- Nunca grava: secret TOTP, QR, código, tokens, senha, service key.

Nova função `public.get_admin_mfa_status()` (SECURITY DEFINER):
- Retorna `{ is_admin, has_verified_factor, deadline, days_left, must_enroll_now, grace_active }`.
- Fonte da verdade de "é admin" = `has_role(auth.uid(),'admin')` + `is_admin_or_gestor`.

Nova função `public.assert_aal2()` (SECURITY DEFINER + STABLE):
- Lê `auth.jwt() -> 'aal'` do claim.
- Retorna boolean; usada em RPCs sensíveis e políticas RLS.

Nova função `public.log_mfa_event(event_type, target_user, metadata)` SECURITY DEFINER.

## Fase 2 — RLS + RPC enforcement (aal2)

Adiciona cláusula `AND public.assert_aal2()` (ou nova policy dedicada) nas operações sensíveis já existentes:
- `data_purge_requests` (INSERT/UPDATE)
- `backup_config`, `backup_jobs`, `backup_historico`, `backup_auditoria`
- `security_settings`, `security_incidents`, `security_risks`, `security_audits`
- `terms_versions` (INSERT/UPDATE — publicar nova versão)
- `user_roles` (INSERT/UPDATE/DELETE — promover admins)
- `entity_permissions`

RPCs SECURITY DEFINER passam a exigir aal2 no topo:
- `admin_anonymize_profile`, `admin_log_purge_action`, `admin_list_terms_conformidade`, `admin_list_users`
- Nova `admin_remove_mfa_factor(_target_user_id, _password_confirm, _justificativa)` — chama `auth.admin` via Edge? Não: usa a Auth Admin API pelo `supabaseAdmin` dentro de um serverFn. Exige reautenticação por senha do superadmin, aal2, justificativa >= 10 chars. Registra em `admin_mfa_audit` + revoga sessões do alvo (`auth.admin.signOut`).

ServerFns que carregam `supabaseAdmin` recebem checagem obrigatória de aal2 do chamador antes de qualquer operação.

Rotas `/api/public/*` de backup passam a exigir header assinado (já assinado por cron); operações interativas de backup passam por serverFn com aal2.

## Fase 3 — Fluxo TOTP (frontend)

Componentes novos:
- `src/components/mfa/MfaEnrollDialog.tsx` — enroll → QR + secret manual → challenge → verify. Nada persistido no cliente além do factorId temporário.
- `src/components/mfa/MfaChallengeDialog.tsx` — quando `nextLevel==='aal2'` e `currentLevel==='aal1'`, pede código e chama `challenge()` + `verify()`.
- `src/components/mfa/AdminMfaBanner.tsx` — aviso obrigatório em cada login durante o grace period. Título/textos exatos do briefing, com "CONFIGURAR AGORA" (abre enroll) e "LEMBRAR NO PRÓXIMO LOGIN" (dismiss só nesta sessão).
- `src/routes/_authenticated/admin/mfa.tsx` — página dedicada para gerenciar fatores (ver fatores, adicionar segundo TOTP de contingência, remover próprio fator só se não-admin).

Hook `useAdminMfaGate()`:
- Chama `supabase.auth.mfa.getAuthenticatorAssuranceLevel()` + `get_admin_mfa_status()`.
- Retorna `{ mustChallenge, mustEnrollNow, showBanner, deadline, daysLeft }`.
- Reavalia em mudança de rota, foco de janela, `onAuthStateChange`.

Integração em `src/routes/_authenticated/route.tsx`:
- Depois do bloco de termos, chama o gate:
  - `mustChallenge` → força `MfaChallengeDialog` modal (não permite navegação).
  - `mustEnrollNow` (admin sem fator + prazo vencido) → redirect `/admin/mfa`.
  - `showBanner` (admin sem fator, grace ativo) → `<AdminMfaBanner />` no `AppShell`.
  - Usuário comum → nada muda.

## Fase 4 — Recuperação

- Página `/admin/mfa-recovery` restrita a admin.
- Server function `recoverAdminMfa({ target_user_id, password, justification })`:
  - `requireSupabaseAuth` + `assert_aal2` no chamador.
  - Re-verifica senha do superadmin (`signInWithPassword` num client isolado, descartado).
  - Carrega `supabaseAdmin`, lista fatores do alvo, remove todos via `auth.admin.mfa.deleteFactor`.
  - `auth.admin.signOut(target)`.
  - `log_mfa_event('recovery_executed', target, {actor, justificativa})`.
- UI lista admins, pesquisa por email, dialog de justificativa.

## Fase 5 — Ativação controlada

- Painel `/admin/mfa-policy` (super admin):
  - Estado atual (`enforcement_started_at`, `deadline`, dias restantes).
  - Botão "Iniciar período de adaptação (7 dias)" — só habilita depois que o super admin tiver enrolled e um fator verificado, e depois de um checklist:
    1. ≥1 admin com fator verificado.
    2. Fluxo de recuperação executado com sucesso em conta de teste.
    3. Nenhuma service key exposta ao frontend (verificação estática).
  - Também botão "Estender prazo" (registra `deadline_changed`).

Enquanto `enforcement_started_at IS NULL`, nenhum bloqueio ocorre — só o banner opcional para o super admin que quiser testar.

## Fase 6 — Testes e QA

Roteiro completo dos 23 cenários do briefing, executado manualmente contra o preview. Reportar resultado item a item na mensagem de entrega, com marcação PASS/FAIL.

## Detalhes técnicos

- `supabase.auth.mfa.enroll({ factorType: 'totp' })` retorna `{ id, totp: { qr_code, secret, uri } }`. Renderizamos `qr_code` (SVG data URL) e `secret`.
- `challenge({ factorId })` + `verify({ factorId, challengeId, code })`.
- Após `verify` bem-sucedido, `getSession()` reflete `aal2` no JWT; forçamos `router.invalidate()` para reavaliar gates.
- `getAuthenticatorAssuranceLevel()` é a fonte de verdade no cliente; no backend, `auth.jwt()->>'aal'` no Postgres (Supabase inclui o claim `aal`).
- Grace period calculado em SQL para evitar drift de relógio no cliente.
- Auth webhook / trigger não é necessário — status é derivado on-demand.

## Escopo fora desta rodada
- SMS/WebAuthn como segundo fator (mantemos TOTP conforme briefing).
- MFA para roles não-admin.
- Recovery codes offline (Supabase ainda não expõe API estável; o TOTP de contingência cobre o caso).

## Ordem de execução
1. Migration única com tabelas, funções, políticas aal2, seeds.
2. Frontend: hooks, dialogs, banner, rotas `/admin/mfa`, `/admin/mfa-recovery`, `/admin/mfa-policy`.
3. Server functions de recuperação e política.
4. Integração no `_authenticated/route.tsx` e `AppShell`.
5. QA manual + entrega final com checklist.

Confirma que sigo com esta ordem e escopo? Se ok, começo pela migration.
