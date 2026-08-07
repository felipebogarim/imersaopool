
CREATE TABLE public.field_immersion_v2_reports (
    id uuid primary key default gen_random_uuid(),
    client_name text not null,
    visit_date date not null,
    source_filename text not null,
    content_markdown text not null,
    structured_data jsonb not null, 
    schema_version text not null default 'visao_imersao_2_data_v1',
    created_at timestamptz default now() not null,
    created_by uuid references auth.users(id) on delete set null,
    company_id uuid references public.companies(id) on delete cascade
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.field_immersion_v2_reports TO authenticated;
GRANT ALL ON public.field_immersion_v2_reports TO service_role;

ALTER TABLE public.field_immersion_v2_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their company immersion reports" 
ON public.field_immersion_v2_reports FOR SELECT 
TO authenticated 
USING (
    company_id IN (
        SELECT company_id FROM public.profiles WHERE id = auth.uid()
    )
);

CREATE POLICY "Users can insert immersion reports" 
ON public.field_immersion_v2_reports FOR INSERT 
TO authenticated 
WITH CHECK (true);
