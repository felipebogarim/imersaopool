# Agent Instructions

Use the global `pool-project-brain` skill as the first shared operating context.
Use the global `project-context-budget` skill for context discovery and reading limits.
Use the global `development-workflow` skill for diagnosis, implementation, validation, and Git handoff.

Read `ai/PROJECT_BRAIN.md` after the Global Brain. Search for task symbols and open only directly related files, then their immediate dependencies and focused tests. Consult historical documentation only when needed. Avoid loading the whole repository, migrations, build output, or unrelated tests.

Use `ai/TASK_TEMPLATE.md` to define scope for substantial tasks. Keep the brain current and under 300 lines; preserve active architecture, security rules, decisions, risks, and next step. Archive useful history instead of truncating it.

Run `npm run check:context` after context edits. For code changes, run relevant focused tests and `npm run lint`, `npx tsc --noEmit`, or `npm run build` as appropriate. Review ESLint `max-lines` warnings for manually maintained files over 350 effective lines; split only when cohesion permits. Existing warnings do not authorize mechanical refactors.

Preserve the Lovable history rule in `AGENTS.md`. Do not hand-edit generated code or expose environment secrets.

## Git workflow

`main` is the only operational and canonical branch. Orca, GitHub and Lovable work on the same `main`.

- Orca changes are committed and pushed directly to `main`; Lovable changes stay in `main`.
- `orca-dev` is a legacy branch only, no longer operational. Do not use it for new work.
- Before relevant work: fetch/pull `origin/main` and inspect the working tree.
- Before push: fetch the remote again to avoid overwriting work from Lovable, another agent or another developer; resolve conflicts preserving remote work.
- Create task branches only when there is a concrete need for isolation.
- Forbidden without explicit authorization: force push, destructive `reset`, rebase/amend of published history, deleting remote branches and other destructive rewrites.

Preserve all Lovable history constraints defined in `AGENTS.md`.

## Exploration Budget

For broad audits, investigations, and repository-wide analysis:

1. Start with static search and structural mapping before opening implementation files.
2. Hard exploration limit: do not inspect more than 15 implementation files during the initial audit pass.
3. Before opening a 16th implementation file:
   - stop the investigation;
   - summarize the findings obtained so far;
   - state exactly why the current evidence is insufficient;
   - list the additional files required and why each one is necessary;
   - only then continue with the smallest possible additional set.
4. Do not read the same implementation file more than once unless a specific unresolved question requires it.
5. Targeted line-range reads used only to verify a previously identified finding do not count as a full reread.
6. Prefer targeted searches (`rg`, `grep`, `git grep`, symbol search) before opening files.
7. Rank findings by likely impact before expanding the investigation.
8. Do not scan the entire `src`, historical docs, migrations, generated files, or unrelated tests by default.
9. Stop exploration when there is enough evidence to answer the task reliably.
10. For audits, separate discovery from deep inspection: map risks first, inspect only the highest-risk areas second.
11. During read-only audits, do not run builds, type checks, tests, dependency installation, or other validation commands unless they are directly required to confirm a specific finding.
