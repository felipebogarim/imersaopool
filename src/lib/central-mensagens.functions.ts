import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Input = { templateId: string; contactIds: string[] };

/** Envia um template da Central de Mensagens por e-mail para os contatos selecionados. */
export const sendCentralMensagensEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: Input) => d)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { sendTransactionalEmail } = await import("@/lib/email/send.server");

    if (!data.templateId || !data.contactIds?.length) {
      return { sent: 0, failed: 0, reason: "no_recipients" as const };
    }

    const { data: tpl, error: tplErr } = await supabaseAdmin
      .from("app_update_templates")
      .select("id, name, subject, intro, blocks, farewell")
      .eq("id", data.templateId)
      .maybeSingle();
    if (tplErr || !tpl) throw new Error("Template não encontrado");

    const { data: contacts, error: cErr } = await supabaseAdmin
      .from("app_email_contacts")
      .select("id, name, email")
      .in("id", data.contactIds);
    if (cErr) throw new Error(cErr.message);

    let sent = 0;
    let failed = 0;
    for (const c of contacts ?? []) {
      if (!c.email) {
        failed++;
        continue;
      }
      try {
        await sendTransactionalEmail({
          templateName: "central-mensagens",
          recipientEmail: c.email,
          idempotencyKey: `cm-${tpl.id}-${c.id}-${Date.now()}`,
          templateData: {
            title: tpl.name,
            subject: tpl.subject || tpl.name,
            intro: tpl.intro ?? "",
            blocks: Array.isArray(tpl.blocks) ? (tpl.blocks as unknown[]) : [],
            farewell: tpl.farewell ?? "",
            recipientName: c.name ?? "",
          },
        });
        sent++;
      } catch (err) {
        console.error("[central-mensagens] falha ao enviar", c.email, err);
        failed++;
      }
    }
    return { sent, failed };
  });
