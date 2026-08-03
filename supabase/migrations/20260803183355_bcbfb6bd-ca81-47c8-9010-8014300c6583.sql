ALTER TABLE public.admin_mfa_policy DISABLE TRIGGER USER;
UPDATE public.admin_mfa_policy SET enforcement_started_at = now(), grace_period_days = COALESCE(grace_period_days, 7), updated_at = now() WHERE id = true;
ALTER TABLE public.admin_mfa_policy ENABLE TRIGGER USER;