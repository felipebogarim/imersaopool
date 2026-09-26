# CLAUDE.md

## Context loading

Before project work:

1. Load the global `pool-project-brain` skill.
2. Load the global `project-context-budget` skill.
3. Load the global `development-workflow` skill.
4. Read `ai/PROJECT_BRAIN.md`.
5. Read `ai/AGENT_INSTRUCTIONS.md`.
6. Use `ai/TASK_TEMPLATE.md` for substantial tasks.
7. Inspect only the source files necessary for the current task.

Global reusable rules belong in the Global Brain.
Project-specific durable context belongs in `ai/PROJECT_BRAIN.md`.


This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

PoolFlux Imersões Comerciais — a Portuguese-language (pt-BR) internal tool for preparing, running,
and analyzing "imersões comerciais" (commercial field immersions/interviews), with Kanban task
boards, BI/performance dashboards, pricing tools, and AI-generated diagnostics. Built from a Lovable
Cloud template (`tanstack_start_ts`) and synced with the Lovable editor — see `.lovable/` and `AGENTS.md`.

## Commands

```bash
npm run dev         # vite dev server
npm run build        # production build
npm run build:dev    # build in development mode
npm run preview      # preview a production build
npm run lint         # eslint .
npm run format       # prettier --write .
```

There is no `test` script. Run tests directly with vitest:

```bash
npx vitest run                          # all tests
npx vitest run src/lib/kanban-activity  # single file (or a name pattern)
npx vitest                              # watch mode
```

Tests live next to the code they cover as `*.test.ts` (see `src/lib/*.test.ts`).

## Architecture

### Stack

TanStack Start (file-based routing + SSR) on Vite, React 19, Supabase (Postgres/Auth/Storage),
Tailwind v4, shadcn/radix UI components, react-hook-form + zod, TanStack Query.

### Routing (`src/routes`)

File-based routing per `src/routes/README.md` — read it before adding routes. Key points:
- `routeTree.gen.ts` is generated; never edit it by hand.
- `__root.tsx` is the only root layout/shell (`<html>`/`<head>`/`<body>`, global providers, dark-mode
  toggling by path, Supabase `onAuthStateChange` → router/query invalidation).
- `_authenticated/route.tsx` is the auth+access gate for the whole authenticated app: it checks the
  Supabase session, then `getAuthGate()` (`src/lib/auth-gate.ts`) for terms acceptance, NDA acceptance,
  active company selection, admin MFA enrollment, and role-based redirects (e.g. `comercial`-only users
  are locked to `/admin/gerador-performance`). New authenticated pages go under `_authenticated/` and
  inherit this gate automatically; changing gating logic means editing this one file carefully — the
  redirect chain order matters (terms → NDA → empresa → MFA).
  - `_authenticated/precos/` and `_authenticated/price/` are two separate route groups: `precos/`
    (`mapa.tsx`, `simulador.tsx`) currently contains only "Módulo em Estruturação" placeholder pages
    that `NAV_TREE` does not link to; the active pricing module is `price/` (its own `route.tsx` layout
    with tabs for Competidores/Tabelas/Comparativos, plus `mapa.tsx`), linked from `NAV_TREE`'s "Preços"
    and "Dados de Mercado" groups. Note `NAV_TREE` also points at `/price/simulador`, which has no
    matching route file today — don't assume every `NAV_TREE` `to` resolves to a real route without
    checking.
- `src/routes/api/` and `src/routes/lovable/` hold non-page HTTP routes: backup endpoints
  (`api/public/backup-*`), scheduled check hooks (`api/public/hooks/*`, e.g. weekly security audit,
  MFA deadline check), Mercado Pago checkout endpoints (`api/public/mp/*`), and transactional email
  send/preview/queue (`routes/lovable/email/*`). `src/routes/lovable/**` and `/email/unsubscribe` are
  explicitly excluded from the generic error-page middleware in `src/start.ts` because they need to
  return raw/non-HTML responses.
- The app menu is driven by a single source of truth, `src/lib/nav-tree.ts` (`NAV_TREE`), consumed by
  `AppShell`, the admin "Permissões" screen, and route access checks (`useNavAccess`,
  `src/hooks/useNavAccess.ts`). Adding a nav-visible page means adding it to `NAV_TREE` too.

### Server code boundary

This is the most important convention to get right — TanStack Start ships route files and
`*.functions.ts` to the client bundle, so secrets must never be imported at top level in those files.

- **`*.server.ts`** — files TanStack Start's bundler strips from the client bundle. `eslint.config.js`
  has a `no-restricted-imports` rule blocking the Next.js `server-only` package and pointing at this
  `*.server.ts` naming (or `@tanstack/react-start/server-only`) as the replacement — that's lint-level
  guidance, not what actually keeps these files off the client. Per the comment in
  `client.server.ts`, a top-level import of a `.server.ts` module is only safe from another `.server.ts`
  module; route files and `*.functions.ts` must not import one at the top level. Use `*.server.ts` for
  anything holding secrets or the service-role Supabase client.
- **`*.functions.ts`** — TanStack Start server functions (`createServerFn`), defined with a
  `.inputValidator(zod schema)` + `.handler(...)`. These files themselves ship to the client, so any
  server-only import inside them (e.g. `supabaseAdmin`) must be a **dynamic** `await import(...)`
  inside the handler, not a top-level import — this is the pattern every existing `*.functions.ts` file
  that touches `client.server.ts` follows.
- `src/integrations/supabase/client.ts` — browser/SSR-safe Supabase client (publishable key, RLS
  applies). Import as `supabase`.
- `src/integrations/supabase/client.server.ts` — service-role Supabase client (`supabaseAdmin`,
  bypasses RLS). Server-only; load via dynamic import from `.functions.ts` handlers.
- `src/integrations/supabase/auth-attacher.ts` — client-side function middleware, registered globally
  in `src/start.ts`, that attaches the user's bearer token to every server-fn RPC.
- `src/integrations/supabase/auth-middleware.ts` — exports `requireSupabaseAuth`, a server-side
  middleware that validates the bearer token via `supabase.auth.getClaims()` and injects
  `{ supabase, userId, claims }` into `context`. Most `*.functions.ts` files attach it with
  `.middleware([requireSupabaseAuth])` on the `createServerFn` chain to get an RLS-scoped `supabase`
  client and the caller's `userId`/`claims` in the handler; handlers that then need to bypass RLS
  additionally check a role (e.g. `supabase.rpc("has_role", ...)`) before dynamically importing
  `supabaseAdmin`.
- `client.ts`, `client.server.ts`, `auth-attacher.ts`, and `auth-middleware.ts` are all marked
  "This file is automatically generated. Do not edit it directly." — regenerate rather than hand-edit.
  `types.ts` (the generated DB types) carries no such comment but is likewise produced from the Supabase
  schema, not hand-written.

### Database (`supabase/migrations`)

Plain numbered SQL migration files (no ORM). Postgres RLS is the primary authorization mechanism —
`user_roles` (an "admin" role checked by `useIsMasterAdmin`, `src/hooks/use-is-admin.ts`) and
`role_permissions` (per-role nav access checked by `useNavAccess`, `src/hooks/useNavAccess.ts`) drive
UI-level nav/menu access, while RLS policies in migrations are the actual data-access boundary. When
adding a data-touching feature, check whether existing RLS policies already cover the new access
pattern before reaching for `supabaseAdmin`.

### Domain modules (`src/lib`)

Most business logic lives in `src/lib` as flat, feature-prefixed files rather than nested folders —
e.g. everything for Kanban is `kanban-*.ts`, pricing is `price-*.ts` (plus a `price-mapa/` subfolder),
performance BI is `performance-*.ts`, "Visão Imersão 2" reporting is `visao-imersao-2-*.ts`, "Visão Rep
2" is `visao-rep2-*.ts`. When working on a feature, grep for its prefix across `src/lib` and check for a
matching folder under `src/components/` (e.g. `components/kanban`, `components/price`,
`components/visao-imersao-2`, `components/visao-rep2`) rather than assuming a single file owns it —
parsers, PDF/export generators, and server functions for one feature are usually split across several
same-prefixed files (e.g. `*-parser.ts`, `*-pdf.ts`, `*.functions.ts`).

Transactional email: templates are React-email components in `src/lib/email-templates/`, registered by
key in `src/lib/email-templates/registry.ts`, and sent via `sendTransactionalEmail()`
(`src/lib/email/send.server.ts`), which forwards the caller's bearer token to the internal
`/lovable/email/transactional/send` route rather than sending directly — always add new templates to
the registry, not just the component file.

### Path alias

`@/*` maps to `src/*` (see `tsconfig.json` and the Vite plugin).

## Editing conventions

- Prettier config (`.prettierrc`): 100-char width, `singleQuote: false` (double quotes), semicolons on,
  trailing commas everywhere. `npm run lint` runs `eslint-plugin-prettier`, so formatting issues surface
  as lint errors, not just `npm run format` diffs.
- Do not hand-edit `routeTree.gen.ts` or the "automatically generated" `src/integrations/supabase` files
  (`client.ts`, `client.server.ts`, `auth-attacher.ts`, `auth-middleware.ts`, and the generated
  `types.ts`).
- `vite.config.ts` is preconfigured by `@lovable.dev/vite-tanstack-config` (TanStack Start, React,
  Tailwind, tsconfig-paths, nitro/cloudflare build target, dev-only plugins, env injection, path
  aliasing) — don't re-add any of those plugins manually; extend via the `vite: {...}` passthrough only.
- Avoid rewriting published git history (force-push, rebase/amend/squash of pushed commits) on the
  branch connected to Lovable — it desyncs the Lovable editor's project history (see `AGENTS.md`).

## Git governance

`main` is the only operational and canonical branch. Orca, GitHub and Lovable work on the same `main`.

- Orca changes are committed and pushed directly to `main`; Lovable changes stay in `main`.
- `orca-dev` is a legacy branch only, no longer operational. Do not use it for new work.
- Before relevant work: fetch/pull `origin/main` and inspect the working tree.
- Before push: fetch the remote again to avoid overwriting work from Lovable, another agent or another developer; resolve conflicts preserving remote work.
- Create task branches only when there is a concrete need for isolation.
- Forbidden without explicit authorization: force push, destructive `reset`, rebase/amend of published history, deleting remote branches and other destructive rewrites.
