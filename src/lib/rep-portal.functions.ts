import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  ACTION_FILES_BUCKET,
  ACTION_MAX_FILE_BYTES,
  ACTION_STATUSES,
  formatPrazo,
  sanitizeFileName,
  validateExtensionDate,
} from "@/lib/action-tracking";

/** Só admin/gestor (equipe interna) executa as ações de gestão do portal. */
async function assertStaff(context: {
  supabase: { rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown }> };
  userId: string;
}) {
  const roles = await Promise.all(
    (["admin", "gestor"] as const).map((role) =>
      context.supabase.rpc("has_role", { _user_id: context.userId, _role: role }),
    ),
  );
  if (!roles.some((r) => r.data === true)) throw new Error("Sem permissão.");
}

/** Dados do portal: só o representante vinculado ao usuário logado. */
export const getRepPortal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { repForUser, loadPortal } = await import("@/lib/rep-portal.server");
    const rep = await repForUser(context.userId);
    return { rep: { id: rep.id, nome: rep.nome }, actions: await loadPortal(rep) };
  });

export const repRespondSuggestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      cardId: z.string().uuid(),
      decision: z.enum(["aceita", "recusada"]),
      note: z.string().max(2000).optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    const { repForUser, ownedAction } = await import("@/lib/rep-portal.server");
    const { recordSuggestionResponse } = await import("@/lib/action-tracking.server");
    const rep = await repForUser(context.userId);
    const card = await ownedAction(rep, data.cardId);
    await recordSuggestionResponse({
      card,
      repName: rep.nome,
      decision: data.decision,
      note: data.note,
    });
    return { ok: true as const };
  });

export const repCreateUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      cardId: z.string().uuid(),
      fileName: z.string().min(1).max(300),
      size: z.number().int().positive().max(ACTION_MAX_FILE_BYTES),
    }),
  )
  .handler(async ({ data, context }) => {
    const { repForUser, ownedAction } = await import("@/lib/rep-portal.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const rep = await repForUser(context.userId);
    await ownedAction(rep, data.cardId);
    const path = `${data.cardId}/${crypto.randomUUID()}-${sanitizeFileName(data.fileName)}`;
    const { data: signed, error } = await supabaseAdmin.storage
      .from(ACTION_FILES_BUCKET)
      .createSignedUploadUrl(path);
    if (error || !signed) throw new Error("Não foi possível preparar o envio do arquivo.");
    return { path, uploadToken: signed.token };
  });

export const repSubmitUpdate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      cardId: z.string().uuid(),
      status: z.enum(ACTION_STATUSES).nullish(),
      note: z.string().max(5000).nullish(),
      files: z
        .array(
          z.object({
            path: z.string().max(600),
            name: z.string().max(300),
            mime: z.string().max(200).nullish(),
            size: z.number().nullish(),
          }),
        )
        .max(20)
        .default([]),
    }),
  )
  .handler(async ({ data, context }) => {
    const { repForUser, recordRepUpdate } = await import("@/lib/rep-portal.server");
    const rep = await repForUser(context.userId);
    await recordRepUpdate({ rep, ...data });
    return { ok: true as const };
  });

export const repRequestExtension = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      cardId: z.string().uuid(),
      requestedDue: z.string(),
      justification: z.string().trim().min(5, "Explique o motivo (mín. 5 caracteres).").max(2000),
    }),
  )
  .handler(async ({ data, context }) => {
    const { repForUser, ownedAction, recordExtensionRequest } =
      await import("@/lib/rep-portal.server");
    const rep = await repForUser(context.userId);
    const card = await ownedAction(rep, data.cardId);
    const invalid = validateExtensionDate(data.requestedDue, card.due_date);
    if (invalid) throw new Error(invalid);
    await recordExtensionRequest({ rep, ...data });
    return { ok: true as const };
  });

/** Equipe aprova/recusa um pedido de prorrogação; aprovando, o prazo do card é atualizado. */
export const decideExtension = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      id: z.string().uuid(),
      decision: z.enum(["aprovada", "recusada"]),
      note: z.string().max(1000).optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context as never);
    // Leitura com o cliente do usuário (RLS): só decide quem já enxerga o card.
    const { data: ext, error } = await context.supabase
      .from("kanban_action_extension_requests" as never)
      .select("id, card_id, representative_id, requested_due, status")
      .eq("id", data.id)
      .maybeSingle();
    const row = ext as null | {
      id: string;
      card_id: string;
      representative_id: string;
      requested_due: string;
      status: string;
    };
    if (error || !row) throw new Error("Pedido não encontrado.");
    if (row.status !== "pendente") throw new Error("Este pedido já foi respondido.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { sendSystemEmail } = await import("@/lib/action-tracking.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = supabaseAdmin as any;
    const note = data.note?.trim() || null;
    const now = new Date().toISOString();
    await admin
      .from("kanban_action_extension_requests")
      .update({
        status: data.decision,
        decided_by: context.userId,
        decided_at: now,
        decision_note: note,
      })
      .eq("id", row.id);
    if (data.decision === "aprovada") {
      await admin
        .from("kanban_cards")
        .update({ due_date: row.requested_due })
        .eq("id", row.card_id);
    }
    const label = data.decision === "aprovada" ? "Prorrogação aprovada" : "Prorrogação recusada";
    await admin.from("kanban_action_updates").insert({
      card_id: row.card_id,
      source: "interno",
      author_name: "Equipe",
      note: `${label}${data.decision === "aprovada" ? ` (novo prazo ${formatPrazo(row.requested_due)})` : ""}${note ? `: ${note}` : ""}`,
      created_by: context.userId,
    });

    const [{ data: rep }, { data: card }] = await Promise.all([
      admin
        .from("representatives")
        .select("nome, email")
        .eq("id", row.representative_id)
        .maybeSingle(),
      admin.from("kanban_cards").select("title").eq("id", row.card_id).maybeSingle(),
    ]);
    if (rep?.email) {
      await sendSystemEmail({
        templateName: "acao-prorrogacao-decisao",
        to: rep.email,
        idempotencyKey: `acao-ext-${row.id}`,
        templateData: {
          repName: rep.nome,
          title: card?.title,
          decision: data.decision,
          newDue: formatPrazo(row.requested_due),
          note: note ?? undefined,
        },
      });
    }
    return { ok: true as const };
  });

/** Cria o acesso do representante ao portal e envia o convite para definir a senha. */
export const createRepPortalAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ repId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    await assertStaff(context as never);
    const { provisionRepAccess } = await import("@/lib/rep-portal.server");
    return provisionRepAccess(data.repId);
  });
