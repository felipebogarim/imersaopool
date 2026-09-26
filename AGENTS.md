<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Git governance

`main` is the only operational and canonical branch. Orca, GitHub and Lovable work on the same `main`.

- Orca changes are committed and pushed directly to `main`; Lovable changes stay in `main`.
- `orca-dev` is a legacy branch only, no longer operational. Do not use it for new work.
- Before relevant work: fetch/pull `origin/main` and inspect the working tree.
- Before push: fetch the remote again to avoid overwriting work from Lovable, another agent or another developer; resolve conflicts preserving remote work.
- Create task branches only when there is a concrete need for isolation.
- Forbidden without explicit authorization: force push, destructive `reset`, rebase/amend of published history, deleting remote branches and other destructive rewrites.

For project work:

1. Load the global `pool-project-brain` skill.
2. Load the global `project-context-budget` skill.
3. Load the global `development-workflow` skill.
4. Read `ai/PROJECT_BRAIN.md`.
5. Follow `ai/AGENT_INSTRUCTIONS.md`.
6. Use `ai/TASK_TEMPLATE.md` for substantial tasks.
7. Inspect only the source files necessary for the current task.

Global reusable rules belong in the Global Brain.
Project-specific durable context belongs in `ai/PROJECT_BRAIN.md`.
