import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getAgendaUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: me, error: meError } = await context.supabase
      .from("profiles")
      .select("active_company_id")
      .eq("id", context.userId)
      .maybeSingle();
    if (meError) throw meError;
    if (!me?.active_company_id) return [];

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, email")
      .eq("active_company_id", me.active_company_id)
      .eq("status", "ativo")
      .order("full_name");
    if (error) throw error;
    return data ?? [];
  });

const invitationInput = z.object({
  eventId: z.string().uuid(),
  inviteeIds: z.array(z.string().uuid()).max(100),
});

export const sendAgendaInvitations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => invitationInput.parse(data))
  .handler(async ({ data, context }) => {
    if (data.inviteeIds.length === 0) return { sent: 0 };

    const { data: event, error: eventError } = await context.supabase
      .from("agenda_events")
      .select("id, title, starts_at, duration_minutes, details, owner_id, company_id")
      .eq("id", data.eventId)
      .eq("owner_id", context.userId)
      .maybeSingle();
    if (eventError) throw eventError;
    if (!event) throw new Error("Compromisso não encontrado");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: organizer }, { data: invitees, error: inviteesError }] = await Promise.all([
      supabaseAdmin.from("profiles").select("full_name, email").eq("id", context.userId).maybeSingle(),
      supabaseAdmin
        .from("profiles")
        .select("id, full_name, email, active_company_id, status")
        .in("id", data.inviteeIds),
    ]);
    if (inviteesError) throw inviteesError;

    const validInvitees = (invitees ?? []).filter(
      (invitee) => invitee.active_company_id === event.company_id && invitee.status === "ativo" && invitee.email,
    );
    if (validInvitees.length === 0) return { sent: 0 };

    const { sendTransactionalEmail } = await import("@/lib/email/send.server");
    const startsAt = new Date(event.starts_at);
    const dateLabel = new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "long",
      timeStyle: "short",
      timeZone: "America/Sao_Paulo",
    }).format(startsAt);
    const durationLabel = event.duration_minutes < 60
      ? `${event.duration_minutes} minutos`
      : event.duration_minutes % 60 === 0
        ? `${event.duration_minutes / 60} hora${event.duration_minutes > 60 ? "s" : ""}`
        : `${Math.floor(event.duration_minutes / 60)}h ${event.duration_minutes % 60}min`;
    const origin = process.env.PUBLIC_SITE_URL || "https://poolflux.app";

    await Promise.all(
      validInvitees.map((invitee) =>
        sendTransactionalEmail({
          templateName: "agenda-convite",
          recipientEmail: invitee.email as string,
          idempotencyKey: `agenda-convite-${event.id}-${invitee.id}`,
          templateData: {
            title: event.title,
            dateLabel,
            durationLabel,
            details: event.details ?? undefined,
            organizerName: organizer?.full_name ?? organizer?.email ?? "Um usuário",
            link: `${origin}/ferramentas/agenda`,
          },
        }),
      ),
    );

    return { sent: validInvitees.length };
  });