// Server-only helper to execute a full security audit and persist results.
// Reused by the interactive server function and the weekly cron route.

type CheckStatus = "ok" | "atencao" | "critico" | "nao_verificado" | "nao_implementado";
type Sev = "critico" | "alto" | "medio" | "baixo" | "info";

export type CheckResult = {
  chave: string;
  categoria: string;
  titulo: string;
  descricao?: string;
  status: CheckStatus;
  severidade: Sev;
  evidencia?: Record<string, unknown>;
  recomendacao?: string;
  peso?: number;
};

export function calcScore(checks: CheckResult[]) {
  let total = 0;
  let ganho = 0;
  const contagem = { ok: 0, atencao: 0, critico: 0, nao_verificado: 0, nao_implementado: 0 };
  for (const c of checks) {
    const peso = c.peso ?? 1;
    contagem[c.status]++;
    if (c.status === "ok") { total += peso; ganho += peso; }
    else if (c.status === "atencao") { total += peso; ganho += peso * 0.5; }
    else if (c.status === "critico") { total += peso; ganho += 0; }
    else if (c.status === "nao_implementado") { total += peso; ganho += 0; }
  }
  const score = total === 0 ? 0 : Math.round((ganho / total) * 100);
  return { score, contagem };
}

export async function executeAudit(iniciadoPor: string | null, origem: "manual" | "auto" = "manual") {
  const started = Date.now();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { runChecks } = await import("@/lib/security-audit-checks.server");

  const { data: audit, error: e1 } = await supabaseAdmin
    .from("security_audits")
    .insert({ iniciado_por: iniciadoPor, status: "executando", escopo: origem === "auto" ? "weekly" : "full" })
    .select("id")
    .single();
  if (e1 || !audit) throw new Error(e1?.message ?? "Falha ao iniciar auditoria");

  let checks: CheckResult[] = [];
  let erroMsg: string | undefined;
  try {
    checks = await runChecks(supabaseAdmin);
  } catch (err: any) {
    erroMsg = err?.message ?? String(err);
  }

  const { score, contagem } = calcScore(checks);
  const duracao = Date.now() - started;

  if (checks.length) {
    await supabaseAdmin.from("security_audit_checks").insert(
      checks.map((c) => ({
        audit_id: audit.id,
        chave: c.chave,
        categoria: c.categoria,
        titulo: c.titulo,
        descricao: c.descricao ?? null,
        status: c.status,
        severidade: c.severidade,
        evidencia: (c.evidencia ?? {}) as any,
        recomendacao: c.recomendacao ?? null,
        peso: c.peso ?? 1,
      })),
    );
  }

  await supabaseAdmin
    .from("security_audits")
    .update({
      concluido_em: new Date().toISOString(),
      status: erroMsg ? "erro" : "concluida",
      indice_seguranca: score,
      total_checks: checks.length,
      checks_ok: contagem.ok,
      checks_atencao: contagem.atencao,
      checks_critico: contagem.critico,
      checks_nao_verificado: contagem.nao_verificado + contagem.nao_implementado,
      duracao_ms: duracao,
      resultado: { contagem, origem },
      erro: erroMsg ?? null,
    })
    .eq("id", audit.id);

  await supabaseAdmin.from("security_events").insert({
    tipo: "security.audit.executed",
    categoria: "auditoria",
    usuario_id: iniciadoPor,
    recurso: `security_audit:${audit.id}`,
    acao: origem === "auto" ? "run_weekly" : "run",
    resultado: erroMsg ? "falha" : "sucesso",
    nivel_risco: "info",
    metadata: { score, contagem, duracao_ms: duracao, origem },
  });

  return { audit_id: audit.id as string, score, contagem, duracao_ms: duracao, checks, erro: erroMsg };
}
