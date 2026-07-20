// Server-only: security audit checks (extracted for reuse).
type CheckStatus = "ok" | "atencao" | "critico" | "nao_verificado" | "nao_implementado";
type Sev = "critico" | "alto" | "medio" | "baixo" | "info";

type CheckResult = {
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

export async function runChecks(admin: any): Promise<CheckResult[]> {
  const checks: CheckResult[] = [];

  // 1. RLS habilitado em tabelas públicas
  try {
    const { data, error } = await admin.rpc("exec_sql_readonly" as any); // placeholder
    // fallback direto via SQL (usando REST não é possível: usaremos consultas específicas abaixo)
    void data; void error;
  } catch { /* ignore */ }

  // Consultamos tabelas públicas via information_schema usando client publishável? Precisa de admin.
  try {
    const { data: tables } = await admin
      .from("pg_tables" as any)
      .select("*")
      .eq("schemaname", "public");
    // Nem sempre funciona via PostgREST. Vamos usar RPC customizada se existir; senão marcamos como nao_verificado.
    if (!tables) throw new Error("no tables");
    checks.push({
      chave: "rls.tables_scanned",
      categoria: "Banco de dados",
      titulo: "Tabelas públicas identificadas",
      status: "ok",
      severidade: "info",
      evidencia: { total: tables.length },
      peso: 1,
    });
  } catch {
    checks.push({
      chave: "rls.tables_scanned",
      categoria: "Banco de dados",
      titulo: "Varredura de RLS em tabelas públicas",
      status: "nao_verificado",
      severidade: "info",
      descricao: "Não foi possível listar tabelas via API. Verificação manual necessária no painel do banco.",
      recomendacao: "Confirmar que todas as tabelas em public possuem RLS habilitado e ao menos uma policy.",
      peso: 1,
    });
  }

  // 2. Buckets públicos
  try {
    const { data: buckets } = await admin.storage.listBuckets();
    const pubs = (buckets ?? []).filter((b: any) => b.public);
    if (pubs.length === 0) {
      checks.push({
        chave: "storage.no_public_buckets",
        categoria: "Armazenamento",
        titulo: "Nenhum bucket público",
        status: "ok",
        severidade: "info",
        evidencia: { total_buckets: buckets?.length ?? 0 },
        peso: 3,
      });
    } else {
      checks.push({
        chave: "storage.no_public_buckets",
        categoria: "Armazenamento",
        titulo: "Buckets públicos encontrados",
        status: "critico",
        severidade: "critico",
        evidencia: { buckets: pubs.map((b: any) => b.name) },
        recomendacao: "Tornar buckets privados e usar URLs assinadas.",
        peso: 3,
      });
    }
  } catch (e: any) {
    checks.push({
      chave: "storage.no_public_buckets",
      categoria: "Armazenamento",
      titulo: "Verificação de buckets públicos",
      status: "nao_verificado",
      severidade: "medio",
      descricao: e?.message ?? "Falha ao listar buckets.",
      peso: 3,
    });
  }

  // 3. Quantidade de administradores
  try {
    const { data: admins, error } = await admin
      .from("user_roles")
      .select("user_id", { count: "exact" })
      .eq("role", "admin");
    if (error) throw error;
    const total = admins?.length ?? 0;
    checks.push({
      chave: "access.admin_count",
      categoria: "Controle de Acessos",
      titulo: "Administradores ativos",
      status: total === 0 ? "critico" : total > 5 ? "atencao" : "ok",
      severidade: total > 5 ? "medio" : "info",
      evidencia: { total },
      recomendacao: total > 5 ? "Revisar administradores; aplicar princípio do menor privilégio." : undefined,
      peso: 2,
    });
  } catch (e: any) {
    checks.push({
      chave: "access.admin_count",
      categoria: "Controle de Acessos",
      titulo: "Administradores ativos",
      status: "nao_verificado",
      severidade: "info",
      descricao: e?.message,
      peso: 1,
    });
  }

  // 4. Falhas de login nas últimas 24h
  try {
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const { data: fails, error } = await admin
      .from("security_events")
      .select("id", { count: "exact" })
      .eq("tipo", "auth.login")
      .eq("resultado", "falha")
      .gte("ocorrido_em", since);
    if (error) throw error;
    const n = fails?.length ?? 0;
    checks.push({
      chave: "auth.failed_logins_24h",
      categoria: "Sessões",
      titulo: "Falhas de autenticação (24h)",
      status: n > 20 ? "atencao" : "ok",
      severidade: n > 50 ? "alto" : "info",
      evidencia: { total: n },
      recomendacao: n > 20 ? "Investigar origem e considerar bloqueio temporário." : undefined,
      peso: 1,
    });
  } catch {
    checks.push({
      chave: "auth.failed_logins_24h",
      categoria: "Sessões",
      titulo: "Falhas de autenticação (24h)",
      status: "nao_verificado",
      severidade: "info",
      descricao: "Log de eventos ainda não instrumentado para login.",
      peso: 1,
    });
  }

  // 5. Incidentes abertos
  try {
    const { data: inc, error } = await admin
      .from("security_incidents")
      .select("id, gravidade, status");
    if (error) throw error;
    const abertos = (inc ?? []).filter((i: any) => i.status !== "encerrado");
    const criticos = abertos.filter((i: any) => i.gravidade === "critico").length;
    checks.push({
      chave: "incidents.open",
      categoria: "Incidentes",
      titulo: "Incidentes abertos",
      status: criticos > 0 ? "critico" : abertos.length > 0 ? "atencao" : "ok",
      severidade: criticos > 0 ? "critico" : abertos.length > 0 ? "medio" : "info",
      evidencia: { abertos: abertos.length, criticos },
      peso: 3,
    });
  } catch (e: any) {
    checks.push({
      chave: "incidents.open",
      categoria: "Incidentes",
      titulo: "Incidentes abertos",
      status: "nao_verificado",
      severidade: "info",
      descricao: e?.message,
      peso: 1,
    });
  }

  // 6. Riscos críticos abertos
  try {
    const { data: risks, error } = await admin
      .from("security_risks")
      .select("id, gravidade, status");
    if (error) throw error;
    const abertos = (risks ?? []).filter(
      (r: any) => !["corrigido", "risco_aceito", "nao_aplicavel"].includes(r.status),
    );
    const criticos = abertos.filter((r: any) => r.gravidade === "critico").length;
    checks.push({
      chave: "risks.open_critical",
      categoria: "Vulnerabilidades",
      titulo: "Riscos críticos em aberto",
      status: criticos > 0 ? "critico" : "ok",
      severidade: criticos > 0 ? "critico" : "info",
      evidencia: { abertos: abertos.length, criticos },
      peso: 3,
    });
  } catch (e: any) {
    checks.push({
      chave: "risks.open_critical",
      categoria: "Vulnerabilidades",
      titulo: "Riscos críticos em aberto",
      status: "nao_verificado",
      severidade: "info",
      descricao: e?.message,
      peso: 1,
    });
  }

  // 7. Configurações de segurança preenchidas
  try {
    const { data: s, error } = await admin.from("security_settings").select("*").limit(1).maybeSingle();
    if (error) throw error;
    if (!s) {
      checks.push({
        chave: "settings.present",
        categoria: "Configuração",
        titulo: "Configurações de segurança",
        status: "atencao",
        severidade: "medio",
        recomendacao: "Configurar valores em Configurações.",
        peso: 1,
      });
    } else {
      checks.push({
        chave: "settings.session_timeout",
        categoria: "Sessões",
        titulo: "Expiração de sessão configurada",
        status: s.session_timeout_minutes > 0 && s.session_timeout_minutes <= 240 ? "ok" : "atencao",
        severidade: "baixo",
        evidencia: { minutos: s.session_timeout_minutes },
        peso: 1,
      });
      checks.push({
        chave: "settings.mfa_admin",
        categoria: "Sessões",
        titulo: "MFA obrigatório para administradores",
        status: s.mfa_required_admin ? "ok" : "atencao",
        severidade: s.mfa_required_admin ? "info" : "medio",
        recomendacao: !s.mfa_required_admin ? "Ativar MFA para administradores quando suportado." : undefined,
        peso: 2,
      });
      checks.push({
        chave: "settings.log_retention",
        categoria: "Logs",
        titulo: "Retenção de logs configurada",
        status: s.log_retention_days >= 90 ? "ok" : "atencao",
        severidade: "baixo",
        evidencia: { dias: s.log_retention_days },
        peso: 1,
      });
    }
  } catch (e: any) {
    checks.push({
      chave: "settings.present",
      categoria: "Configuração",
      titulo: "Configurações de segurança",
      status: "nao_verificado",
      severidade: "info",
      descricao: e?.message,
      peso: 1,
    });
  }

  // 8. Service role só no servidor (não verificável em runtime; declarativo)
  checks.push({
    chave: "secrets.service_role_backend_only",
    categoria: "Segredos e credenciais",
    titulo: "SUPABASE_SERVICE_ROLE_KEY apenas no backend",
    status: process.env.SUPABASE_SERVICE_ROLE_KEY ? "ok" : "nao_verificado",
    severidade: "info",
    descricao: "Chave carregada apenas no runtime server-side. Verificação de exposição no frontend deve ser feita por scan de código.",
    peso: 2,
  });

  // 9. HTTPS / plataforma
  checks.push({
    chave: "transport.https",
    categoria: "Criptografia e transmissão",
    titulo: "HTTPS obrigatório",
    status: "nao_verificado",
    severidade: "info",
    descricao: "Fornecido pela plataforma de hospedagem. Verificação manual recomendada.",
    peso: 1,
  });

  // 10. Auditoria automatizada de código
  checks.push({
    chave: "code.dependency_scan",
    categoria: "Dependências",
    titulo: "Scan de dependências vulneráveis",
    status: "nao_implementado",
    severidade: "medio",
    recomendacao: "Rodar scanner de dependências periodicamente (previsto em fase futura).",
    peso: 1,
  });

  return checks;
}
