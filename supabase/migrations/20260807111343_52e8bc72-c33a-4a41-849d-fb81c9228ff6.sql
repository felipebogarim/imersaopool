-- Trigger function: never callable directly
REVOKE EXECUTE ON FUNCTION public.rep_perf_restore_on_delete() FROM PUBLIC, anon, authenticated;

-- Admin/internal RPCs: no anonymous access
DO $$
DECLARE fn text;
BEGIN
  FOR fn IN SELECT format('%I.%I(%s)', n.nspname, p.proname, pg_get_function_identity_arguments(p.oid))
            FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
            WHERE n.nspname = 'public' AND p.prosecdef
              AND p.proname NOT IN ('get_active_form_by_slug','submit_form_response','get_immersion_by_token','submit_representative_input','log_auth_failure')
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', fn);
  END LOOP;
END $$;

-- Restore explicit authenticated access for RPCs the app calls while signed in
GRANT EXECUTE ON FUNCTION
  public.admin_anonymize_profile(uuid, text),
  public.admin_conformidade_kpis(),
  public.admin_list_terms_conformidade(),
  public.admin_list_users(),
  public.admin_log_purge_action(uuid, text, text, text, text, jsonb),
  public.compute_bi_shares(uuid),
  public.get_admin_mfa_status(),
  public.get_my_terms_status(),
  public.kanban_can_access_board(uuid, uuid),
  public.kanban_is_workspace_member(uuid, uuid),
  public.kanban_workspace_role(uuid, uuid),
  public.list_storage_objects(),
  public.log_mfa_event(admin_mfa_event, uuid, jsonb),
  public.log_performance_import(jsonb),
  public.log_security_event(text, text, text, text, text, jsonb),
  public.log_sensitive_access(text, text, jsonb, text),
  public.reactivate_last_performance_upload(uuid),
  public.record_login_acknowledgement(text, text),
  public.record_terms_acceptance(text, text),
  public.reprocessar_fontes_entrevistas(),
  public.sec_intrusion_summary(integer),
  public.submit_performance_upload(jsonb)
TO authenticated;
