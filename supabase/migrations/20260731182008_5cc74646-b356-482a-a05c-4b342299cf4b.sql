UPDATE public.visao_rep_reports r
SET representative_id = rep.id,
    data = jsonb_set(r.data::jsonb, '{metadata,representative_id}', to_jsonb(rep.id::text), true)
FROM public.representatives rep
WHERE r.representative_id IS NULL
  AND translate(lower(r.representative_name),'áàâãäéèêëíìîïóòôõöúùûüç','aaaaaeeeeiiiiooooouuuuc')
      LIKE translate(lower(rep.nome),'áàâãäéèêëíìîïóòôõöúùûüç','aaaaaeeeeiiiiooooouuuuc') || '%';