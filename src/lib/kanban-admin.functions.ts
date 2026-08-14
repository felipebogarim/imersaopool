import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { KanbanRole } from "./kanban-types";

export const grantAdminAccessToWorkspaces = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ userId: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    console.log("Starting grantAdminAccessToWorkspaces for", data.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Get all active workspaces
    const { data: workspaces, error: wsError } = await supabaseAdmin
      .from("kanban_workspaces")
      .select("id")
      .is("archived_at", null);

    if (wsError) {
       console.error("Workspace fetch error:", wsError);
       throw wsError;
    }
    
    if (!workspaces || workspaces.length === 0) {
      console.log("No workspaces found");
      return { count: 0 };
    }

    console.log(`Found ${workspaces.length} workspaces. Granting access to ${data.userId}`);

    // Grant access
    const members = workspaces.map(ws => ({
      workspace_id: ws.id,
      user_id: data.userId,
      role: "admin" as KanbanRole,
    }));

    const { error: upsertError } = await supabaseAdmin
      .from("kanban_workspace_members")
      .upsert(members, { onConflict: "workspace_id,user_id" });

    if (upsertError) {
      console.error("Upsert error:", upsertError);
      throw upsertError;
    }

    console.log("Successfully granted access");
    return { count: workspaces.length };
  });
