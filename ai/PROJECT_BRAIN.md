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
