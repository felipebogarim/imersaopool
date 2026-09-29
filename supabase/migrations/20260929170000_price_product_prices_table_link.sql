-- Vínculo explícito PREÇO -> TABELA DE PREÇO (Price > Tabelas = public.price_tables).
-- Nullable: preços legados permanecem com price_table_id NULL ("origem legada").
ALTER TABLE public.price_product_prices
  ADD COLUMN IF NOT EXISTS price_table_id uuid NULL
    REFERENCES public.price_tables(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_price_product_prices_table
  ON public.price_product_prices(price_table_id);
-- Sem backfill: preços legados (modelo_comparativo_*.xlsx) não têm chave inequívoca para
-- tabelas oficiais e permanecem NULL. Novos preços importados de uma tabela recebem o id.
