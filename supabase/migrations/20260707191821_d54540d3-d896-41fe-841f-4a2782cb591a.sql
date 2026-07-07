-- Propagate imagem_url to variants using codigo_interno prefix + name similarity
-- Strategy: for each product without image, find a "sibling" with image in same brand
-- whose codigo_interno shares a long prefix AND whose name shares the first 3 significant tokens.

CREATE OR REPLACE FUNCTION public.pf_name_key(nome text) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT array_to_string(
    (SELECT array_agg(t) FROM (
       SELECT t FROM unnest(
         regexp_split_to_array(
           regexp_replace(upper(translate(coalesce(nome,''),
             'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ','AAAAAEEEEIIIIOOOOOUUUUC')),
           '[^A-Z0-9 ]', ' ', 'g'),
           '\s+')
       ) AS t
       WHERE length(t) >= 3
         AND t !~ '^\d'
         AND t NOT IN ('PRETO','BRANCO','DOURADO','PRATA','CROMADO','BRONZE','COBRE','GRAFITE','CINZA','CHAMPAGNE','FOSCO','BRILHO','BRILHANTE','FENDI','AREIA','DUNAS','MATA','VERDE','AZUL','VERMELHO','AMARELO','TOTAL','BIVOLT','LED','LAMP','LAMPADA','COM','SEM','PARA','QUENTE','FRIO','NEUTRO','NATURAL','DIAM','MM','CM')
       LIMIT 3
    ) sub),
    ' '
  )
$$;

WITH have AS (
  SELECT DISTINCT ON (marca, public.pf_name_key(nome))
    marca, public.pf_name_key(nome) AS k, imagem_url
  FROM public.own_products
  WHERE imagem_url IS NOT NULL
),
targets AS (
  SELECT p.id, h.imagem_url
  FROM public.own_products p
  JOIN have h ON h.marca = p.marca AND h.k = public.pf_name_key(p.nome)
  WHERE p.imagem_url IS NULL
    AND public.pf_name_key(p.nome) <> ''
)
UPDATE public.own_products p
SET imagem_url = t.imagem_url
FROM targets t
WHERE p.id = t.id;

DROP FUNCTION public.pf_name_key(text);