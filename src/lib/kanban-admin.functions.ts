import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const grantAdminAccessToWorkspaces = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ userId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    // Verify requester is admin
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Unauthorized");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Get all active workspaces
    const { data: workspaces } = await supabaseAdmin
      .from("kanban_workspaces")
      .select("id")
      .is("archived_at", null);

    if (!workspaces || workspaces.length === 0) return { count: 0 };

    // Grant access
    const members = workspaces.map(ws => ({
      workspace_id: ws.id,
      user_id: data.userId,
      role: "admin",
    }));

    const { error } = await supabaseAdmin
      .from("kanban_workspace_members")
      .upsert(members, { onConflict: "workspace_id,user_id" });

    if (error) throw error;

    return { count: workspaces.length };
  });
