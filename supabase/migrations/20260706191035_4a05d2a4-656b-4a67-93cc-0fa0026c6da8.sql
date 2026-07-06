
ALTER TABLE public.own_products
  ADD COLUMN IF NOT EXISTS pro_pad_in_codigo INT,
  ADD COLUMN IF NOT EXISTS pro_in_codigo INT,
  ADD COLUMN IF NOT EXISTS codigo_alternativo TEXT,
  ADD COLUMN IF NOT EXISTS def_item TEXT,
  ADD COLUMN IF NOT EXISTS narrativa TEXT,
  ADD COLUMN IF NOT EXISTS gru_in_codigo INT,
  ADD COLUMN IF NOT EXISTS gru_nome TEXT,
  ADD COLUMN IF NOT EXISTS marca TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT,
  ADD COLUMN IF NOT EXISTS tipo_produto TEXT,
  ADD COLUMN IF NOT EXISTS planta_fabril TEXT,
  ADD COLUMN IF NOT EXISTS linha_montagem TEXT,
  ADD COLUMN IF NOT EXISTS classe_rentabilidade TEXT,
  ADD COLUMN IF NOT EXISTS linha TEXT,
  ADD COLUMN IF NOT EXISTS portifolio TEXT,
  ADD COLUMN IF NOT EXISTS sub_portifolio TEXT,
  ADD COLUMN IF NOT EXISTS sub_familia TEXT,
  ADD COLUMN IF NOT EXISTS codigo_barra TEXT;

CREATE INDEX IF NOT EXISTS own_products_company_idx ON public.own_products(company_id);
CREATE INDEX IF NOT EXISTS own_products_marca_idx ON public.own_products(marca);
CREATE INDEX IF NOT EXISTS own_products_familia_idx ON public.own_products(familia);
