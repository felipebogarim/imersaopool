import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { KanbanRole } from "./kanban-types";

/**
 * Grant admin access to all active Kanban workspaces for a user.
 * This is a one-time operation for system maintenance.
 */
export const grantAdminAccessToWorkspaces = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ userId: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: workspaces, error: wsError } = await supabaseAdmin
      .from("kanban_workspaces")
      .select("id")
      .is("archived_at", null);

    if (wsError) throw wsError;
    if (!workspaces || workspaces.length === 0) return { count: 0 };

    const members = workspaces.map(ws => ({
      workspace_id: ws.id,
      user_id: data.userId,
      role: "admin" as KanbanRole,
    }));

    const { error: upsertError } = await supabaseAdmin
      .from("kanban_workspace_members")
      .upsert(members, { onConflict: "workspace_id,user_id" });

    if (upsertError) throw upsertError;

    return { count: workspaces.length };
  });
