
CREATE INDEX IF NOT EXISTS idx_familias_produto_lookup
  ON public.familias_produto (company_id, nivel, nome, parent_id);

UPDATE public.own_products op
SET familia_id = deepest.node_id
FROM (
  SELECT op2.id AS pid, COALESCE(sp.id, p.id, sf.id, f.id) AS node_id
  FROM public.own_products op2
  LEFT JOIN public.familias_produto f
    ON f.company_id = op2.company_id AND f.nivel = 'familia'
   AND f.nome = trim(op2.familia) AND f.parent_id IS NULL
  LEFT JOIN public.familias_produto sf
    ON sf.company_id = op2.company_id AND sf.nivel = 'sub_familia'
   AND sf.nome = trim(op2.sub_familia) AND sf.parent_id = f.id
  LEFT JOIN public.familias_produto p
    ON p.company_id = op2.company_id AND p.nivel = 'portfolio'
   AND p.nome = trim(op2.portifolio) AND p.parent_id = COALESCE(sf.id, f.id)
  LEFT JOIN public.familias_produto sp
    ON sp.company_id = op2.company_id AND sp.nivel = 'sub_portfolio'
   AND sp.nome = trim(op2.sub_portifolio) AND sp.parent_id = p.id
) deepest
WHERE deepest.pid = op.id AND deepest.node_id IS NOT NULL;
