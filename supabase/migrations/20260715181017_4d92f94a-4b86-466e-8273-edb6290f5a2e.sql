
CREATE TABLE public.event_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pacote TEXT NOT NULL CHECK (pacote IN ('completa','hospedagem','umdia')),
  pacote_titulo TEXT NOT NULL,
  valor NUMERIC(10,2) NOT NULL,
  participante_nome TEXT NOT NULL,
  participante_email TEXT NOT NULL,
  participante_telefone TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','cancelled','in_process','refunded')),
  mp_preference_id TEXT,
  mp_payment_id TEXT,
  payment_method TEXT,
  paid_at TIMESTAMPTZ,
  raw JSONB,
  confirmation_email_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX event_orders_mp_payment_id_key ON public.event_orders (mp_payment_id) WHERE mp_payment_id IS NOT NULL;
CREATE INDEX event_orders_status_idx ON public.event_orders (status);
CREATE INDEX event_orders_email_idx ON public.event_orders (participante_email);

GRANT ALL ON public.event_orders TO service_role;
GRANT SELECT ON public.event_orders TO authenticated;

ALTER TABLE public.event_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem ver todos pedidos do evento"
  ON public.event_orders FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER event_orders_touch_updated_at
  BEFORE UPDATE ON public.event_orders
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
