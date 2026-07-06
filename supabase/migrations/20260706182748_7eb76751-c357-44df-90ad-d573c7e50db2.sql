
ALTER TABLE public.profiles
  ADD COLUMN nda_accepted_at TIMESTAMPTZ,
  ADD COLUMN nda_version TEXT;
