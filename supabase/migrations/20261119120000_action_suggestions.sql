-- Ações Reps (Fase 1): a ação vai ao representante como SUGESTÃO (ele aceita ou recusa;
-- ninguém é obrigado). O aceite fica junto do acompanhamento existente.
ALTER TABLE public.kanban_action_tracking
  ADD COLUMN IF NOT EXISTS acceptance TEXT NOT NULL DEFAULT 'nao_enviada',
  ADD COLUMN IF NOT EXISTS suggested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS responded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS response_note TEXT;

ALTER TABLE public.kanban_action_tracking DROP CONSTRAINT IF EXISTS kanban_action_tracking_acceptance_check;
ALTER TABLE public.kanban_action_tracking ADD CONSTRAINT kanban_action_tracking_acceptance_check
  CHECK (acceptance IN ('nao_enviada', 'enviada', 'aceita', 'recusada'));

NOTIFY pgrst, 'reload schema';
