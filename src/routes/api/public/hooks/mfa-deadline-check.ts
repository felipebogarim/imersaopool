import { createFileRoute } from "@tanstack/react-router";

/**
 * Daily cron: for each admin without a verified MFA factor, if enforcement
 * is active and the deadline is within 3 days, enqueue the warning e-mail.
 * Idempotency key includes the calendar day so we never send twice a day.
 */
export const Route = createFileRoute("/api/public/hooks/mfa-deadline-check")({
  server: {
    handlers: {
      POST: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: policy } = await supabaseAdmin
          .from("admin_mfa_policy")
          .select("enforcement_started_at, grace_period_days")
          .eq("id", true)
          .maybeSingle();

        if (!policy?.enforcement_started_at) {
          return Response.json({ skipped: "enforcement_not_active" });
        }

        const started = new Date(policy.enforcement_started_at).getTime();
        const grace = (policy.grace_period_days ?? 7) * 86_400_000;
        const deadline = started + grace;
        const now = Date.now();
        const msLeft = deadline - now;
        const daysLeft = Math.ceil(msLeft / 86_400_000);

        if (msLeft <= 0 || daysLeft > 3) {
          return Response.json({ skipped: "not_in_warning_window", daysLeft });
        }

        // Get admins
        const { data: adminRows } = await supabaseAdmin
          .from("user_roles")
          .select("user_id")
          .eq("role", "admin");

        const today = new Date().toISOString().slice(0, 10);
        const deadlineLabel = new Date(deadline).toLocaleString("pt-BR");
        let sent = 0;

        for (const row of adminRows ?? []) {
          try {
            const { data: factors } = await supabaseAdmin.auth.admin.mfa.listFactors({
              userId: row.user_id,
            });
            const hasVerified = (factors?.factors ?? []).some(
              (f: any) => f.status === "verified",
            );
            if (hasVerified) continue;

            const { data: userRes } = await supabaseAdmin.auth.admin.getUserById(row.user_id);
            const email = userRes?.user?.email;
            if (!email) continue;

            // Directly enqueue by hitting the internal render+enqueue route
            // with the service key is not supported — the send route requires
            // a user JWT. Instead, we call the render pipeline here via a
            // minimal admin-only endpoint: enqueue a pre-rendered auth_emails
            // payload is complex, so we settle for calling the send route with
            // a short-lived signed magic link would leak. Simpler: log to a
            // pending table and let the target admin trigger on next login.
            //
            // Practical approach: write a notification row that the sign-in
            // hook can pick up. We keep the send route unchanged.
            const idem = `mfa-warn-${row.user_id}-${today}`;
            const since = new Date(); since.setUTCHours(0, 0, 0, 0);
            const { data: existing } = await supabaseAdmin
              .from("email_send_log")
              .select("id")
              .eq("template_name", "mfa-deadline-warning")
              .eq("recipient_email", email)
              .gte("created_at", since.toISOString())
              .limit(1)
              .maybeSingle();
            if (existing) continue;

            await supabaseAdmin.rpc("enqueue_email" as any, {
              queue_name: "transactional_emails",
              payload: {
                templateName: "mfa-deadline-warning",
                recipientEmail: email,
                idempotencyKey: idem,
                templateData: {
                  name: (userRes?.user?.user_metadata as any)?.full_name ?? email,
                  daysLeft,
                  deadline: deadlineLabel,
                },
              },
            });
            sent++;
          } catch (err) {
            console.error("[mfa-deadline-check] admin failed", row.user_id, err);
          }
        }

        return Response.json({ ok: true, daysLeft, sent });
      },
    },
  },
});
