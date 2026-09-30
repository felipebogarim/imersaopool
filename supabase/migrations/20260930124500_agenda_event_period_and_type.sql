ALTER TABLE public.agenda_events
ADD COLUMN ends_at timestamptz,
ADD COLUMN event_type text NOT NULL DEFAULT 'outro';

UPDATE public.agenda_events
SET ends_at = starts_at + make_interval(mins => duration_minutes)
WHERE ends_at IS NULL;

ALTER TABLE public.agenda_events
ALTER COLUMN ends_at SET NOT NULL,
DROP CONSTRAINT agenda_events_duration_minutes_check,
ADD CONSTRAINT agenda_events_duration_minutes_check CHECK (duration_minutes > 0),
ADD CONSTRAINT agenda_events_period_check CHECK (ends_at > starts_at),
ADD CONSTRAINT agenda_events_type_check CHECK (event_type IN ('imersao', 'reuniao', 'outro'));

CREATE OR REPLACE FUNCTION public.agenda_events_sync_period()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.ends_at IS NULL THEN
    NEW.ends_at := NEW.starts_at + make_interval(mins => NEW.duration_minutes);
  END IF;

  NEW.duration_minutes := CEIL(EXTRACT(EPOCH FROM (NEW.ends_at - NEW.starts_at)) / 60)::integer;
  RETURN NEW;
END;
$$;

CREATE TRIGGER agenda_events_sync_period_fields
BEFORE INSERT OR UPDATE OF starts_at, ends_at, duration_minutes ON public.agenda_events
FOR EACH ROW EXECUTE FUNCTION public.agenda_events_sync_period();

CREATE INDEX agenda_events_ends_idx ON public.agenda_events(ends_at);
