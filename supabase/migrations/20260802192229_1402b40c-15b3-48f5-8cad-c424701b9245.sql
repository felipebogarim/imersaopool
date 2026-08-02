CREATE TABLE public.first_access_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.first_access_tokens TO service_role;

ALTER TABLE public.first_access_tokens ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_first_access_tokens_user ON public.first_access_tokens(user_id);

-- sem trigger de updated_at (função utilitária inexistente neste projeto)