-- Chave lógica do preço oficial: um preço por produto em cada tabela (reimportar atualiza).
-- Preços legados (price_table_id NULL) ficam fora do índice.
CREATE UNIQUE INDEX IF NOT EXISTS uq_price_product_prices_product_table
  ON public.price_product_prices(product_id, price_table_id)
  WHERE price_table_id IS NOT NULL;
