
REVOKE EXECUTE ON FUNCTION public.kanban_is_workspace_member(UUID, UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.kanban_workspace_role(UUID, UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.kanban_can_access_board(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.kanban_is_workspace_member(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.kanban_workspace_role(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.kanban_can_access_board(UUID, UUID) TO authenticated;
