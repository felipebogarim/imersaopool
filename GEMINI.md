# Gemini / Antigravity Project Instructions

For all project work:

1. Load the global `pool-project-brain` skill.
2. Load the global `project-context-budget` skill.
3. Load the global `development-workflow` skill.
4. Read `ai/PROJECT_BRAIN.md`.
5. Follow `ai/AGENT_INSTRUCTIONS.md`.
6. Use `ai/TASK_TEMPLATE.md` for substantial tasks.
7. Load context progressively. Do not scan the entire repository by default.
8. Preserve the Lovable git-history rules defined in `AGENTS.md`.

## Git governance

`main` is the only operational and canonical branch. Orca, GitHub and Lovable work on the same `main`.

- Orca changes are committed and pushed directly to `main`; Lovable changes stay in `main`.
- `orca-dev` is a legacy branch only, no longer operational. Do not use it for new work.
- Before relevant work: fetch/pull `origin/main` and inspect the working tree.
- Before push: fetch the remote again to avoid overwriting work from Lovable, another agent or another developer; resolve conflicts preserving remote work.
- Create task branches only when there is a concrete need for isolation.
- Forbidden without explicit authorization: force push, destructive `reset`, rebase/amend of published history, deleting remote branches and other destructive rewrites.

Global reusable rules belong in the Global Brain.
Project-specific durable context belongs in `ai/PROJECT_BRAIN.md`.
