
-- 1. Private schema
CREATE SCHEMA IF NOT EXISTS performance_private;
REVOKE ALL ON SCHEMA performance_private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA performance_private TO service_role;

-- 2. Private tables
CREATE TABLE performance_private.rep_row_values (
  row_id uuid PRIMARY KEY REFERENCES public.rep_performance_rows(id) ON DELETE CASCADE,
  upload_id uuid NOT NULL,
  total_meta numeric,
  metas jsonb NOT NULL DEFAULT '{}'::jsonb,
  realizado jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON performance_private.rep_row_values(upload_id);

CREATE TABLE performance_private.rep_upload_values (
  upload_id uuid PRIMARY KEY REFERENCES public.rep_performance_uploads(id) ON DELETE CASCADE,
  categoria_metas jsonb NOT NULL DEFAULT '{}'::jsonb,
  raw_file_path text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE performance_private.gerador_values (
  salvos_id uuid PRIMARY KEY REFERENCES public.gerador_performance_salvos(id) ON DELETE CASCADE,
  rows jsonb NOT NULL DEFAULT '[]'::jsonb,
  categoria_metas jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE performance_private.bi_raw (
  bi_upload_id uuid PRIMARY KEY REFERENCES public.rep_bi_uploads(id) ON DELETE CASCADE,
  data_raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

REVOKE ALL ON ALL TABLES IN SCHEMA performance_private FROM PUBLIC, anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA performance_private TO service_role;

-- 3. Copy existing data
INSERT INTO performance_private.rep_row_values (row_id, upload_id, total_meta, metas, realizado)
SELECT id, upload_id, total_meta, COALESCE(metas,'{}'::jsonb), COALESCE(realizado,'{}'::jsonb)
FROM public.rep_performance_rows;

INSERT INTO performance_private.rep_upload_values (upload_id, categoria_metas)
SELECT id, COALESCE(categoria_metas,'{}'::jsonb)
FROM public.rep_performance_uploads;

INSERT INTO performance_private.gerador_values (salvos_id, rows, categoria_metas)
SELECT id, COALESCE(rows,'[]'::jsonb), COALESCE(categoria_metas,'{}'::jsonb)
FROM public.gerador_performance_salvos;

INSERT INTO performance_private.bi_raw (bi_upload_id, data_raw)
SELECT id, COALESCE(data,'{}'::jsonb)
FROM public.rep_bi_uploads;

-- 4. Add derived columns to public tables
ALTER TABLE public.rep_performance_rows
  ADD COLUMN IF NOT EXISTS total_pct numeric,
  ADD COLUMN IF NOT EXISTS familia_pct jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.rep_performance_uploads
  ADD COLUMN IF NOT EXISTS familia_participacao_categoria jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS familia_atingimento_categoria jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS categoria_participacao jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS atingimento_geral numeric;

ALTER TABLE public.gerador_performance_salvos
  ADD COLUMN IF NOT EXISTS rows_safe jsonb NOT NULL DEFAULT '[]'::jsonb;

-- 5. Recompute function (service_role only)
CREATE OR REPLACE FUNCTION performance_private.recompute_upload(_upload_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = performance_private, public
AS $$
DECLARE
  _familias text[];
  _cat_meta jsonb;
  _f text;
  _cat text;
  _row record;
  _meta_val numeric;
  _real_val numeric;
  _row_meta_sum numeric;
  _row_real_sum numeric;
  _cat_meta_sum jsonb := '{}'::jsonb;
  _cat_real_sum jsonb := '{}'::jsonb;
  _cat_fam_meta jsonb := '{}'::jsonb;
  _cat_fam_real jsonb := '{}'::jsonb;
  _global_meta numeric := 0;
  _global_real numeric := 0;
  _familia_participacao jsonb := '{}'::jsonb;
  _familia_atingimento jsonb := '{}'::jsonb;
  _categoria_participacao jsonb := '{}'::jsonb;
BEGIN
  SELECT familias INTO _familias FROM public.rep_performance_uploads WHERE id = _upload_id;
  IF _familias IS NULL THEN RETURN; END IF;
  SELECT categoria_metas INTO _cat_meta FROM performance_private.rep_upload_values WHERE upload_id = _upload_id;
  _cat_meta := COALESCE(_cat_meta, '{}'::jsonb);

  -- Iterate over rows
  FOR _row IN
    SELECT r.id AS row_id, r.categoria, v.total_meta, v.metas, v.realizado
    FROM public.rep_performance_rows r
    JOIN performance_private.rep_row_values v ON v.row_id = r.id
    WHERE r.upload_id = _upload_id
  LOOP
    _row_meta_sum := 0;
    _row_real_sum := 0;
    DECLARE _fpct jsonb := '{}'::jsonb;
    BEGIN
      FOREACH _f IN ARRAY _familias LOOP
        _meta_val := NULLIF(_row.metas->>_f,'')::numeric;
        _real_val := NULLIF(_row.realizado->>_f,'')::numeric;
        _meta_val := COALESCE(_meta_val, 0);
        _real_val := COALESCE(_real_val, 0);
        IF _meta_val > 0 THEN
          _fpct := jsonb_set(_fpct, ARRAY[_f], to_jsonb(round((_real_val / _meta_val)::numeric, 4)));
        END IF;
        _row_meta_sum := _row_meta_sum + _meta_val;
        _row_real_sum := _row_real_sum + _real_val;

        -- Aggregate per category/family
        _cat := COALESCE(_row.categoria, '');
        IF _cat <> '' AND _meta_val > 0 THEN
          _cat_fam_meta := jsonb_set(_cat_fam_meta,
            ARRAY[_cat, _f],
            to_jsonb(COALESCE((_cat_fam_meta#>>ARRAY[_cat,_f])::numeric, 0) + _meta_val),
            true);
          _cat_fam_real := jsonb_set(_cat_fam_real,
            ARRAY[_cat, _f],
            to_jsonb(COALESCE((_cat_fam_real#>>ARRAY[_cat,_f])::numeric, 0) + _real_val),
            true);
        END IF;
      END LOOP;
      UPDATE public.rep_performance_rows
        SET familia_pct = _fpct,
            total_pct = CASE WHEN COALESCE(_row.total_meta, _row_meta_sum) > 0
                        THEN round((_row_real_sum / COALESCE(_row.total_meta, _row_meta_sum))::numeric, 4)
                        ELSE NULL END
        WHERE id = _row.row_id;
    END;
    _global_meta := _global_meta + COALESCE(_row.total_meta, _row_meta_sum);
    _global_real := _global_real + _row_real_sum;
    IF _row.categoria IS NOT NULL AND _row.categoria <> '' THEN
      _cat_meta_sum := jsonb_set(_cat_meta_sum, ARRAY[_row.categoria],
        to_jsonb(COALESCE((_cat_meta_sum->>_row.categoria)::numeric, 0) + COALESCE(_row.total_meta, _row_meta_sum)), true);
      _cat_real_sum := jsonb_set(_cat_real_sum, ARRAY[_row.categoria],
        to_jsonb(COALESCE((_cat_real_sum->>_row.categoria)::numeric, 0) + _row_real_sum), true);
    END IF;
  END LOOP;

  -- Per-category derived
  FOR _cat IN SELECT jsonb_object_keys(_cat_fam_meta) LOOP
    DECLARE
      _fam_meta_obj jsonb := _cat_fam_meta->_cat;
      _fam_real_obj jsonb := _cat_fam_real->_cat;
      _cat_meta_total numeric := 0;
      _p jsonb := '{}'::jsonb;
      _a jsonb := '{}'::jsonb;
    BEGIN
      SELECT COALESCE(SUM((value)::numeric),0) INTO _cat_meta_total FROM jsonb_each_text(_fam_meta_obj);
      FOR _f IN SELECT jsonb_object_keys(_fam_meta_obj) LOOP
        _meta_val := COALESCE((_fam_meta_obj->>_f)::numeric,0);
        _real_val := COALESCE((_fam_real_obj->>_f)::numeric,0);
        IF _cat_meta_total > 0 THEN
          _p := jsonb_set(_p, ARRAY[_f], to_jsonb(round((_meta_val/_cat_meta_total)::numeric, 6)));
        END IF;
        IF _meta_val > 0 THEN
          _a := jsonb_set(_a, ARRAY[_f], to_jsonb(round((_real_val/_meta_val)::numeric, 4)));
        END IF;
      END LOOP;
      _familia_participacao := jsonb_set(_familia_participacao, ARRAY[_cat], _p, true);
      _familia_atingimento := jsonb_set(_familia_atingimento, ARRAY[_cat], _a, true);
    END;
  END LOOP;

  -- Category share of overall
  FOR _cat IN SELECT jsonb_object_keys(_cat_meta_sum) LOOP
    IF _global_meta > 0 THEN
      _categoria_participacao := jsonb_set(_categoria_participacao, ARRAY[_cat],
        to_jsonb(round(((_cat_meta_sum->>_cat)::numeric/_global_meta)::numeric, 6)), true);
    END IF;
  END LOOP;

  UPDATE public.rep_performance_uploads
    SET familia_participacao_categoria = _familia_participacao,
        familia_atingimento_categoria = _familia_atingimento,
        categoria_participacao = _categoria_participacao,
        atingimento_geral = CASE WHEN _global_meta > 0 THEN round((_global_real/_global_meta)::numeric,4) ELSE NULL END
    WHERE id = _upload_id;
END;
$$;

REVOKE ALL ON FUNCTION performance_private.recompute_upload(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION performance_private.recompute_upload(uuid) TO service_role;

-- 6. Trigger to auto-recompute on private data changes
CREATE OR REPLACE FUNCTION performance_private.trg_recompute_row()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = performance_private, public AS $$
BEGIN
  PERFORM performance_private.recompute_upload(COALESCE(NEW.upload_id, OLD.upload_id));
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION performance_private.trg_recompute_upload()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = performance_private, public AS $$
BEGIN
  PERFORM performance_private.recompute_upload(COALESCE(NEW.upload_id, OLD.upload_id));
  RETURN NEW;
END $$;

CREATE TRIGGER trg_row_values_recompute
AFTER INSERT OR UPDATE OR DELETE ON performance_private.rep_row_values
FOR EACH ROW EXECUTE FUNCTION performance_private.trg_recompute_row();

CREATE TRIGGER trg_upload_values_recompute
AFTER INSERT OR UPDATE ON performance_private.rep_upload_values
FOR EACH ROW EXECUTE FUNCTION performance_private.trg_recompute_upload();

-- 7. Backfill derived
DO $$ DECLARE _u uuid; BEGIN
  FOR _u IN SELECT id FROM public.rep_performance_uploads LOOP
    PERFORM performance_private.recompute_upload(_u);
  END LOOP;
END $$;

-- 8. Backfill gerador_performance_salvos.rows_safe (strip monetary fields)
UPDATE public.gerador_performance_salvos g
SET rows_safe = COALESCE((
  SELECT jsonb_agg(
    (elem - 'metas' - 'total_meta' - 'realizado' - 'meta' - 'total' - 'valor' - 'valor_meta' - 'valor_realizado')
  )
  FROM jsonb_array_elements(g.rows) elem
), '[]'::jsonb);

-- 9. Drop monetary columns from public tables
ALTER TABLE public.rep_performance_rows DROP COLUMN IF EXISTS metas;
ALTER TABLE public.rep_performance_rows DROP COLUMN IF EXISTS total_meta;
ALTER TABLE public.rep_performance_rows DROP COLUMN IF EXISTS realizado;

ALTER TABLE public.rep_performance_uploads DROP COLUMN IF EXISTS categoria_metas;
ALTER TABLE public.rep_performance_uploads DROP COLUMN IF EXISTS participacao;
ALTER TABLE public.rep_performance_uploads DROP COLUMN IF EXISTS atingimento;

ALTER TABLE public.gerador_performance_salvos DROP COLUMN IF EXISTS categoria_metas;
ALTER TABLE public.gerador_performance_salvos DROP COLUMN IF EXISTS rows;
ALTER TABLE public.gerador_performance_salvos RENAME COLUMN rows_safe TO rows;

ALTER TABLE public.rep_bi_uploads DROP COLUMN IF EXISTS data;
ALTER TABLE public.rep_bi_uploads ADD COLUMN IF NOT EXISTS data_safe jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Repopulate rep_bi_uploads.data_safe from private (since BI parsed data is already percentages, copy in full for now; can be filtered later if needed)
UPDATE public.rep_bi_uploads b
SET data_safe = COALESCE((SELECT data_raw FROM performance_private.bi_raw WHERE bi_upload_id = b.id), '{}'::jsonb);
