import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Superadmin recovery: removes ALL MFA factors for a target user and signs
 * them out of every session. Requires the caller to be admin AND to be at
 * AAL2. Records an immutable audit entry with mandatory justification.
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

    const aal = (claims as any)?.aal;
    if (aal !== "aal2") {
      throw new Error("Recuperação de MFA exige que o admin esteja em AAL2.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // list factors
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

    // sign out all sessions of the target
    await supabaseAdmin.auth.admin.signOut(data.target_user_id, "global").catch(() => {});

    await supabaseAdmin.from("admin_mfa_audit").insert({
      actor_user_id: userId,
      target_user_id: data.target_user_id,
      event: "recovered_by_superadmin",
      justificativa: data.justificativa,
      metadata: { factors_removed: removed },
    });

    return { ok: true, factors_removed: removed.length };
  });

/**
 * Superadmin: activate / update MFA enforcement policy for admins.
 * Only admins with an active verified TOTP factor may enable enforcement
 * (guard also enforced by DB trigger).
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

    const patch: Record<string, unknown> = {
      enforce_mfa: data.enforce,
      grace_period_days: grace,
      updated_by: userId,
      updated_at: now,
    };
    if (data.enforce) {
      // start the countdown only when turning enforcement ON
      patch.enforcement_started_at = now;
    } else {
      patch.enforcement_started_at = null;
    }

    const { error } = await supabaseAdmin
      .from("admin_mfa_policy")
      .update(patch)
      .eq("id", 1);
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("admin_mfa_audit").insert({
      actor_user_id: userId,
      target_user_id: userId,
      event: data.enforce ? "policy_enabled" : "policy_disabled",
      justificativa: data.justificativa,
      metadata: { grace_days: grace },
    });

    return { ok: true };
  });
