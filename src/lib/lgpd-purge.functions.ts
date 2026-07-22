import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const schema = z.object({
  target_user_id: z.string().uuid(),
  request_type: z.enum(["revoke_sessions", "anonymize", "delete"]),
  justificativa: z.string().min(10, "Justificativa mínima de 10 caracteres"),
});

export const executePurgeAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => schema.parse(raw))
  .handler(async ({ data, context }) => {
    // Verifica admin via RLS-scoped client
    const { data: isAdmin, error: roleErr } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin" as const,
    });
    if (roleErr) throw new Error(roleErr.message);
    if (!isAdmin) throw new Error("Acesso negado: apenas administradores");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let status: "executado" | "falhou" = "executado";
    let errorMsg: string | null = null;

    try {
      if (data.request_type === "revoke_sessions") {
        const { error } = await supabaseAdmin.auth.admin.signOut(data.target_user_id, "global");
        if (error) throw error;
      } else if (data.request_type === "anonymize") {
        const { error } = await supabaseAdmin.rpc("admin_anonymize_profile" as any, {
          _target_user_id: data.target_user_id,
          _justificativa: data.justificativa,
        });
        if (error) throw error;
        // anonymize já loga via RPC; sair aqui
        return { ok: true };
      } else if (data.request_type === "delete") {
        const { error } = await supabaseAdmin.auth.admin.deleteUser(data.target_user_id);
        if (error) throw error;
      }
    } catch (e: any) {
      status = "falhou";
      errorMsg = e?.message ?? String(e);
    }

    const { error: logErr } = await supabaseAdmin.rpc("admin_log_purge_action" as any, {
      _target_user_id: data.target_user_id,
      _request_type: data.request_type,
      _justificativa: data.justificativa,
      _status: status,
      _error: errorMsg,
      _metadata: {},
    });
    if (logErr) throw new Error(`Falha ao registrar auditoria: ${logErr.message}`);

    if (status === "falhou") throw new Error(errorMsg ?? "Falha ao executar ação");
    return { ok: true };
  });
