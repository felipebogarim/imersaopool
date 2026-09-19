# Agent Instructions

Read `ai/PROJECT_BRAIN.md` first. Search for task symbols and open only directly related files, then their immediate dependencies and focused tests. Consult historical documentation only when needed. Avoid loading the whole repository, migrations, build output, or unrelated tests.

Use `ai/TASK_TEMPLATE.md` to define scope for substantial tasks. Keep the brain current and under 300 lines; preserve active architecture, security rules, decisions, risks, and next step. Archive useful history instead of truncating it.

Run `npm run check:context` after context edits. For code changes, run relevant focused tests and `npm run lint`, `npx tsc --noEmit`, or `npm run build` as appropriate. Review ESLint `max-lines` warnings for manually maintained files over 350 effective lines; split only when cohesion permits. Existing warnings do not authorize mechanical refactors.

Preserve the Lovable history rule in `AGENTS.md`. Do not hand-edit generated code or expose environment secrets.
