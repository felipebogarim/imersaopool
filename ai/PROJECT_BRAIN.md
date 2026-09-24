# PROJECT BRAIN

## 1. Product

- **Name:** PoolFlux Imersões Comerciais.
- **Objective:** Prepare, conduct, and analyze commercial immersions, including strategic diagnostics and related sales workflows.
- **Stage:** Active application with many implemented modules; this repository does not establish a release status.

## 2. Stack

- **Frontend:** React 19, TypeScript, TanStack Router/Start, TanStack Query, Vite, Tailwind CSS 4, Radix UI.
- **Backend:** TanStack Start server routes/functions and Supabase services.
- **Database:** Supabase Postgres with versioned migrations and Row Level Security (RLS) policies.
- **Infrastructure:** Lovable-connected project; `@lovable.dev/vite-tanstack-config` supplies the Vite, Start, Nitro, Tailwind, and path-alias setup.

## 3. Architecture

- Routes live in `src/routes`; `src/routes/__root.tsx` is the root shell and `src/routes/_authenticated/route.tsx` gates signed-in pages. `src/routeTree.gen.ts` is generated.
- Feature UI lives in `src/components`; reusable logic and server functions live in `src/lib`; Supabase clients and auth middleware live in `src/integrations/supabase`.
- Database changes live in `supabase/migrations`. Public HTTP handlers live under `src/routes/api/public`; assess each handler's authentication separately.
- Follow `src/routes/README.md` for TanStack file-route conventions. Do not add plugins already supplied by the Lovable Vite config.

## 4. Current State

- Implemented areas include immersions, interviews, clients, representatives, performance and BI, product/pricing views, tasks, forms, messaging, admin/security, and trade agendas.
- **BI Diretor / Principais Frentes:** A read-only executive view of existing `kanban_cards`, selected by `metadata.show_in_director_bi`; never copy actions into a separate store. Categories follow the existing Comercial, Governança, Marketing and Produto boards. Responsible/representative links remain in card metadata, stage comes from the Kanban list, and progress comes from checklists. Completion uses `completed_at` or the existing Concluído/Concluída list; when that list has no completion timestamp, sorting falls back to `updated_at`. Queries retain RLS and include unarchived workspace/board/list/cards belonging to the active company or to accessible workspaces with null `company_id` (the existing workspace creation flow does not require a company); exclude workspaces explicitly assigned to another company. The view refreshes on mount/focus and every 15 seconds; details open the original Kanban card. Duplicating a card does not inherit its executive selection.
- **BI Diretor / Reps:** Representative follow-up fields are persisted in `director_rep_notes`, one row per representative and scoped to the active company. The view uses a sticky searchable representative picker and shows one representative at a time, with a responsive desktop table/mobile detail card. Authenticated company users may read the data; only the signed-in master account `felipe@poolbranding.com.br` may edit or clear all follow-up fields from the row kebab, enforced by UI visibility and RLS using the signed JWT email. Migration `20260924120000` was applied manually and validated in the real Lovable Cloud database: the table, RLS policies and update trigger are active, and the PostgREST schema cache was reloaded. Do not reapply this migration. The UI fallback that keeps the representative picker available and disables editing while the table is temporarily absent remains intentional for future deployment windows.

- **Solicitações Internas (módulo completo, código commitado/pushado em `orca-dev`; migrations aplicadas parcialmente no Supabase real do usuário — confirmado ao vivo faltando pelo menos a 10ª, `sector_stops` [`Could not find the table 'public.internal_ticket_sector_stops'`]; aplicar em ordem, ver `internal-tickets-setup.md`):** `createInternalTicket` agora bloqueia a criação do ticket (não só o envio) quando o setor não tem destinatário principal ativo — antes só `sendInternalTicket` checava isso, deixando um ticket "aberto" órfão pra trás quando faltava destinatário. Resolução de destinatário é uma função pura testada (`recipients.ts`, `resolveSectorRecipients`) usada tanto no preview client-side de Novo Ticket (`RecipientsPreview`, aparece ao escolher o Setor) quanto espelhada na query do servidor — **as duas têm que ficar em sync manualmente**, não são a mesma chamada. **Decisão tomada: um único principal ativo por setor** (índice único parcial `internal_ticket_sector_people_one_principal_idx`, `WHERE is_primary_recipient AND active`, migration `180000`). `upsertInternalTicketSectorPerson` desmarca automaticamente o principal anterior do setor ao salvar um novo — o índice é só rede de segurança contra corrida, não o caminho normal; `setInternalTicketSectorPersonActive` (reativar) não faz esse swap, só devolve erro amigável se colidir (dirige pro fluxo de editar). módulo de tickets do Comercial pra outros setores. Schema `internal_ticket_*`, setores/pessoas/categorias globais (CRUD com excluir + inativar — excluir usa `ON DELETE` do Postgres: setor/categoria com qualquer ticket vinculado, atual ou histórico via `sector_stops`, é bloqueado com mensagem amigável; excluir setor cai em cascata sobre as pessoas dele, avisado na confirmação), tickets por `company_id`. Papéis novos em `app_role`: `gestor_comercial`, `diretoria` (read-only) — toda nav_key nova exige seed explícito em `role_permissions`. E-mail desacoplado usa **Resend**; `INTERNAL_TICKETS_EMAIL_MODE=mock` pro `FakeEmailProvider` sem credencial. UI: `/solicitacoes/admin` (só admin, aninhado no menu "Solicitações Internas"), `/solicitacoes/novo`, `/solicitacoes` (lista), `/solicitacoes/$ticketId` (Detalhe: status, encaminhar setor, timeline de setor com duração+status por parada, interação manual, anexos, timeline geral), `/solicitacoes/dashboard`. Webhook `/api/public/internal-tickets/resend-webhook` (Svix oficial; payload inbound assumido, não confirmado). Setor tem histórico real (`internal_ticket_sector_stops`, `reassignInternalTicketSector`) — `sector_id` na tabela principal é só cache do atual. Produtos são N:N (`internal_ticket_products`, `MultiSelectCombobox` com busca no Novo Ticket) — mesma lição do sector_id: nunca duplicar como cache single-value. Revisão de segurança: INSERT de eventos/mensagens/paradas de setor no caminho autenticado restrito por `origin`+`author_user_id/moved_by = auth.uid()`; só service_role grava origin='sistema'/'email'/'acao_publica'. Risco aceito: RLS não impede `PATCH` fora do grafo de `canTransition` (validado só na aplicação). **Exclusão definitiva de ticket** (`deleteInternalTicket`, kebab na Lista) só pra `MASTER_EMAIL` (`felipe@poolbranding.com.br`, `nav-tree.ts` — reaproveitado, não duplicado); sem policy de DELETE em `internal_tickets` pra authenticated, grava via `supabaseAdmin` depois de conferir o e-mail (busca em `profiles`, não confia em claim de sessão). Todas as tabelas filhas têm `ON DELETE CASCADE` em `ticket_id`, exceto os arquivos do bucket de anexos, que ficam órfãos no Storage (limpeza não implementada).
  - **Criação atômica autenticada:** a migration incremental `20260923210000` adiciona `internal_ticket_create_atomic_authenticated`, executável somente por `authenticated`, sem alterar a RPC service-role antiga durante a implantação sem ruptura. Identidade vem de `auth.uid()`, empresa de `current_company_id()`, e autorização, tenant, SLA, destinatários e outbox são validados/derivados no PostgreSQL; esse fluxo não usa `supabaseAdmin` nem `SUPABASE_SERVICE_ROLE_KEY`. A RPC antiga só deve ser removida em migration posterior, após todos os runtimes migrarem. Operações sem sessão (webhooks, jobs, ações públicas e demais rotas administrativas) permanecem privilegiadas e fora dessa decisão.
  - **Envio autenticado do ticket:** a migration incremental `20260923220000` adiciona RPCs estreitas `prepare/success/failure`, executáveis somente por `authenticated`, para o envio iniciado pelo usuário funcionar sem service role. `prepare` valida empresa, acesso e papel, devolve somente o payload necessário e reivindica a tentativa com token/lease; `success` confirma outbox + transição `aberto → enviado` + evento de sistema atomicamente; `failure` marca somente a outbox. O provider (mock ou Resend) fica entre essas RPCs e usa a mesma chave idempotente. Webhooks/inbound e outras operações sem sessão continuam fora desse fluxo.
  - **Contrato de entrega do e-mail inicial:** `prepare` deriva server-side `recipient_name` de `internal_ticket_recipients.name_snapshot` do principal e `requester_email` preferencialmente de `profiles.email`, usando `auth.users.email` como fallback. O CC consolida as cópias persistidas com o solicitante, deduplica sem diferenciar caixa e exclui qualquer endereço presente em TO; cliente nenhum fornece essas identidades.
  - **Reply-to de tickets:** use `r+<UUID sem hífens>.<HMAC-SHA256 truncado em 24 hex>@<domínio>` (local-part de 59 caracteres). Builder e parser devem permanecer simétricos; o parser reconstrói o UUID canônico e compara a assinatura de 96 bits com `timingSafeEqual`.
  - **Arquitetura EMAIL-FIRST:** Receiving usa o webhook público Resend com assinatura Svix sobre o corpo bruto e recupera conteúdo/anexos pela API oficial. O alias HMAC, e não subject/ticket_id do payload, identifica o ticket. `internal_ticket_recipients` continua snapshot da abertura; `internal_ticket_participants` mantém o universo operacional dinâmico. `directRecipients=(TO+CC)-endereços técnicos` e relays individuais vão somente a participantes ativos menos remetente e destinatários diretos. Resend `email_id`, eventos Svix, mensagens e relays por destinatário têm unicidade permanente e leases no banco. Remetente desconhecido, autoresposta ou loop do sistema fica em quarentena e não gera relay.
  - **SLA e decisão formal EMAIL-FIRST:** somente mensagem do principal atual preenche primeira resposta/SLA e move `enviado/recebido_pelo_setor` para `em_analise` (rótulo Em andamento). Texto pode gerar sinais derivados, inclusive provável conclusão, mas nunca muda status. Indicação formal move para `aguardando_validacao`; magic links de solicitante, vinculados ao usuário, expiráveis e de uso único, concluem ou reabrem em uma RPC transacional que invalida o link irmão.
  - **Anexos inbound:** ficam no bucket privado existente, limitados a 20 MB, vinculados à mensagem por ID do provider e registrados mesmo quando o download falha. Conteúdo original é preservado; somente `body_html_sanitized` pode ser renderizado. `scan_status=not_scanned` é explícito até existir antivírus, portanto não servir arquivos como conteúdo confiável.
  - **Gotcha de build (vale pra qualquer dependência futura):** `sanitize-html` quebra o `npm run build` deste projeto (Vite 8 + rolldown resolve `entities/decode` pra cópia raiz do pacote em vez da aninhada em `sanitize-html/node_modules`, que tem versão diferente sem esse subpath export). Trocado por `isomorphic-dompurify` (validado). Se uma lib nova quebrar o build com `UNLOADABLE_DEPENDENCY`, suspeitar do mesmo padrão antes de investigar a lib.
  - **Este projeto usa `bun` (lockfile `bun.lock`), não `npm`** — havia um commit removendo o `package-lock.json` como "legado". Instalar dependência com `npm install` recria um `package-lock.json` órfão sem atualizar `bun.lock`; sempre `bun install` depois (ou usar `bun add` direto).
  - Ativação EMAIL-FIRST permanece manual: aplicar migrations `20260924160000`–`190000`, publicar o runtime com os secrets server-side já previstos, configurar MX/Receiving e cadastrar o webhook `email.received` no Resend. Não ativar antes de teste real controlado de Reply/Reply All. Env vars sem valor real no repositório: `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`, `INTERNAL_TICKETS_REPLY_SECRET`, `INTERNAL_TICKETS_REPLY_DOMAIN`.

## Canonical Data Sources and Relationships

- **Representative portfolio:** Derive a representative's client portfolio from Performance.
- Canonical relationship: `representatives.id` → `rep_performance_uploads.representative_id` → latest active upload → `rep_performance_rows.upload_id` → `rep_performance_rows.razao_social`.
- Use the latest active, non-superseded upload.
- Do not infer the portfolio from `clients.representative_id` or `clients.nome_representante_erp` when the feature requires the portfolio defined by Performance.

## 5. Business Rules

- The authenticated route gate requires a session and checks terms acceptance, NDA acceptance, active company, roles, and admin MFA enrollment.
- Users with only the `comercial` role are directed to the performance generator.
- Performance imports classify values from cell results and numeric precedence; preserve `N/D` behavior in panels and exports when changing that flow.

## 6. Security Rules

- Use user-scoped Supabase access and RLS for user-authenticated queries. Server auth middleware validates bearer-token claims.
- The service-role client in `client.server.ts` bypasses RLS; load it only inside trusted server code and keep its key out of client bundles.
- Preserve company isolation and the terms, NDA, role, and MFA gates when changing access flows. Review public endpoints and storage policies for their own authorization checks.
- Keep secrets in environment variables; never copy values from local `.env` into source or documentation.

## 7. Quality Gates

- `npm run lint` runs ESLint; `npm run build` runs the production Vite build.
- `npm run check:context` enforces the 300/200/180-line limits for the three `ai/` context files. ESLint warns above 350 effective lines in manually maintained JS/TS files; review warnings before refactoring.
- TypeScript config exists, but no dedicated typecheck script is declared. Use `npx tsc --noEmit` when type validation is needed.
- Vitest tests exist in `src/lib`; no test script is declared. Run focused tests with `npx vitest run <path>` when changing covered logic.

## 8. Current Risks

- The repository has both browser-authenticated flows and public/server routes, so authorization needs review at each boundary.
- Lovable syncs pushed commits to its editor. Do not rewrite published branch history; keep pushed commits in a working state.
- Existing source files exceed the 350-line review threshold; avoid mechanical splits.

## 9. Frozen Decisions

- Keep TanStack Start file-based routing and the generated route tree; do not hand-edit `routeTree.gen.ts`.
- Keep Lovable's bundled Vite plugin configuration rather than registering duplicate plugins.
- Preserve published git history on the Lovable-connected branch.

## 10. Next Step

- Keep this brain limited to verified, durable architecture, rules, risks, and canonical data relationships.
