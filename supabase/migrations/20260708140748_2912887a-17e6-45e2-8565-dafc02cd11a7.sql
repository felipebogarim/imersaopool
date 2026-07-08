UPDATE public.own_products
SET familia = 'FONTES'
WHERE nome ILIKE 'FONTE LED%'
  AND (familia IN ('12V','24V','48V') OR familia IS NULL);