import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const tokenSchema = z.object({ token: z.string().min(16) });

const setSchema = z.object({
  token: z.string().min(16),
  password: z
    .string()
    .min(8, "A senha deve ter ao menos 8 caracteres")
    .regex(/[A-Za-z]/, "A senha deve conter letras")
    .regex(/[0-9]/, "A senha deve conter números")
    .regex(/[^A-Za-z0-9]/, "A senha deve conter símbolos"),
});

async function loadValidToken(token: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("first_access_tokens")
    .select("id, user_id, expires_at, used_at")
    .eq("token", token)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return { supabaseAdmin, row: null as null | typeof data, reason: "invalid" as const };
  if (data.used_at) return { supabaseAdmin, row: null, reason: "used" as const };
  if (new Date(data.expires_at).getTime() < Date.now()) {
    return { supabaseAdmin, row: null, reason: "expired" as const };
  }
  return { supabaseAdmin, row: data, reason: null };
}

export const checkFirstAccessToken = createServerFn({ method: "POST" })
  .inputValidator((raw) => tokenSchema.parse(raw))
  .handler(async ({ data }) => {
    const { supabaseAdmin, row, reason } = await loadValidToken(data.token);
    if (!row) return { valid: false as const, reason };
    const { data: u } = await supabaseAdmin.auth.admin.getUserById(row.user_id);
    return {
      valid: true as const,
      email: u?.user?.email ?? "",
      name: ((u?.user?.user_metadata as any)?.full_name as string | null) ?? null,
    };
  });

export const setPasswordFromToken = createServerFn({ method: "POST" })
  .inputValidator((raw) => setSchema.parse(raw))
  .handler(async ({ data }) => {
    const { supabaseAdmin, row, reason } = await loadValidToken(data.token);
    if (!row) throw new Error(
      reason === "used"
        ? "Este convite já foi utilizado."
        : reason === "expired"
          ? "Este convite expirou. Peça um novo ao administrador."
          : "Convite inválido.",
    );

    const { data: u, error: uErr } = await supabaseAdmin.auth.admin.getUserById(row.user_id);
    if (uErr) throw new Error(uErr.message);
    const email = u?.user?.email;
    if (!email) throw new Error("Usuário sem e-mail cadastrado");

    const { error } = await supabaseAdmin.auth.admin.updateUserById(row.user_id, {
      password: data.password,
      email_confirm: true,
      user_metadata: { ...(u?.user?.user_metadata ?? {}), must_change_password: false },
    });
    if (error) throw new Error(error.message);

    await supabaseAdmin
      .from("first_access_tokens")
      .update({ used_at: new Date().toISOString() } as never)
      .eq("id", row.id);

    await supabaseAdmin.from("profiles").update({ status: "ativo" } as never).eq("id", row.user_id);

    return { ok: true as const, email };
  });
