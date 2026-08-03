GRANT EXECUTE ON FUNCTION public.kanban_is_workspace_member(uuid, uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.kanban_can_access_board(uuid, uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.kanban_workspace_role(uuid, uuid) TO authenticated, anon;