// Server-only: formulário público por token, cobrança semanal e avisos por e-mail da
// "Evolução das Ações". Tabelas novas ainda não estão no types.ts gerado → cast para any.
import * as React from "react";
import { render } from "@react-email/render";
import { createHash, randomBytes } from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { TEMPLATES } from "@/lib/email-templates/registry";
import {
  ACTION_REQUEST_MIN_INTERVAL_DAYS,
  ACTION_REQUEST_TTL_DAYS,
  ACTION_STATUS_LABEL,
  formatPrazo,
  readActionMeta,
  statusOrDefault,
  type ActionStatus,
} from "@/lib/action-tracking";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const admin = supabaseAdmin as any;

const SITE_NAME = "Imersão Comercial";
const SENDER_DOMAIN = "notify.poolflux.app";
const origin = () => process.env.PUBLIC_SITE_URL || "https://poolflux.app";

export const hashToken = (raw: string) => createHash("sha256").update(raw).digest("hex");

/**
 * Enfileira um e-mail transacional sem depender do JWT de um usuário (cron e formulário
 * público não têm sessão). Mesmo pipeline da rota /lovable/email/transactional/send:
 * supressão → token de unsubscribe → render → enqueue_email. O provedor não suporta CC,
 * então "com cópia" é enviado como e-mail separado ao representante.
 */
export async function sendSystemEmail(args: {
  templateName: string;
  to: string;
  idempotencyKey: string;
  templateData: Record<string, unknown>;
}): Promise<{ sent: boolean; reason?: string }> {
  const template = TEMPLATES[args.templateName];
  if (!template) return { sent: false, reason: "template_not_found" };
  const email = args.to.trim().toLowerCase();
  if (!email) return { sent: false, reason: "no_email" };

  const { data: suppressed, error: supErr } = await admin
    .from("suppressed_emails")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  if (supErr) return { sent: false, reason: "suppression_check_failed" };
  if (suppressed) return { sent: false, reason: "email_suppressed" };

  const { data: existing } = await admin
    .from("email_unsubscribe_tokens")
    .select("token, used_at")
    .eq("email", email)
    .maybeSingle();
  if (existing?.used_at) return { sent: false, reason: "email_suppressed" };
  let unsubscribeToken: string = existing?.token;
  if (!unsubscribeToken) {
    await admin
      .from("email_unsubscribe_tokens")
      .upsert(
        { token: randomBytes(32).toString("hex"), email },
        { onConflict: "email", ignoreDuplicates: true },
      );
    const { data: stored } = await admin
      .from("email_unsubscribe_tokens")
      .select("token")
      .eq("email", email)
      .maybeSingle();
    if (!stored?.token) return { sent: false, reason: "unsubscribe_token_failed" };
    unsubscribeToken = stored.token;
  }

  const element = React.createElement(template.component, args.templateData);
  const html = await render(element);
  const text = await render(element, { plainText: true });
  const subject =
    typeof template.subject === "function" ? template.subject(args.templateData) : template.subject;
  const messageId = crypto.randomUUID();

  await admin.from("email_send_log").insert({
    message_id: messageId,
    template_name: args.templateName,
    recipient_email: email,
    status: "pending",
  });
  const { error } = await admin.rpc("enqueue_email", {
    queue_name: "transactional_emails",
    payload: {
      message_id: messageId,
      to: email,
      from: `${SITE_NAME} <noreply@${SENDER_DOMAIN}>`,
      sender_domain: SENDER_DOMAIN,
      subject,
      html,
      text,
      purpose: "transactional",
      label: args.templateName,
      idempotency_key: args.idempotencyKey,
      unsubscribe_token: unsubscribeToken,
      queued_at: new Date().toISOString(),
    },
  });
  if (error) {
    await admin.from("email_send_log").insert({
      message_id: messageId,
      template_name: args.templateName,
      recipient_email: email,
      status: "failed",
      error_message: "Failed to enqueue email",
    });
    return { sent: false, reason: "enqueue_failed" };
  }
  return { sent: true };
}

export type OpenAction = {
  id: string;
  title: string;
  due_date: string | null;
  board_id: string;
  status: ActionStatus;
  metadata: Record<string, unknown>;
};

/** Ações não arquivadas vinculadas ao representante (rep_id no metadata do card). */
export async function listActionsForRep(repId: string, opts?: { includeDone?: boolean }) {
  const { data: cards, error } = await admin
    .from("kanban_cards")
    .select("id, title, due_date, board_id, metadata")
    .filter("metadata->>rep_id", "eq", repId)
    .is("archived_at", null)
    .order("due_date", { ascending: true, nullsFirst: false });
  if (error) throw new Error(error.message);
  const ids = (cards ?? []).map((c: { id: string }) => c.id);
  const status = new Map<string, ActionStatus>();
  if (ids.length) {
    const { data: rows } = await admin
      .from("kanban_action_tracking")
      .select("card_id, status")
      .in("card_id", ids);
    for (const r of rows ?? []) status.set(r.card_id, statusOrDefault(r.status));
  }
  const all: OpenAction[] = (cards ?? []).map((c: Omit<OpenAction, "status">) => ({
    ...c,
    status: status.get(c.id) ?? "nao_iniciado",
  }));
  return opts?.includeDone ? all : all.filter((a) => a.status !== "concluido");
}

export type RequestResult = { repId: string; sent: boolean; reason?: string };

/** Cria um token novo e envia o link do formulário ao representante. */
export async function sendRequestToRep(
  repId: string,
  opts?: { sentBy?: string | null; force?: boolean },
): Promise<RequestResult> {
  const { data: rep } = await admin
    .from("representatives")
    .select("id, nome, email")
    .eq("id", repId)
    .maybeSingle();
  if (!rep?.email) return { repId, sent: false, reason: "rep_without_email" };

  const actions = await listActionsForRep(repId);
  if (!actions.length) return { repId, sent: false, reason: "no_open_actions" };

  if (!opts?.force) {
    const since = new Date(
      Date.now() - ACTION_REQUEST_MIN_INTERVAL_DAYS * 86_400_000,
    ).toISOString();
    const { data: recent } = await admin
      .from("kanban_action_update_requests")
      .select("id")
      .eq("representative_id", repId)
      .gte("created_at", since)
      .limit(1)
      .maybeSingle();
    if (recent) return { repId, sent: false, reason: "recently_requested" };
  }

  const raw = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + ACTION_REQUEST_TTL_DAYS * 86_400_000);
  const { data: reqRow, error } = await admin
    .from("kanban_action_update_requests")
    .insert({
      token_hash: hashToken(raw),
      representative_id: repId,
      representative_email: rep.email,
      expires_at: expires.toISOString(),
      sent_by: opts?.sentBy ?? null,
    })
    .select("id")
    .single();
  if (error) return { repId, sent: false, reason: "token_insert_failed" };

  const res = await sendSystemEmail({
    templateName: "acao-solicitacao-atualizacao",
    to: rep.email,
    idempotencyKey: `acao-req-${reqRow.id}`,
    templateData: {
      repName: rep.nome,
      actions: actions.map((a) => ({
        title: a.title,
        client: readActionMeta(a.metadata).client_name,
        prazo: a.due_date ? formatPrazo(a.due_date) : undefined,
      })),
      link: `${origin()}/atualizacao-acoes/${raw}`,
      expiresLabel: expires.toLocaleDateString("pt-BR"),
    },
  });
  if (!res.sent) {
    await admin.from("kanban_action_update_requests").delete().eq("id", reqRow.id);
    return { repId, sent: false, reason: res.reason };
  }
  return { repId, sent: true };
}

/** Cobrança semanal: todos os representantes com ações em aberto (ou só `repIds`). */
export async function runActionRequests(opts?: {
  repIds?: string[];
  sentBy?: string | null;
  force?: boolean;
}): Promise<RequestResult[]> {
  let repIds = opts?.repIds;
  if (!repIds?.length) {
    const { data: cards } = await admin
      .from("kanban_cards")
      .select("metadata")
      .not("metadata->>rep_id", "is", null)
      .is("archived_at", null);
    repIds = [
      ...new Set<string>(
        (cards ?? [])
          .map((c: { metadata: unknown }) => readActionMeta(c.metadata).rep_id)
          .filter(Boolean) as string[],
      ),
    ];
  }
  const out: RequestResult[] = [];
  for (const id of repIds) {
    try {
      out.push(await sendRequestToRep(id, opts));
    } catch (e) {
      out.push({ repId: id, sent: false, reason: e instanceof Error ? e.message : "error" });
    }
  }
  return out;
}

export type RequestLookup =
  | { valid: true; requestId: string; repId: string; repName: string; expiresAt: string }
  | { valid: false; reason: "not_found" | "expired" };

export async function lookupRequest(rawToken: string): Promise<RequestLookup> {
  if (!/^[0-9a-f]{64}$/.test(rawToken)) return { valid: false, reason: "not_found" };
  const { data } = await admin
    .from("kanban_action_update_requests")
    .select("id, representative_id, expires_at, representatives(nome)")
    .eq("token_hash", hashToken(rawToken))
    .maybeSingle();
  if (!data) return { valid: false, reason: "not_found" };
  if (new Date(data.expires_at).getTime() < Date.now()) return { valid: false, reason: "expired" };
  return {
    valid: true,
    requestId: data.id,
    repId: data.representative_id,
    repName: data.representatives?.nome ?? "Representante",
    expiresAt: data.expires_at,
  };
}

/** Membros/responsável de uma ação, para o seletor de pendências. */
export async function listCardPeople(cardIds: string[]) {
  const out = new Map<string, { id: string; name: string }[]>();
  if (!cardIds.length) return out;
  const { data: members } = await admin
    .from("kanban_card_members")
    .select("card_id, user_id")
    .in("card_id", cardIds);
  const { data: cards } = await admin.from("kanban_cards").select("id, metadata").in("id", cardIds);
  const userIds = new Set<string>((members ?? []).map((m: { user_id: string }) => m.user_id));
  for (const c of cards ?? []) {
    const rid = readActionMeta(c.metadata).responsible_id;
    if (rid) userIds.add(rid);
  }
  const names = new Map<string, string>();
  if (userIds.size) {
    const { data: profs } = await admin
      .from("profiles")
      .select("id, full_name, email")
      .in("id", [...userIds]);
    for (const p of profs ?? []) names.set(p.id, p.full_name || p.email || "Membro");
  }
  for (const id of cardIds) {
    const ids = new Set<string>();
    for (const m of members ?? []) if (m.card_id === id) ids.add(m.user_id);
    const card = (cards ?? []).find((c: { id: string }) => c.id === id);
    const rid = card ? readActionMeta(card.metadata).responsible_id : undefined;
    if (rid) ids.add(rid);
    out.set(
      id,
      [...ids].map((u) => ({ id: u, name: names.get(u) ?? "Membro" })),
    );
  }
  return out;
}

export type SubmittedItem = {
  cardId: string;
  title: string;
  client?: string;
  statusLabel: string;
  note?: string;
  pendencias: string[];
  files: number;
  responsibleId?: string;
  createdBy?: string;
};

/** Avisa o(s) responsável(is) e envia uma cópia ao representante. */
export async function notifySubmission(args: {
  submissionId: string;
  repName: string;
  repEmail: string | null;
  items: SubmittedItem[];
}) {
  const link = `${origin()}/ferramentas/evolucao-acoes`;
  const byUser = new Map<string, SubmittedItem[]>();
  for (const it of args.items) {
    const uid = it.responsibleId ?? it.createdBy;
    if (!uid) continue;
    byUser.set(uid, [...(byUser.get(uid) ?? []), it]);
  }
  const strip = ({ responsibleId: _r, createdBy: _c, cardId: _i, ...rest }: SubmittedItem) => rest;
  for (const [uid, items] of byUser) {
    const { data: prof } = await admin
      .from("profiles")
      .select("email, full_name")
      .eq("id", uid)
      .maybeSingle();
    if (!prof?.email) continue;
    await sendSystemEmail({
      templateName: "acao-atualizacao-recebida",
      to: prof.email,
      idempotencyKey: `acao-upd-${args.submissionId}-${uid}`,
      templateData: {
        recipientName: prof.full_name,
        repName: args.repName,
        items: items.map(strip),
        link,
      },
    });
  }
  if (args.repEmail) {
    await sendSystemEmail({
      templateName: "acao-atualizacao-recebida",
      to: args.repEmail,
      idempotencyKey: `acao-upd-${args.submissionId}-rep`,
      templateData: { repName: args.repName, isCopy: true, items: args.items.map(strip) },
    });
  }
}

export { ACTION_STATUS_LABEL };
