// Server-only: alerta de vencimento (5 dias antes) das ações sugeridas aos representantes,
// com cópia aos gestores master. Idempotente: cada card guarda `metadata.due_alert_for` (prazo
// avisado), então a mesma data nunca é avisada duas vezes, mesmo se o cron rodar mais de uma vez.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { daysUntil, formatPrazo, readActionMeta } from "@/lib/action-tracking";
import { listActionsForRep, sendSystemEmail } from "@/lib/action-tracking.server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const admin = supabaseAdmin as any;

export const DUE_ALERT_DAYS = 5;

/** Gestores master que recebem cópia (Felipe, Angélica, Marcos e Felipe Mormores). */
export const MASTER_COPY_EMAILS = [
  "felipebogarim@gmail.com",
  "angelica.galan@newline.ind.br",
  "marcos@newline.ind.br",
  "filipe@newline.ind.br",
];

const origin = () => process.env.PUBLIC_SITE_URL || "https://poolflux.app";
const splitEmails = (raw: string | null | undefined) =>
  String(raw ?? "")
    .split(/[;,\s]+/)
    .map((e) => e.trim().toLowerCase())
    .filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e));

/** Ação precisa de alerta: já enviada, não recusada/concluída, vence em 0..5 dias, prazo ainda não avisado. */
export function needsDueAlert(
  a: {
    due_date: string | null;
    status: string;
    acceptance: string;
    metadata: Record<string, unknown>;
  },
  now = new Date(),
): boolean {
  if (a.status === "concluido") return false;
  if (a.acceptance === "nao_enviada" || a.acceptance === "recusada") return false;
  const d = daysUntil(a.due_date, now);
  if (d === null || d < 0 || d > DUE_ALERT_DAYS) return false;
  return a.metadata?.due_alert_for !== a.due_date?.slice(0, 10);
}

export type DueAlertResult = { repId: string; actions: number; sent: boolean; reason?: string };

export async function runDueAlerts(now = new Date()): Promise<DueAlertResult[]> {
  const { data: cards } = await admin
    .from("kanban_cards")
    .select("metadata")
    .not("metadata->>rep_id", "is", null)
    .not("due_date", "is", null)
    .is("archived_at", null);
  const repIds = [
    ...new Set<string>(
      (cards ?? [])
        .map((c: { metadata: unknown }) => readActionMeta(c.metadata).rep_id)
        .filter(Boolean) as string[],
    ),
  ];

  const out: DueAlertResult[] = [];
  for (const repId of repIds) {
    try {
      const actions = (await listActionsForRep(repId)).filter((a) => needsDueAlert(a, now));
      if (!actions.length) continue;
      const { data: rep } = await admin
        .from("representatives")
        .select("id, nome, email, user_id")
        .eq("id", repId)
        .maybeSingle();
      const to = splitEmails(rep?.email);
      if (!rep || !to.length) {
        out.push({ repId, actions: actions.length, sent: false, reason: "rep_without_email" });
        continue;
      }

      // Primeiro contato: se ainda não tem login, manda o convite de boas-vindas (senha).
      if (!rep.user_id) {
        try {
          const { provisionRepAccess } = await import("@/lib/rep-portal.server");
          await provisionRepAccess(repId);
        } catch (e) {
          console.warn("due-alert: convite não enviado", repId, e);
        }
      }

      const items = actions.map((a) => {
        const d = daysUntil(a.due_date, now) ?? 0;
        return {
          title: a.title,
          client: readActionMeta(a.metadata).client_name,
          prazo: formatPrazo(a.due_date),
          days: d,
        };
      });
      const stamp = (a: { due_date: string | null }) => (a.due_date ?? "").slice(0, 10);
      const key = `acao-venc-${repId}-${now.toISOString().slice(0, 10)}`;
      const templateData = { repName: rep.nome, items, portalUrl: `${origin()}/portal-rep` };

      let sent = false;
      let reason: string | undefined;
      for (const email of to) {
        const r = await sendSystemEmail({
          templateName: "acao-vencimento",
          to: email,
          idempotencyKey: `${key}-${email}`,
          templateData,
        });
        sent = sent || r.sent;
        if (!r.sent) reason = r.reason;
      }
      if (!sent) {
        out.push({ repId, actions: actions.length, sent: false, reason });
        continue;
      }

      // Cópia aos gestores master (falha numa cópia não desfaz o aviso ao representante).
      for (const email of MASTER_COPY_EMAILS) {
        await sendSystemEmail({
          templateName: "acao-vencimento",
          to: email,
          idempotencyKey: `${key}-cc-${email}`,
          templateData: { ...templateData, copy: true },
        });
      }

      for (const a of actions) {
        await admin
          .from("kanban_cards")
          .update({ metadata: { ...a.metadata, due_alert_for: stamp(a) } })
          .eq("id", a.id);
      }
      out.push({ repId, actions: actions.length, sent: true });
    } catch (e) {
      out.push({
        repId,
        actions: 0,
        sent: false,
        reason: e instanceof Error ? e.message : "error",
      });
    }
  }
  return out;
}
