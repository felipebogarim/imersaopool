CREATE OR REPLACE FUNCTION public.handle_new_user_contact()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.app_email_contacts (name, email, tags)
    VALUES (COALESCE(new.raw_user_meta_data->>'full_name', new.email), new.email, ARRAY['sistema'])
    ON CONFLICT (email) DO NOTHING;
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE ALL ON FUNCTION public.handle_new_user_contact() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.handle_new_user_contact() TO service_role;
