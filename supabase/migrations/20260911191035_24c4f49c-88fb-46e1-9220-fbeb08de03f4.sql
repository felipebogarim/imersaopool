CREATE TABLE public.agenda_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  company_id uuid NOT NULL,
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 160),
  starts_at timestamptz NOT NULL,
  duration_minutes integer NOT NULL DEFAULT 60 CHECK (duration_minutes BETWEEN 15 AND 1440),
  details text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.agenda_events TO authenticated;
GRANT ALL ON public.agenda_events TO service_role;

ALTER TABLE public.agenda_events ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.agenda_event_invitees (
  event_id uuid NOT NULL REFERENCES public.agenda_events(id) ON DELETE CASCADE,
  invitee_id uuid NOT NULL,
  owner_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, invitee_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.agenda_event_invitees TO authenticated;
GRANT ALL ON public.agenda_event_invitees TO service_role;

ALTER TABLE public.agenda_event_invitees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agenda owners read their events"
ON public.agenda_events FOR SELECT TO authenticated
USING (owner_id = auth.uid());

CREATE POLICY "Agenda invitees read shared events"
ON public.agenda_events FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.agenda_event_invitees i
    WHERE i.event_id = agenda_events.id AND i.invitee_id = auth.uid()
  )
);

CREATE POLICY "Agenda owners create events"
ON public.agenda_events FOR INSERT TO authenticated
WITH CHECK (
  owner_id = auth.uid()
  AND company_id = (SELECT p.active_company_id FROM public.profiles p WHERE p.id = auth.uid())
);

CREATE POLICY "Agenda owners update events"
ON public.agenda_events FOR UPDATE TO authenticated
USING (owner_id = auth.uid())
WITH CHECK (
  owner_id = auth.uid()
  AND company_id = (SELECT p.active_company_id FROM public.profiles p WHERE p.id = auth.uid())
);

CREATE POLICY "Agenda owners delete events"
ON public.agenda_events FOR DELETE TO authenticated
USING (owner_id = auth.uid());

CREATE POLICY "Agenda participants read invitations"
ON public.agenda_event_invitees FOR SELECT TO authenticated
USING (owner_id = auth.uid() OR invitee_id = auth.uid());

CREATE POLICY "Agenda owners add invitations"
ON public.agenda_event_invitees FOR INSERT TO authenticated
WITH CHECK (
  owner_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.agenda_events e
    JOIN public.profiles organizer ON organizer.id = e.owner_id
    JOIN public.profiles guest ON guest.id = invitee_id
    WHERE e.id = event_id
      AND e.owner_id = auth.uid()
      AND guest.status = 'ativo'
      AND guest.active_company_id = organizer.active_company_id
  )
);

CREATE POLICY "Agenda owners remove invitations"
ON public.agenda_event_invitees FOR DELETE TO authenticated
USING (owner_id = auth.uid());

CREATE OR REPLACE FUNCTION public.agenda_list_invitable_users()
RETURNS TABLE(id uuid, full_name text, email text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.full_name, p.email
  FROM public.profiles p
  JOIN public.profiles me ON me.id = auth.uid()
  WHERE p.status = 'ativo'
    AND p.id <> auth.uid()
    AND p.active_company_id = me.active_company_id
  ORDER BY COALESCE(p.full_name, p.email)
$$;

REVOKE ALL ON FUNCTION public.agenda_list_invitable_users() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.agenda_list_invitable_users() TO authenticated;
GRANT EXECUTE ON FUNCTION public.agenda_list_invitable_users() TO service_role;

CREATE TRIGGER agenda_events_set_updated_at
BEFORE UPDATE ON public.agenda_events
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX agenda_events_owner_starts_idx ON public.agenda_events(owner_id, starts_at);
CREATE INDEX agenda_events_company_starts_idx ON public.agenda_events(company_id, starts_at);
CREATE INDEX agenda_invitees_user_idx ON public.agenda_event_invitees(invitee_id, event_id);