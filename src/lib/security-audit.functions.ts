import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const runSecurityAudit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");

    const { executeAudit } = await import("@/lib/security-audit-run.server");
    const res = await executeAudit(context.userId, "manual");
    return { audit_id: res.audit_id, score: res.score, contagem: res.contagem, duracao_ms: res.duracao_ms };
  });
