
-- Solicitações LGPD de titulares de dados
CREATE TABLE public.privacy_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titular_nome text NOT NULL,
  titular_email text NOT NULL,
  titular_documento text,
  tipo text NOT NULL CHECK (tipo IN ('acesso','correcao','exclusao','portabilidade','revogacao_consentimento','oposicao','anonimizacao','confirmacao','outros')),
  descricao text,
  canal text DEFAULT 'formulario',
  status text NOT NULL DEFAULT 'aberta' CHECK (status IN ('aberta','em_analise','aguardando_titular','concluida','recusada','encaminhada')),
  prazo_legal_em timestamptz,
  respondida_em timestamptz,
  resposta text,
  responsavel_id uuid REFERENCES auth.users(id),
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.privacy_requests TO authenticated;
GRANT ALL ON public.privacy_requests TO service_role;
ALTER TABLE public.privacy_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin manage privacy_requests" ON public.privacy_requests
  FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_privacy_requests_updated BEFORE UPDATE ON public.privacy_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_privacy_requests_status ON public.privacy_requests(status);
CREATE INDEX idx_privacy_requests_created ON public.privacy_requests(created_at DESC);

-- Função de listagem de usuários para o painel de Controle de Acessos (admin only)
CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS TABLE (
  id uuid,
  email text,
  full_name text,
  role app_role,
  last_sign_in_at timestamptz,
  created_at timestamptz,
  banned_until timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  RETURN QUERY
  SELECT
    u.id,
    u.email::text,
    COALESCE(p.full_name, u.raw_user_meta_data->>'full_name')::text AS full_name,
    ur.role,
    u.last_sign_in_at,
    u.created_at,
    u.banned_until
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  LEFT JOIN public.user_roles ur ON ur.user_id = u.id
  ORDER BY u.created_at DESC;
END $$;

REVOKE EXECUTE ON FUNCTION public.admin_list_users() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_users() TO authenticated;
