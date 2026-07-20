import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

const SENDER_DOMAIN = "notify.poolflux.app";
const FROM_ADDRESS = `Segurança PoolFlux <seguranca@${SENDER_DOMAIN}>`;
const RECIPIENT = "felipe@poolbranding.com.br";

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}

function buildEmail(res: { audit_id: string; score: number; contagem: Record<string, number>; duracao_ms: number; erro?: string }) {
  const dataStr = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const scoreColor = res.score >= 80 ? "#059669" : res.score >= 60 ? "#d97706" : "#dc2626";
  const linkAuditoria = "https://poolflux.app/admin/auditoria-seguranca";

  const subject = `Auditoria Semanal de Segurança — Índice ${res.score}/100`;
  const html = `<!doctype html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f4f4f5;padding:24px;margin:0;color:#111827">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.06)">
    <div style="background:#0f172a;color:#fff;padding:20px 24px">
      <h1 style="margin:0;font-size:18px">Auditoria Semanal de Segurança</h1>
      <p style="margin:4px 0 0;font-size:13px;opacity:.8">${esc(dataStr)} (BRT)</p>
    </div>
    <div style="padding:24px">
      <div style="text-align:center;margin-bottom:24px">
        <div style="font-size:14px;color:#6b7280;margin-bottom:4px">Índice de Segurança</div>
        <div style="font-size:48px;font-weight:800;color:${scoreColor}">${res.score}<span style="font-size:20px;color:#9ca3af">/100</span></div>
      </div>
      <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
        <tr><td style="padding:8px 12px;background:#f9fafb;border-radius:6px 0 0 6px">✅ OK</td><td style="padding:8px 12px;text-align:right;background:#f9fafb;font-weight:600;border-radius:0 6px 6px 0">${res.contagem.ok ?? 0}</td></tr>
        <tr><td colspan="2" style="height:4px"></td></tr>
        <tr><td style="padding:8px 12px;background:#fef3c7;border-radius:6px 0 0 6px">⚠️ Atenção</td><td style="padding:8px 12px;text-align:right;background:#fef3c7;font-weight:600;border-radius:0 6px 6px 0">${res.contagem.atencao ?? 0}</td></tr>
        <tr><td colspan="2" style="height:4px"></td></tr>
        <tr><td style="padding:8px 12px;background:#fee2e2;border-radius:6px 0 0 6px">🔴 Crítico</td><td style="padding:8px 12px;text-align:right;background:#fee2e2;font-weight:600;border-radius:0 6px 6px 0">${res.contagem.critico ?? 0}</td></tr>
        <tr><td colspan="2" style="height:4px"></td></tr>
        <tr><td style="padding:8px 12px;background:#f3f4f6;border-radius:6px 0 0 6px">❓ Não verificado</td><td style="padding:8px 12px;text-align:right;background:#f3f4f6;font-weight:600;border-radius:0 6px 6px 0">${(res.contagem.nao_verificado ?? 0) + (res.contagem.nao_implementado ?? 0)}</td></tr>
      </table>
      ${res.erro ? `<p style="color:#dc2626;background:#fee2e2;padding:12px;border-radius:6px;font-size:13px"><strong>Aviso:</strong> ${esc(res.erro)}</p>` : ""}
      <div style="text-align:center;margin-top:24px">
        <a href="${linkAuditoria}" style="display:inline-block;background:#0f172a;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600">Abrir painel de auditoria</a>
      </div>
      <p style="color:#9ca3af;font-size:12px;margin-top:24px;text-align:center">Duração da varredura: ${(res.duracao_ms / 1000).toFixed(1)}s • ID: ${esc(res.audit_id)}</p>
    </div>
  </div>
</body></html>`;
  const text = `Auditoria Semanal de Segurança (${dataStr} BRT)
Índice: ${res.score}/100
OK: ${res.contagem.ok ?? 0} | Atenção: ${res.contagem.atencao ?? 0} | Crítico: ${res.contagem.critico ?? 0} | Não verificado: ${(res.contagem.nao_verificado ?? 0) + (res.contagem.nao_implementado ?? 0)}
Painel: ${linkAuditoria}
ID: ${res.audit_id}`;
  return { subject, html, text };
}

export const Route = createFileRoute("/api/public/hooks/weekly-security-audit")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const supabaseUrl = process.env.SUPABASE_URL;
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!supabaseUrl || !serviceKey) {
          return Response.json({ error: "server_misconfigured" }, { status: 500 });
        }
        // Authorize the caller (pg_cron sends the anon apikey header).
        const apikey = request.headers.get("apikey");
        const anonKey = process.env.SUPABASE_PUBLISHABLE_KEY;
        if (!apikey || !anonKey || apikey !== anonKey) {
          return Response.json({ error: "unauthorized" }, { status: 401 });
        }

        const { executeAudit } = await import("@/lib/security-audit-run.server");
        const res = await executeAudit(null, "auto");

        const { subject, html, text } = buildEmail(res);
        const messageId = `sec-audit-${res.audit_id}`;
        const supabase = createClient(supabaseUrl, serviceKey);
        const { error: enqErr } = await supabase.rpc("enqueue_email", {
          queue_name: "transactional_emails",
          payload: {
            run_id: res.audit_id,
            to: RECIPIENT,
            from: FROM_ADDRESS,
            sender_domain: SENDER_DOMAIN,
            subject,
            html,
            text,
            purpose: "transactional",
            label: "weekly-security-audit",
            message_id: messageId,
            idempotency_key: messageId,
            queued_at: new Date().toISOString(),
          } as any,
        });
        if (enqErr) {
          return Response.json({ ok: false, audit_id: res.audit_id, enqueue_error: enqErr.message }, { status: 500 });
        }
        return Response.json({ ok: true, audit_id: res.audit_id, score: res.score, contagem: res.contagem });
      },
    },
  },
});
