REVOKE EXECUTE ON FUNCTION public.kanban_is_workspace_member(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.kanban_can_access_board(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.kanban_workspace_role(uuid, uuid) FROM anon;