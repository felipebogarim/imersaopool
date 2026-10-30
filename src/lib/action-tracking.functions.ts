import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  ACTION_FILES_BUCKET,
  ACTION_MAX_FILE_BYTES,
  ACTION_STATUS_LABEL,
  ACTION_STATUSES,
  hasUpdateContent,
  readActionMeta,
  sanitizeFileName,
  type ActionStatus,
} from "@/lib/action-tracking";

const tokenSchema = z.string().regex(/^[0-9a-f]{64}$/);

/** Cobrança manual ("Solicitar atualização agora"): só admin/gestor. */
export const requestActionUpdatesNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      repIds: z.array(z.string().uuid()).max(200).optional(),
      force: z.boolean().optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    const roles = await Promise.all(
      (["admin", "gestor"] as const).map((role) =>
        context.supabase.rpc("has_role", { _user_id: context.userId, _role: role }),
      ),
    );
    if (!roles.some((r) => r.data === true))
      throw new Error("Sem permissão para solicitar atualizações.");
    const { runActionRequests } = await import("@/lib/action-tracking.server");
    const results = await runActionRequests({
      repIds: data.repIds,
      force: data.force,
      sentBy: context.userId,
    });
    return {
      sent: results.filter((r) => r.sent).length,
      skipped: results
        .filter((r) => !r.sent)
        .map((r) => ({ repId: r.repId, reason: r.reason ?? "unknown" })),
    };
  });

export type PublicActionForm =
  | {
      valid: true;
      repName: string;
      expiresAt: string;
      actions: {
        id: string;
        title: string;
        client?: string;
        due_date: string | null;
        status: ActionStatus;
        people: { id: string; name: string }[];
      }[];
    }
  | { valid: false; reason: "not_found" | "expired" };

export const getPublicActionForm = createServerFn({ method: "POST" })
  .inputValidator(z.object({ token: tokenSchema }))
  .handler(async ({ data }): Promise<PublicActionForm> => {
    const { lookupRequest, listActionsForRep, listCardPeople } =
      await import("@/lib/action-tracking.server");
    const req = await lookupRequest(data.token);
    if (!req.valid) return req;
    const actions = await listActionsForRep(req.repId, { includeDone: true });
    const people = await listCardPeople(actions.map((a) => a.id));
    return {
      valid: true,
      repName: req.repName,
      expiresAt: req.expiresAt,
      actions: actions.map((a) => ({
        id: a.id,
        title: a.title,
        client: readActionMeta(a.metadata).client_name,
        due_date: a.due_date,
        status: a.status,
        people: people.get(a.id) ?? [],
      })),
    };
  });

/** URL assinada para o representante enviar um anexo direto ao bucket privado. */
export const createPublicActionUpload = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      token: tokenSchema,
      cardId: z.string().uuid(),
      fileName: z.string().min(1).max(300),
      size: z.number().int().positive().max(ACTION_MAX_FILE_BYTES),
    }),
  )
  .handler(async ({ data }) => {
    const { lookupRequest, listActionsForRep } = await import("@/lib/action-tracking.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const req = await lookupRequest(data.token);
    if (!req.valid) throw new Error("Link inválido ou expirado.");
    const actions = await listActionsForRep(req.repId, { includeDone: true });
    if (!actions.some((a) => a.id === data.cardId))
      throw new Error("Ação não pertence a este link.");
    const path = `${data.cardId}/${crypto.randomUUID()}-${sanitizeFileName(data.fileName)}`;
    const { data: signed, error } = await supabaseAdmin.storage
      .from(ACTION_FILES_BUCKET)
      .createSignedUploadUrl(path);
    if (error || !signed) throw new Error("Não foi possível preparar o envio do arquivo.");
    return { path, uploadToken: signed.token };
  });

const updateSchema = z.object({
  cardId: z.string().uuid(),
  status: z.enum(ACTION_STATUSES).nullish(),
  note: z.string().max(5000).nullish(),
  pendencias: z
    .array(
      z.object({
        description: z.string().max(1000),
        assigneeName: z.string().max(200),
        assigneeUserId: z.string().uuid().nullish(),
      }),
    )
    .max(20)
    .optional(),
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
    .optional(),
});

export const submitPublicActionUpdate = createServerFn({ method: "POST" })
  .inputValidator(z.object({ token: tokenSchema, updates: z.array(updateSchema).max(100) }))
  .handler(async ({ data }) => {
    const { lookupRequest, listActionsForRep, notifySubmission } =
      await import("@/lib/action-tracking.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = supabaseAdmin as any;

    const req = await lookupRequest(data.token);
    if (!req.valid) throw new Error("Link inválido ou expirado.");
    const actions = await listActionsForRep(req.repId, { includeDone: true });
    const byId = new Map(actions.map((a) => [a.id, a]));
    const { data: rep } = await admin
      .from("representatives")
      .select("email")
      .eq("id", req.repId)
      .maybeSingle();

    const submissionId = crypto.randomUUID();
    const notified: Parameters<typeof notifySubmission>[0]["items"] = [];

    for (const u of data.updates) {
      const card = byId.get(u.cardId);
      if (!card || !hasUpdateContent(u, card.status)) continue;
      const files = (u.files ?? []).filter((f) => f.path.startsWith(`${u.cardId}/`));
      const pendencias = (u.pendencias ?? []).filter(
        (p) => p.description.trim() && p.assigneeName.trim(),
      );
      const note = u.note?.trim() || null;

      const { data: upd, error } = await admin
        .from("kanban_action_updates")
        .insert({
          card_id: u.cardId,
          source: "representante",
          author_name: req.repName,
          status: u.status ?? null,
          note,
        })
        .select("id")
        .single();
      if (error) throw new Error("Falha ao salvar a atualização.");

      if (u.status && u.status !== card.status) {
        await admin.from("kanban_action_tracking").upsert({
          card_id: u.cardId,
          status: u.status,
          updated_at: new Date().toISOString(),
          updated_by_name: req.repName,
        });
      }
      if (files.length) {
        await admin.from("kanban_action_update_files").insert(
          files.map((f) => ({
            update_id: upd.id,
            card_id: u.cardId,
            storage_path: f.path,
            file_name: f.name,
            mime_type: f.mime ?? null,
            size_bytes: f.size ?? null,
          })),
        );
      }
      if (pendencias.length) {
        await admin.from("kanban_action_pendencias").insert(
          pendencias.map((p) => ({
            card_id: u.cardId,
            update_id: upd.id,
            description: p.description.trim(),
            assignee_user_id: p.assigneeUserId ?? null,
            assignee_name: p.assigneeName.trim(),
          })),
        );
      }

      const meta = readActionMeta(card.metadata);
      const { data: created } = await admin
        .from("kanban_cards")
        .select("created_by")
        .eq("id", u.cardId)
        .maybeSingle();
      notified.push({
        cardId: u.cardId,
        title: card.title,
        client: meta.client_name,
        statusLabel: ACTION_STATUS_LABEL[u.status ?? card.status],
        note: note ?? undefined,
        pendencias: pendencias.map((p) => `${p.description.trim()} (${p.assigneeName.trim()})`),
        files: files.length,
        responsibleId: meta.responsible_id,
        createdBy: created?.created_by ?? undefined,
      });
    }

    if (notified.length) {
      await admin
        .from("kanban_action_update_requests")
        .update({ submitted_at: new Date().toISOString() })
        .eq("id", req.requestId);
      await notifySubmission({
        submissionId,
        repName: req.repName,
        repEmail: rep?.email ?? null,
        items: notified,
      });
    }
    return { saved: notified.length };
  });
