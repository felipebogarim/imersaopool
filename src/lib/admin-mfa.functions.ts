import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Superadmin recovery: removes ALL MFA factors for a target user and signs
 * them out of every session. Requires the caller to be admin AND at AAL2.
 * Writes an immutable audit entry with mandatory justification.
 */
export const adminMfaRecoverUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: { target_user_id: string; justificativa: string }) => {
    if (!raw?.target_user_id) throw new Error("target_user_id obrigatório");
    if (!raw?.justificativa || raw.justificativa.trim().length < 10) {
      throw new Error("Justificativa mínima de 10 caracteres");
    }
    return raw;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId, claims } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");
    if ((claims as any)?.aal !== "aal2") {
      throw new Error("Recuperação de MFA exige que o admin esteja em AAL2.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: factors, error: e1 } = await supabaseAdmin.auth.admin.mfa.listFactors({
      userId: data.target_user_id,
    });
    if (e1) throw new Error(e1.message);

    const removed: string[] = [];
    for (const f of factors?.factors ?? []) {
      const { error } = await supabaseAdmin.auth.admin.mfa.deleteFactor({
        userId: data.target_user_id,
        id: f.id,
      });
      if (!error) removed.push(f.id);
    }

    await supabaseAdmin.auth.admin.signOut(data.target_user_id, "global").catch(() => {});

    await supabaseAdmin.from("admin_mfa_audit").insert({
      actor_id: userId,
      user_id: data.target_user_id,
      event_type: "recovery_executed",
      metadata: { factors_removed: removed, justificativa: data.justificativa },
    });

    // Notify the target admin by e-mail (best-effort; never blocks the recovery).
    try {
      const { data: targetUser } = await supabaseAdmin.auth.admin.getUserById(data.target_user_id);
      const { data: actorUser } = await supabaseAdmin.auth.admin.getUserById(userId);
      const targetEmail = targetUser?.user?.email;
      if (targetEmail) {
        const { sendTransactionalEmail } = await import("@/lib/email/send.server");
        await sendTransactionalEmail({
          templateName: "mfa-factor-removed",
          recipientEmail: targetEmail,
          idempotencyKey: `mfa-recovery-${data.target_user_id}-${Date.now()}`,
          templateData: {
            name: (targetUser?.user?.user_metadata as any)?.full_name ?? targetEmail,
            actorName: actorUser?.user?.email ?? "superadministrador",
            justificativa: data.justificativa,
            when: new Date().toLocaleString("pt-BR"),
          },
        });
      }
    } catch (err) {
      console.error("[mfa-recovery] email notify failed", err);
    }

    return { ok: true, factors_removed: removed.length };
  });

/**
 * Superadmin: toggle MFA enforcement policy for admins.
 * Enforcement is active when enforcement_started_at IS NOT NULL. Grace ends
 * at enforcement_started_at + grace_period_days.
 */
export const adminMfaSetPolicy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: { enforce: boolean; grace_days?: number; justificativa: string }) => {
    if (typeof raw?.enforce !== "boolean") throw new Error("enforce obrigatório");
    if (!raw?.justificativa || raw.justificativa.trim().length < 10) {
      throw new Error("Justificativa mínima de 10 caracteres");
    }
    return raw;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId, claims } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");
    if ((claims as any)?.aal !== "aal2") {
      throw new Error("Alterar política exige que o admin esteja em AAL2.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const now = new Date().toISOString();
    const grace = Math.max(1, Math.min(30, data.grace_days ?? 7));

    const { error } = await supabaseAdmin
      .from("admin_mfa_policy")
      .update({
        enforcement_started_at: data.enforce ? now : null,
        grace_period_days: grace,
        updated_by: userId,
        updated_at: now,
      })
      .eq("id", true);
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("admin_mfa_audit").insert({
      actor_id: userId,
      user_id: userId,
      event_type: "policy_changed",
      metadata: {
        enforce: data.enforce,
        grace_days: grace,
        justificativa: data.justificativa,
      },
    });

    return { ok: true };
  });
