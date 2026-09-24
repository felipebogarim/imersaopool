import { generateActionToken } from "../action-tokens";
import { getReplyEnv } from "./email-mode.server";
import { generateMessageId } from "./message-id";
import { getEmailProvider } from "./provider-factory.server";
import { buildReplyAddressForTicket } from "./reply-address.server";

// Incremental schema is intentionally accessed only server-side.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const replacements: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };
    return replacements[character];
  });
}

export async function sendRequesterValidationEmail(supabase: Db, ticketId: string): Promise<void> {
  const { data: ticket, error: ticketError } = await supabase
    .from("internal_tickets")
    .select("id, ticket_number")
    .eq("id", ticketId)
    .single();
  if (ticketError) throw new Error(ticketError.message);

  const confirm = generateActionToken();
  const unresolved = generateActionToken();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: requester, error: tokenError } = await supabase.rpc(
    "internal_ticket_issue_requester_validation_tokens",
    {
      p_ticket_id: ticketId,
      p_confirm_token_hash: confirm.tokenHash,
      p_unresolved_token_hash: unresolved.tokenHash,
      p_expires_at: expiresAt,
    },
  );
  if (tokenError) throw new Error(tokenError.message);
  if (!requester?.requester_email) throw new Error("Solicitante sem e-mail para validação");

  const siteUrl = (process.env.PUBLIC_SITE_URL || "https://poolflux.app").replace(/\/+$/, "");
  const confirmUrl = `${siteUrl}/solicitacoes/acao/${confirm.rawToken}`;
  const unresolvedUrl = `${siteUrl}/solicitacoes/acao/${unresolved.rawToken}`;
  const domain = getReplyEnv("INTERNAL_TICKETS_REPLY_DOMAIN");
  const messageId = generateMessageId(domain);
  const subject = `Valide a conclusão da solicitação ${ticket.ticket_number}`;
  const html = `<p>Olá${requester.requester_name ? `, ${escapeHtml(requester.requester_name)}` : ""}.</p>
<p>A solicitação <strong>${ticket.ticket_number}</strong> foi indicada como resolvida.</p>
<p><a href="${confirmUrl}">Confirmar conclusão</a></p>
<p><a href="${unresolvedUrl}">Ainda não foi resolvido</a></p>
<p>Os links são pessoais, expiram em 7 dias e só podem ser usados uma vez.</p>`;
  const text = `A solicitação ${ticket.ticket_number} foi indicada como resolvida.\n\nConfirmar conclusão: ${confirmUrl}\nAinda não foi resolvido: ${unresolvedUrl}\n\nOs links expiram em 7 dias e só podem ser usados uma vez.`;
  const idempotencyKey = `ticket-validation:${ticketId}:${confirm.tokenHash.slice(0, 24)}`;

  const provider = await getEmailProvider();
  const result = await provider.send({
    idempotencyKey,
    to: [requester.requester_email],
    from: `Solicitações Internas Newline <chamados@${domain}>`,
    replyTo: buildReplyAddressForTicket(ticketId),
    subject,
    html,
    text,
    messageId,
    ticketId,
    templateName: "ticket-resolution-validation",
    headers: { "X-Newline-System-Message": "validation" },
  });

  const { error: outboxError } = await supabase.from("internal_ticket_email_outbox").upsert(
    {
      ticket_id: ticketId,
      direction: "outbound",
      idempotency_key: idempotencyKey,
      provider: "resend",
      provider_message_id: result.providerMessageId,
      message_id: messageId,
      template_name: "ticket-resolution-validation",
      recipient_email: requester.requester_email,
      sender_email: `chamados@${domain}`,
      subject,
      status: "sent",
      sent_at: new Date().toISOString(),
    },
    { onConflict: "idempotency_key", ignoreDuplicates: true },
  );
  if (outboxError) throw new Error(outboxError.message);
}
