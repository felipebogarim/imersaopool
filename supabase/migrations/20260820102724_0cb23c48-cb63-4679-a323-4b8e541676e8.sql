CREATE TABLE IF NOT EXISTS public.app_update_templates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    subject text,
    intro text,
    farewell text,
    blocks jsonb DEFAULT '[]'::jsonb,
    status text CHECK (status IN ('draft', 'published')) DEFAULT 'draft',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.app_email_contacts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    email text UNIQUE NOT NULL,
    phone text,
    tags text[] DEFAULT '{}',
    notes text,
    active boolean DEFAULT true,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.app_email_contact_groups (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    description text,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.app_email_contact_group_members (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id uuid REFERENCES public.app_email_contact_groups(id) ON DELETE CASCADE NOT NULL,
    contact_id uuid REFERENCES public.app_email_contacts(id) ON DELETE CASCADE NOT NULL,
    created_at timestamptz DEFAULT now(),
    UNIQUE (group_id, contact_id)
);

CREATE TABLE IF NOT EXISTS public.audit_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    action text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb,
    user_id uuid REFERENCES auth.users(id),
    created_at timestamptz DEFAULT now()
);

ALTER TABLE public.app_update_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_email_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_email_contact_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_email_contact_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_update_templates TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_email_contacts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_email_contact_groups TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_email_contact_group_members TO authenticated;
GRANT SELECT, INSERT ON public.audit_log TO authenticated;

GRANT ALL ON public.app_update_templates TO service_role;
GRANT ALL ON public.app_email_contacts TO service_role;
GRANT ALL ON public.app_email_contact_groups TO service_role;
GRANT ALL ON public.app_email_contact_group_members TO service_role;
GRANT ALL ON public.audit_log TO service_role;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can do everything on templates') THEN
        CREATE POLICY "Admins can do everything on templates" ON public.app_update_templates FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can manage contacts') THEN
        CREATE POLICY "Admins can manage contacts" ON public.app_email_contacts FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can manage groups') THEN
        CREATE POLICY "Admins can manage groups" ON public.app_email_contact_groups FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can manage members') THEN
        CREATE POLICY "Admins can manage members" ON public.app_email_contact_group_members FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can view audit log') THEN
        CREATE POLICY "Admins can view audit log" ON public.audit_log FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
    END IF;
END $$;
