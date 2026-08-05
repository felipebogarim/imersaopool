CREATE TABLE public.transcricoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL DEFAULT auth.uid(),
  titulo TEXT NOT NULL,
  texto TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transcricoes TO authenticated;
GRANT ALL ON public.transcricoes TO service_role;
ALTER TABLE public.transcricoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own transcricoes" ON public.transcricoes FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());