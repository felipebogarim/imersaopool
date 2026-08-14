# Plan: Kanban UI Overhaul (Gestão de Tarefas)

Adjust the Kanban UI to match the reference style: clean white cards, horizontal color strips, explicit labels, and a structured layout.

## Design Changes
- **Kanban Board**:
  - Update list background to a very light gray (`bg-slate-50/50`).
  - Update headers to show "Total: R$ ..." (mocked or from metadata).
  - Add a "Criar Negócio" button style to the "Add Card" action in the first column.
- **Kanban Card**:
  - White background with subtle shadow.
  - Remove default borders, use `shadow-sm`.
  - Top color strip based on status or priority.
  - "Responsável: Name" display.
  - Value (R$) and ID (#1234) display.
  - Status badges with specific colors (Green for "Planejada", Red for "Atrasada", etc.).
  - Remove unnecessary icons for a cleaner look.

## Technical Details
- Modify `src/components/kanban/KanbanCard.tsx` to implement the new layout.
- Update `src/routes/_authenticated/tarefas.b.$boardId.tsx` for board-level styling adjustments.
- Use Tailwind classes for the "CRM-like" look.

## Security
- No changes to security or RLS.
