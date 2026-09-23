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

- **Solicitações Internas (módulo completo, código commitado/pushado em `orca-dev`; nada aplicado a um banco/conta real ainda — passo a passo manual pendente em `internal-tickets-setup.md`, raiz do repo, sempre manter essa lista de migrations atualizada lá em vez de aqui):** módulo de tickets do Comercial pra outros setores. Schema `internal_ticket_*`, setores/pessoas/categorias globais, tickets por `company_id`. Papéis novos em `app_role`: `gestor_comercial` (não reaproveita `gestor`) e `diretoria` (read-only) — toda nav_key nova exige seed explícito em `role_permissions` (`useNavAccess` não libera nada por padrão pra não-admin). Camada de e-mail desacoplada usa **Resend**; `INTERNAL_TICKETS_EMAIL_MODE=mock` troca pro `FakeEmailProvider` sem credencial. UI: `/solicitacoes/admin` (Setores/Responsáveis-com-telefone/Categorias, aninhado dentro do menu "Solicitações Internas", não mais em Admin global — só admin vê, via ausência de seed em role_permissions), `/solicitacoes/novo`, `/solicitacoes` (lista), `/solicitacoes/$ticketId` (Detalhe, dividido em painéis: status, encaminhar setor, timeline de setor, interação manual, anexos, timeline geral), `/solicitacoes/dashboard`. Webhook `/api/public/internal-tickets/resend-webhook` (Svix oficial; payload inbound assumido, não confirmado). **Histórico de setor**: `internal_ticket_sector_stops` (uma linha por "parada", `left_at` null = atual, unique index garante no máximo uma parada aberta por ticket) + `reassignInternalTicketSector` fecha a parada e abre a próxima — `internal_tickets.sector_id` continua sendo só o cache do setor atual. `sector-timeline.ts` (puro, testado) cruza paradas com eventos pra mostrar status alcançado em cada parada. Revisão de segurança (feita antes de fechar a v1): policies de INSERT de eventos/mensagens/paradas de setor restritas por `origin`+`author_user_id/moved_by = auth.uid()` no caminho autenticado — só service_role grava origin='sistema'/'email'/'acao_publica'. Risco residual aceito: RLS não impede um `PATCH` direto fora do grafo de `canTransition` (validação só na aplicação, não em trigger SQL).
  - **Gotcha de build (vale pra qualquer dependência futura):** `sanitize-html` quebra o `npm run build` deste projeto (Vite 8 + rolldown resolve `entities/decode` pra cópia raiz do pacote em vez da aninhada em `sanitize-html/node_modules`, que tem versão diferente sem esse subpath export). Trocado por `isomorphic-dompurify` (validado). Se uma lib nova quebrar o build com `UNLOADABLE_DEPENDENCY`, suspeitar do mesmo padrão antes de investigar a lib.
  - **Este projeto usa `bun` (lockfile `bun.lock`), não `npm`** — havia um commit removendo o `package-lock.json` como "legado". Instalar dependência com `npm install` recria um `package-lock.json` órfão sem atualizar `bun.lock`; sempre `bun install` depois (ou usar `bun add` direto).
  - Pendente: telas (Fase 5), dashboard/indicadores (Fase 6), ambiente de teste do Resend com mocks (Fase 7), testes de integração, revisão de segurança/idempotência (Fase 10), instruções de configuração manual de secrets/DNS/webhook (Fase 11). Env vars sem valor real: `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`, `INTERNAL_TICKETS_REPLY_SECRET`, `INTERNAL_TICKETS_REPLY_DOMAIN`.

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
