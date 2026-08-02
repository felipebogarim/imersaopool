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
  phone: z.string().trim().optional().default(""),
  role: roleEnum.optional(),
  origin: z.string().url(),
});

/**
 * Cria a conta (sem senha) e devolve o link de convite para o usuário
 * cadastrar a própria senha. O envio (e-mail ou WhatsApp) é escolhido na UI.
 */
export const inviteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => inviteSchema.parse(raw))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let uid: string | null = null;
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      email_confirm: true,
      user_metadata: { full_name: data.full_name || null, cargo: data.cargo || null },
    });
    if (error) {
      if (!/already|registered|exists/i.test(error.message)) throw new Error(error.message);
      const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      uid = list?.users?.find(u => u.email?.toLowerCase() === data.email.toLowerCase())?.id ?? null;
      if (!uid) throw new Error(error.message);
    } else {
      uid = created?.user?.id ?? null;
    }
    if (!uid) throw new Error("Falha ao criar usuário");

    await supabaseAdmin.from("profiles").upsert(
      {
        id: uid,
        email: data.email,
        full_name: data.full_name || null,
        cargo: data.cargo || null,
        phone: data.phone || null,
        status: "pendente",
      },
      { onConflict: "id" },
    );
    if (data.role) {
      await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: uid, role: data.role }, { onConflict: "user_id,role" });
    }

    const { email, name, link, phone } = await issueFirstAccessLink(uid, data.origin);
    return { ok: true, user_id: uid, email, name, link, phone: phone ?? data.phone ?? null };
  });


const updateSchema = z.object({
  user_id: z.string().uuid(),
  email: z.string().trim().email("E-mail inválido").optional(),
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

    if (data.email) {
      const email = data.email.toLowerCase();
      const { data: current } = await supabaseAdmin.auth.admin.getUserById(data.user_id);
      if (current?.user?.email?.toLowerCase() !== email) {
        const { error: emailErr } = await supabaseAdmin.auth.admin.updateUserById(data.user_id, {
          email,
          email_confirm: true,
        });
        if (emailErr) throw new Error(emailErr.message);
        await supabaseAdmin.from("profiles").update({ email } as never).eq("id", data.user_id);
      }
    }

    const patch: Record<string, any> = {};
    for (const k of ["full_name", "cargo", "phone", "regiao", "status"] as const) {
      if (data[k] !== undefined) patch[k] = data[k] === "" ? null : data[k];
    }
    if (Object.keys(patch).length) {
      const { error } = await supabaseAdmin.from("profiles").update(patch as never).eq("id", data.user_id);
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

const createSchema = z.object({
  email: z.string().email("E-mail inválido"),
  password: z.string().min(8, "Senha deve ter ao menos 8 caracteres"),
  full_name: z.string().trim().optional().default(""),
  cargo: z.string().trim().optional().default(""),
  role: roleEnum.default("agente"),
  must_change_password: z.boolean().default(true),
});

export const createUserWithPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => createSchema.parse(raw))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: {
        full_name: data.full_name || null,
        cargo: data.cargo || null,
        must_change_password: data.must_change_password,
      },
    });
    if (error) throw new Error(error.message);
    const uid = created?.user?.id;
    if (!uid) throw new Error("Falha ao criar usuário");

    await supabaseAdmin.from("profiles").upsert(
      {
        id: uid,
        email: data.email,
        full_name: data.full_name || null,
        cargo: data.cargo || null,
        status: "ativo",
      },
      { onConflict: "id" },
    );
    await supabaseAdmin.from("user_roles").delete().eq("user_id", uid);
    await supabaseAdmin.from("user_roles").insert({ user_id: uid, role: data.role });

    return { ok: true, user_id: uid };
  });

const firstAccessSchema = z.object({
  user_id: z.string().uuid(),
  /** Origem da aplicação, ex.: https://poolflux.app */
  origin: z.string().url(),
});

async function issueFirstAccessLink(user_id: string, origin: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: u, error: uErr } = await supabaseAdmin.auth.admin.getUserById(user_id);
  if (uErr) throw new Error(uErr.message);
  const email = u?.user?.email;
  if (!email) throw new Error("Usuário sem e-mail cadastrado");
  const name = ((u?.user?.user_metadata as any)?.full_name as string | null) ?? null;

  const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
  const { error: insErr } = await supabaseAdmin
    .from("first_access_tokens")
    .insert({ user_id, token } as never);
  if (insErr) throw new Error(insErr.message);

  const { data: prof } = await supabaseAdmin
    .from("profiles")
    .select("phone")
    .eq("id", user_id)
    .maybeSingle();

  const base = origin.replace(/\/+$/, "");
  const link = `${base}/definir-senha?t=${token}`;
  return { supabaseAdmin, email, name, link, phone: (prof as any)?.phone ?? null };
}

/**
 * Gera o convite de primeiro acesso: link pessoal onde o usuário cadastra
 * a própria senha. Não há senha temporária.
 */
export const generateFirstAccessLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => firstAccessSchema.parse(raw))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { email, name, link, phone } = await issueFirstAccessLink(data.user_id, data.origin);
    return {
      email,
      name,
      phone,
      link,
      expires_hint: "O convite é pessoal e vale por 14 dias.",
    };
  });

const sendFirstAccessSchema = z.object({
  user_id: z.string().uuid(),
  origin: z.string().url(),
});

/** Envia o convite de primeiro acesso por e-mail (infra de e-mails do app). */
export const sendFirstAccessEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => sendFirstAccessSchema.parse(raw))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { sendTransactionalEmail } = await import("@/lib/email/send.server");
    const { email, name, link } = await issueFirstAccessLink(data.user_id, data.origin);

    await sendTransactionalEmail({
      templateName: "primeiro-acesso",
      recipientEmail: email,
      idempotencyKey: `primeiro-acesso:${data.user_id}:${Date.now()}`,
      templateData: { name, link },
    });

    return { ok: true, email };
  });



