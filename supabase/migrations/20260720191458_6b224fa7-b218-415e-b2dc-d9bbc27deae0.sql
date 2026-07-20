UPDATE public.forms
SET schema = jsonb_set(
  schema,
  '{fields}',
  (
    '[
      {"id":"nome","label":"Nome","type":"text","required":true,"placeholder":"","help":"","options":[]},
      {"id":"regiao","label":"Região","type":"text","required":true,"placeholder":"","help":"","options":[]},
      {"id":"cargo","label":"Cargo","type":"text","required":true,"placeholder":"","help":"","options":[]}
    ]'::jsonb
  ) || (schema->'fields')
)
WHERE slug = 'competidor-por-familia';