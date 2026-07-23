import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ShieldCheck, ShieldAlert, AlertTriangle, FileCheck2, Clock, Trash2 } from "lucide-react";

type Kpis = {
  mfa: {
    total_admins: number;
    admins_com_fator: number;
    admins_sem_fator: number;
    pct_cobertura: number;
    avg_hours_enroll: number | null;
    enforcement_started_at: string | null;
    deadline: string | null;
    grace_days: number | null;
  };
  intrusao: { auth_falhas_24h: number; admin_op_rejeitadas_24h: number };
  lgpd: { purges_pendentes: number; purges_executadas_30d: number };
  termos: { total_usuarios: number; aceitos: number; pendentes: number; nova_versao_disponivel: number };
  gerado_em: string;
};

function Kpi({
  icon: Icon,
  title,
  value,
  hint,
  tone = "default",
}: {
  icon: any;
  title: string;
  value: string | number;
  hint?: string;
  tone?: "default" | "warn" | "danger" | "ok";
}) {
  const toneCls =
    tone === "danger"
      ? "text-destructive"
      : tone === "warn"
      ? "text-amber-600 dark:text-amber-400"
      : tone === "ok"
      ? "text-emerald-600 dark:text-emerald-400"
      : "";
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-2">
          <Icon className={`h-4 w-4 ${toneCls}`} /> {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-semibold tabular-nums ${toneCls}`}>{value}</div>
        {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
      </CardContent>
    </Card>
  );
}

export const Route = createFileRoute("/_authenticated/admin/conformidade")({
  head: () => ({ meta: [{ title: "Conformidade e Aceites" }, { name: "robots", content: "noindex" }] }),
  component: ConformidadePage,
});

function statusBadge(s: string) {
  if (s === "aceito") return <Badge>Aceito</Badge>;
  if (s === "aceite_pendente") return <Badge variant="destructive">Aceite pendente</Badge>;
  if (s === "nova_versao_disponivel") return <Badge variant="secondary">Nova versão disponível</Badge>;
  return <Badge variant="outline">—</Badge>;
}

function ConformidadePage() {
  const [filter, setFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: kpis } = useQuery<Kpis | null>({
    queryKey: ["admin-conformidade-kpis"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_conformidade_kpis");
      if (error) throw error;
      return (data as unknown as Kpis) ?? null;
    },
    staleTime: 60_000,
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-conformidade"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_list_terms_conformidade");
      if (error) throw error;
      return data ?? [];
    },
  });

  const rows = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return (data ?? []).filter((r: any) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (!q) return true;
      return [r.email, r.full_name, r.role].some((v) => String(v ?? "").toLowerCase().includes(q));
    });
  }, [data, filter, statusFilter]);

  const deadlineLabel = kpis?.mfa.deadline
    ? new Date(kpis.mfa.deadline).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })
    : null;
  const mfaTone: "ok" | "warn" | "danger" =
    !kpis ? "warn"
    : kpis.mfa.pct_cobertura >= 100 ? "ok"
    : kpis.mfa.pct_cobertura >= 60 ? "warn"
    : "danger";

  return (
    <div className="min-h-screen">
      <PageHeader
        title="Conformidade e Aceites"
        subtitle="Status de aceite dos Termos de Uso por usuário — somente informações de controle"
      />
      <div className="p-4 sm:p-8 space-y-6">
        {kpis && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">MFA administrativo</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <Kpi
                icon={ShieldCheck}
                title="Cobertura MFA (admins)"
                value={`${kpis.mfa.pct_cobertura}%`}
                hint={`${kpis.mfa.admins_com_fator}/${kpis.mfa.total_admins} com fator verificado`}
                tone={mfaTone}
              />
              <Kpi
                icon={ShieldAlert}
                title="Admins sem MFA"
                value={kpis.mfa.admins_sem_fator}
                hint={kpis.mfa.admins_sem_fator === 0 ? "Todos configurados" : "Pendentes de cadastro"}
                tone={kpis.mfa.admins_sem_fator === 0 ? "ok" : "warn"}
              />
              <Kpi
                icon={Clock}
                title="Tempo médio de cadastro"
                value={kpis.mfa.avg_hours_enroll != null ? `${kpis.mfa.avg_hours_enroll} h` : "—"}
                hint="Do início ao fim do enroll TOTP"
              />
              <Kpi
                icon={ShieldCheck}
                title="Enforcement"
                value={kpis.mfa.enforcement_started_at ? "Ativo" : "Desativado"}
                hint={deadlineLabel ? `Prazo: ${deadlineLabel}` : "Sem prazo definido"}
                tone={kpis.mfa.enforcement_started_at ? "ok" : "warn"}
              />
            </div>

            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider pt-2">
              Intrusão e operações sensíveis (24h)
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <Kpi
                icon={AlertTriangle}
                title="Falhas de login"
                value={kpis.intrusao.auth_falhas_24h}
                tone={kpis.intrusao.auth_falhas_24h > 20 ? "danger" : kpis.intrusao.auth_falhas_24h > 5 ? "warn" : "ok"}
              />
              <Kpi
                icon={ShieldAlert}
                title="Operações admin recusadas"
                value={kpis.intrusao.admin_op_rejeitadas_24h}
                hint="AAL1 tentando ação sensível"
                tone={kpis.intrusao.admin_op_rejeitadas_24h > 0 ? "warn" : "ok"}
              />
              <Kpi
                icon={Trash2}
                title="Purgas LGPD pendentes"
                value={kpis.lgpd.purges_pendentes}
                tone={kpis.lgpd.purges_pendentes > 0 ? "warn" : "ok"}
              />
              <Kpi
                icon={FileCheck2}
                title="Purgas executadas (30d)"
                value={kpis.lgpd.purges_executadas_30d}
              />
            </div>

            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider pt-2">Termos de Uso</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <Kpi icon={FileCheck2} title="Usuários" value={kpis.termos.total_usuarios} />
              <Kpi icon={ShieldCheck} title="Aceites atuais" value={kpis.termos.aceitos} tone="ok" />
              <Kpi
                icon={AlertTriangle}
                title="Aceite pendente"
                value={kpis.termos.pendentes}
                tone={kpis.termos.pendentes > 0 ? "warn" : "ok"}
              />
              <Kpi
                icon={AlertTriangle}
                title="Nova versão disponível"
                value={kpis.termos.nova_versao_disponivel}
                tone={kpis.termos.nova_versao_disponivel > 0 ? "warn" : "ok"}
              />
            </div>
          </section>
        )}


        <div className="flex flex-col sm:flex-row gap-2">
          <Input placeholder="Buscar por e-mail, nome ou perfil…" value={filter} onChange={(e) => setFilter(e.target.value)} className="sm:max-w-sm" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-border bg-background rounded-md px-3 text-sm h-10"
          >
            <option value="all">Todos os status</option>
            <option value="aceito">Aceito</option>
            <option value="aceite_pendente">Aceite pendente</option>
            <option value="nova_versao_disponivel">Nova versão disponível</option>
          </select>
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando…</div>
        ) : error ? (
          <p className="text-destructive text-sm">{(error as Error).message}</p>
        ) : (
          <div className="rounded-lg border border-border overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Usuário</th>
                  <th className="px-3 py-2">Perfil</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Versão aceita</th>
                  <th className="px-3 py-2">Aceito em</th>
                  <th className="px-3 py-2">Última ciência (login)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((r: any) => (
                  <tr key={r.user_id}>
                    <td className="px-3 py-2">
                      <div className="font-medium">{r.full_name ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">{r.email}</div>
                    </td>
                    <td className="px-3 py-2">{r.role ?? "—"}</td>
                    <td className="px-3 py-2">{statusBadge(r.status)}</td>
                    <td className="px-3 py-2">{r.accepted_version ?? "—"}</td>
                    <td className="px-3 py-2">{r.accepted_at ? new Date(r.accepted_at).toLocaleString("pt-BR") : "—"}</td>
                    <td className="px-3 py-2">{r.last_login_ack_at ? new Date(r.last_login_ack_at).toLocaleString("pt-BR") : "—"}</td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr><td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">Nenhum registro.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-xs text-muted-foreground">Registros de aceite são imutáveis: não podem ser editados ou apagados por esta interface.</p>
      </div>
    </div>
  );
}
