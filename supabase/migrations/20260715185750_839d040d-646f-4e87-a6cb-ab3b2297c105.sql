
CREATE TABLE public.event_orders_test (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pacote text NOT NULL CHECK (pacote = ANY (ARRAY['completa','hospedagem','umdia'])),
  pacote_titulo text NOT NULL,
  valor numeric(10,2) NOT NULL,
  participante_nome text NOT NULL,
  participante_email text NOT NULL,
  participante_telefone text,
  status text NOT NULL DEFAULT 'pending' CHECK (status = ANY (ARRAY['pending','approved','rejected','cancelled','in_process','refunded'])),
  mp_preference_id text,
  mp_payment_id text,
  payment_method text,
  paid_at timestamptz,
  raw jsonb,
  confirmation_email_sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT event_orders_test_mp_payment_id_unique UNIQUE (mp_payment_id)
);

GRANT SELECT ON public.event_orders_test TO authenticated;
GRANT ALL ON public.event_orders_test TO service_role;

ALTER TABLE public.event_orders_test ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem ver pedidos de teste"
  ON public.event_orders_test FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX event_orders_test_status_idx ON public.event_orders_test (status);
CREATE INDEX event_orders_test_email_idx ON public.event_orders_test (participante_email);

CREATE TRIGGER event_orders_test_touch_updated_at
  BEFORE UPDATE ON public.event_orders_test
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
