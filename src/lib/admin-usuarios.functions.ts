import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const roleEnum = z.enum(["admin", "gestor", "agente", "comercial"]);

async function assertAdmin(context: any) {
  const { data: isAdmin, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin" as const,
  });
  if (error) throw new Error(error.message);
  if (!isAdmin) throw new Error("Acesso negado: apenas administradores");
}

const inviteSchema = z.object({
  email: z.string().email("E-mail inválido"),
  full_name: z.string().trim().optional().default(""),
  cargo: z.string().trim().optional().default(""),
  role: roleEnum.optional(),
  redirect_to: z.string().url().optional(),
});

export const inviteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => inviteSchema.parse(raw))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: invited, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      data.email,
      {
        redirectTo: data.redirect_to,
        data: { full_name: data.full_name || null, cargo: data.cargo || null },
      },
    );
    if (error) throw new Error(error.message);

    const uid = invited?.user?.id;
    if (uid) {
      await supabaseAdmin
        .from("profiles")
        .upsert(
          {
            id: uid,
            email: data.email,
            full_name: data.full_name || null,
            cargo: data.cargo || null,
            status: "pendente",
          },
          { onConflict: "id" },
        );
      if (data.role) {
        await supabaseAdmin
          .from("user_roles")
          .upsert({ user_id: uid, role: data.role }, { onConflict: "user_id,role" });
      }
    }
    return { ok: true, user_id: uid ?? null };
  });

const updateSchema = z.object({
  user_id: z.string().uuid(),
  full_name: z.string().trim().nullable().optional(),
  cargo: z.string().trim().nullable().optional(),
  phone: z.string().trim().nullable().optional(),
  regiao: z.string().trim().nullable().optional(),
  status: z.enum(["pendente", "aprovado", "ativo", "inativo"]).optional(),
  role: roleEnum.nullable().optional(),
});

export const updateUserProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => updateSchema.parse(raw))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const patch: Record<string, any> = {};
    for (const k of ["full_name", "cargo", "phone", "regiao", "status"] as const) {
      if (data[k] !== undefined) patch[k] = data[k] === "" ? null : data[k];
    }
    if (Object.keys(patch).length) {
      const { error } = await supabaseAdmin.from("profiles").update(patch).eq("id", data.user_id);
      if (error) throw new Error(error.message);
    }

    if (data.role !== undefined) {
      const { error: delErr } = await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", data.user_id);
      if (delErr) throw new Error(delErr.message);
      if (data.role) {
        const { error: insErr } = await supabaseAdmin
          .from("user_roles")
          .insert({ user_id: data.user_id, role: data.role });
        if (insErr) throw new Error(insErr.message);
      }
    }
    return { ok: true };
  });

const deleteSchema = z.object({ user_id: z.string().uuid() });

export const deleteUserAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => deleteSchema.parse(raw))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (data.user_id === context.userId) throw new Error("Você não pode remover a si mesmo");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.user_id);
    if (error && !/not found/i.test(error.message)) throw new Error(error.message);
    await supabaseAdmin.from("profiles").delete().eq("id", data.user_id);
    return { ok: true };
  });

const auditSchema = z.object({ user_id: z.string().uuid(), limit: z.number().min(1).max(200).default(50) });

export const getUserAudit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => auditSchema.parse(raw))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("security_events")
      .select("id, tipo, acao, recurso, resultado, nivel_risco, ip, user_agent, ocorrido_em")
      .eq("usuario_id", data.user_id)
      .order("ocorrido_em", { ascending: false })
      .limit(data.limit);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });
