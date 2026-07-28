DO $$
DECLARE
  r record;
  anon_ok text[] := ARRAY['get_active_form_by_slug','submit_form_response','log_auth_failure',
                          'get_immersion_by_token','submit_representative_input'];
  auth_ok text[] := ARRAY['admin_anonymize_profile','admin_conformidade_kpis','admin_list_terms_conformidade',
                          'admin_list_users','admin_log_purge_action','admin_log_session_revocation',
                          'admin_mfa_start_enforcement','compute_bi_shares','get_admin_mfa_status',
                          'get_my_terms_status','kanban_can_access_board','kanban_is_workspace_member',
                          'kanban_workspace_role','log_mfa_event','log_performance_import',
                          'log_security_event','log_sensitive_access','record_login_acknowledgement',
                          'record_terms_acceptance','sec_intrusion_summary','submit_performance_upload',
                          'list_storage_objects'];
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig, p.proname
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.sig);
    IF r.proname = ANY(anon_ok) THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO anon, authenticated', r.sig);
    ELSIF r.proname = ANY(auth_ok) THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', r.sig);
    END IF;
  END LOOP;
END $$;