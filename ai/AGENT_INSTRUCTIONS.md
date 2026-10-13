# Agent Instructions

Use the global `pool-project-brain` skill as the first shared operating context.
Use the global `project-context-budget` skill for context discovery and reading limits.
Use the global `development-workflow` skill for diagnosis, implementation, validation, and Git handoff.

Read `ai/PROJECT_BRAIN.md` after the Global Brain. Search for task symbols and open only directly related files, then their immediate dependencies and focused tests. Consult historical documentation only when needed. Avoid loading the whole repository, migrations, build output, or unrelated tests.

Use `ai/TASK_TEMPLATE.md` to define scope for substantial tasks. Keep the brain current and under 300 lines; preserve active architecture, security rules, decisions, risks, and next step. Archive useful history instead of truncating it.

Run `npm run check:context` after context edits.

## Proportional Execution & Validation Policy

Classify every task internally by complexity and risk before executing:

1. **Simple (Text, Copy, Punctuation, Cosmetic Styles):**
   - Locate target directly, apply surgical edit, and review `git diff`.
   - **Do not run build, full test suites, ESLint, or TypeScript checks** without strict technical necessity.
2. **Intermediate (Local Component Logic, Isolated Helpers, Focused Fixes):**
   - Run only validations directly pertinent to modified files (e.g., targeted file tests via `vitest run <path>`, targeted type or lint check).
3. **Complex (Refactors, Architecture, Schemas/Migrations, Auth, Critical Business Flow):**
   - Maintain rigorous end-to-end verification: targeted and integration tests, `tsc --noEmit`, `npm run build`, and impact analysis.
   - Preserves system integrity without cutting required safety corners.

## Operational Efficiency & Scope Discipline

- **No redundant exploration:** Avoid repeated searches, re-reading the same file chunks, or issuing speculative commands.
- **Strict scope:** Do not expand scope without technical justification. Do not mechanically refactor or fix unrelated pre-existing issues without explicit authorization.
- **Objective completion report:** Summarize succinctly: modified files, validations executed, outcome, and pending items.

## Git Workflow & Commit Hygiene

`main` is the only operational and canonical branch. Orca, GitHub and Lovable work on the same `main`.

- Orca changes are committed and pushed directly to `main`; Lovable changes stay in `main`.
- `orca-dev` is a legacy branch only, no longer operational. Do not use it for new work.
- Before relevant work: fetch/pull `origin/main` and inspect the working tree.
- Before commit: verify current branch. **Stage exclusively the files belonging to the task**. Never use indiscriminate `git add .` or `git add -A`.
- Before push: fetch the remote again to avoid overwriting work from Lovable, another agent or developer; resolve conflicts preserving remote work. Push strictly to the target operational branch (`main`).
- Create task branches only when there is a concrete need for isolation.
- Forbidden without explicit authorization: force push, destructive `reset`, rebase/amend of published history, deleting remote branches and other destructive rewrites.
- Preserve Lovable history constraints defined in `AGENTS.md`.

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
