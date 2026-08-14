import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { KanbanRole } from "./kanban-types";

/**
 * Grant admin access to all active Kanban workspaces for a user.
 * This is a one-time operation for system maintenance.
 * Version with logs for visibility.
 */
export const grantAdminAccessToWorkspaces = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ userId: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    console.log("[Maintenance] Starting grantAdminAccessToWorkspaces for:", data.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Get all active workspaces
    const { data: workspaces, error: wsError } = await supabaseAdmin
      .from("kanban_workspaces")
      .select("id, name")
      .is("archived_at", null);

    if (wsError) {
      console.error("[Maintenance] Workspace fetch error:", wsError);
      throw wsError;
    }
    
    if (!workspaces || workspaces.length === 0) {
      console.log("[Maintenance] No workspaces found");
      return { count: 0 };
    }

    console.log(`[Maintenance] Found ${workspaces.length} workspaces:`, workspaces.map(w => w.name).join(", "));

    // 2. Grant access
    const members = workspaces.map(ws => ({
      workspace_id: ws.id,
      user_id: data.userId,
      role: "admin" as KanbanRole,
    }));

    const { error: upsertError } = await supabaseAdmin
      .from("kanban_workspace_members")
      .upsert(members, { onConflict: "workspace_id,user_id" });

    if (upsertError) {
      console.error("[Maintenance] Upsert error:", upsertError);
      throw upsertError;
    }

    // 3. Update profile to active (to be safe)
    await supabaseAdmin
      .from("profiles")
      .update({ status: 'ativo' })
      .eq('id', data.userId);

    // 4. Ensure admin role
    await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: data.userId, role: 'admin' }, { onConflict: 'user_id,role' });

    console.log("[Maintenance] Successfully granted access to all workspaces and updated profile");
    return { count: workspaces.length };
  });
