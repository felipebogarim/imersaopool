import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Input = {
  userId?: string | null;
  email?: string | null;
  automationName: string;
  cardTitle: string;
  boardName?: string | null;
  boardId?: string | null;
  message?: string | null;
};

/** Sends the e-mail side of a Kanban automation "send_notification" action. */
export const sendKanbanAutomationEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: Input) => d)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { sendTransactionalEmail } = await import("@/lib/email/send.server");

    let email = data.email?.trim() || null;
    if (!email && data.userId) {
      const { data: prof } = await supabaseAdmin
        .from("profiles")
        .select("email")
        .eq("id", data.userId)
        .maybeSingle();
      email = prof?.email ?? null;
    }
    if (!email) return { sent: false, reason: "no_email" as const };

    const origin = process.env.PUBLIC_SITE_URL || "https://poolflux.app";
    await sendTransactionalEmail({
      templateName: "kanban-automacao",
      recipientEmail: email,
      idempotencyKey: crypto.randomUUID(),
      templateData: {
        automationName: data.automationName,
        cardTitle: data.cardTitle,
        boardName: data.boardName ?? undefined,
        message: data.message ?? undefined,
        link: data.boardId ? `${origin}/tarefas/b/${data.boardId}` : origin,
      },
    });
    return { sent: true as const };
  });

type AssignInput = {
  userId: string;
  kind: "responsavel" | "membro";
  cardId: string;
  cardTitle: string;
  boardId: string;
  boardName?: string | null;
  actorName?: string | null;
};

/** Automação nativa: avisa por e-mail quem foi definido responsável ou adicionado como membro. */
export const sendKanbanAssignmentEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: AssignInput) => d)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { sendTransactionalEmail } = await import("@/lib/email/send.server");

    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("email")
      .eq("id", data.userId)
      .maybeSingle();
    const email = prof?.email ?? null;
    if (!email) return { sent: false, reason: "no_email" as const };

    const origin = process.env.PUBLIC_SITE_URL || "https://poolflux.app";
    await sendTransactionalEmail({
      templateName: "kanban-atribuicao",
      recipientEmail: email,
      idempotencyKey: `kanban-${data.kind}-${data.cardId}-${data.userId}`,
      templateData: {
        kind: data.kind,
        cardTitle: data.cardTitle,
        boardName: data.boardName ?? undefined,
        actorName: data.actorName ?? undefined,
        link: `${origin}/tarefas/b/${data.boardId}?card=${data.cardId}`,
      },
    });
    return { sent: true as const };
  });
