GRANT SELECT, INSERT, UPDATE, DELETE ON public.field_immersion_v2_reports TO authenticated;
GRANT ALL ON public.field_immersion_v2_reports TO service_role;

CREATE POLICY "Users can update their company immersion reports"
ON public.field_immersion_v2_reports FOR UPDATE TO authenticated
USING (company_id IN (SELECT profiles.company_id FROM profiles WHERE profiles.id = auth.uid()))
WITH CHECK (company_id IN (SELECT profiles.company_id FROM profiles WHERE profiles.id = auth.uid()));

CREATE POLICY "Users can delete their company immersion reports"
ON public.field_immersion_v2_reports FOR DELETE TO authenticated
USING (company_id IN (SELECT profiles.company_id FROM profiles WHERE profiles.id = auth.uid()));