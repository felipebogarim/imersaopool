DO $$
DECLARE r record; t text; m text;
BEGIN
  FOR r IN SELECT id, payload::text AS p FROM public.mapa_familia_versoes LOOP
    t := r.p;
    FOR m IN SELECT DISTINCT (regexp_matches(t, '\\\\u[0-9a-fA-F]{4}', 'g'))[1] LOOP
      t := replace(t, m, chr(('x' || substr(m, 4, 4))::bit(16)::int));
    END LOOP;
    IF t <> r.p THEN
      UPDATE public.mapa_familia_versoes SET payload = t::jsonb WHERE id = r.id;
    END IF;
  END LOOP;
END $$;