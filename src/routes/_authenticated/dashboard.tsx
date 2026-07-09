import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { LoadingCards, LoadingRows } from "@/components/EmptyState";
import {
  Briefcase, FileSearch, Tag, Users, TrendingUp, AlertTriangle,
  Sparkles, MessageSquare, CheckCircle2, Clock, FileText,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "BI — PoolFlux" }] }),
  component: Dashboard,
});


function StatCard({
  icon: Icon, label, value, hint, to,
}: { icon: any; label: string; value: string | number; hint?: string; to?: string }) {
  const body = (
    <div className="surface rounded-xl p-5 h-full transition hover:border-cyan/60">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
        <Icon className="h-4 w-4 text-cyan" />
      </div>
      <div className="text-3xl font-bold">{value}</div>
      {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
    </div>
  );
  return to ? <Link to={to as any} className="block">{body}</Link> : body;
}

function Bar({ label, value, total }: { label: string; value: number; total: number }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground capitalize">{label.replace(/_/g, " ")}</span>
        <span className="font-mono">{value}</span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div className="h-full bg-cyan rounded-full" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function AlertStat({ label, value, tone }: { label: string; value: number; tone: "destructive" | "warning" | "muted" }) {
  const toneClass =
    tone === "destructive" ? "text-destructive" :
    tone === "warning" ? "text-warning" : "text-muted-foreground";
  return (
    <div className="rounded-lg border border-border p-3">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`text-2xl font-bold ${toneClass}`}>{value}</p>
    </div>
  );


const IMM_STATUS_ORDER = ["planejada", "antes_visita", "em_visita", "pos_visita", "concluida"];

function Dashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-exec"],
    queryFn: async () => {
      const todayISO = new Date().toISOString().slice(0, 10);
      const in7 = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
      const [clients, imm, reps, competitors, persp, comps, interviews, actions] = await Promise.all([
        supabase.from("clients").select("id, grupo, categoria, status", { count: "exact" }),
        supabase.from("immersions").select("id, titulo, status, data_visita", { count: "exact" }).order("data_visita", { ascending: false }),
        supabase.from("representatives").select("id", { count: "exact", head: true }),
        supabase.from("price_competitors").select("id", { count: "exact", head: true }),
        supabase.from("perspectivas").select("id, lente, status, escopo_tipo", { count: "exact" }),
        supabase.from("ai_compilations").select("id, tipo, escopo_tipo, versao, created_at").order("created_at", { ascending: false }).limit(5),
        supabase.from("interviews").select("id", { count: "exact", head: true }),
        supabase.from("action_plans").select("id, acao, prioridade, status, prazo").in("status", ["pendente", "em_andamento"]),
      ]);

      const byGroup: Record<string, number> = {};
      const byCategory: Record<string, number> = {};
      (clients.data ?? []).forEach((c: any) => {
        if (c.grupo) byGroup[c.grupo] = (byGroup[c.grupo] ?? 0) + 1;
        if (c.categoria) byCategory[c.categoria] = (byCategory[c.categoria] ?? 0) + 1;
      });

      const byStatus: Record<string, number> = {};
      (imm.data ?? []).forEach((i: any) => { byStatus[i.status] = (byStatus[i.status] ?? 0) + 1; });

      const byLente: Record<string, number> = {};
      const byPerspStatus: Record<string, number> = {};
      const byEscopo: Record<string, number> = {};
      (persp.data ?? []).forEach((p: any) => {
        byLente[p.lente] = (byLente[p.lente] ?? 0) + 1;
        byPerspStatus[p.status] = (byPerspStatus[p.status] ?? 0) + 1;
        byEscopo[p.escopo_tipo] = (byEscopo[p.escopo_tipo] ?? 0) + 1;
      });

      const acoesAbertas = actions.data ?? [];
      const vencidas = acoesAbertas.filter((a: any) => a.prazo && a.prazo < todayISO);
      const proximas = acoesAbertas.filter((a: any) => a.prazo && a.prazo >= todayISO && a.prazo <= in7);
      const semPrazo = acoesAbertas.filter((a: any) => !a.prazo);
      const alertasAlta = acoesAbertas.filter((a: any) => a.prioridade === "alta");

      const recentImm = (imm.data ?? []).slice(0, 5);

      return {
        totalClients: clients.count ?? 0,
        totalImm: imm.count ?? 0,
        totalReps: reps.count ?? 0,
        totalCompetitors: competitors.count ?? 0,
        totalPersp: persp.count ?? 0,
        totalInterviews: interviews.count ?? 0,
        aprovadas: byPerspStatus["aprovada"] ?? 0,
        pendentes: byPerspStatus["ia_sugerida"] ?? 0,
        byGroup, byCategory, byStatus, byLente, byPerspStatus, byEscopo,
        recentImm,
        recentCompilations: comps.data ?? [],
        acoesAbertas: acoesAbertas.length,
        vencidas, proximas, semPrazo, alertasAlta,
      };
    },
  });


  const totalPersp = data?.totalPersp ?? 0;
  const totalImm = data?.totalImm ?? 0;

  return (
    <div>
      <PageHeader title="Painel BI" subtitle="Indicadores consolidados das imersões comerciais" />
      <div className="p-4 sm:p-8 space-y-8">
        {isLoading ? (
          <>
            <LoadingCards count={6} />
            <LoadingRows rows={4} />
          </>
        ) : (
        <>
        <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
          <StatCard icon={Briefcase} label="Clientes" value={data?.totalClients ?? 0} to="/clientes" />
          <StatCard icon={FileSearch} label="Imersões" value={totalImm} to="/imersoes" />
          <StatCard icon={MessageSquare} label="Entrevistas" value={data?.totalInterviews ?? 0} to="/entrevistas" />
          <StatCard icon={Sparkles} label="Perspectivas" value={totalPersp} to="/perspectivas" />
          <StatCard icon={Users} label="Representantes" value={data?.totalReps ?? 0} to="/representantes" />
          <StatCard icon={Tag} label="Competidores" value={data?.totalCompetitors ?? 0} to="/price" />
        </div>

        {(data?.vencidas?.length || data?.proximas?.length || data?.alertasAlta?.length) ? (
          <div className="surface rounded-xl p-5 border-l-4 border-warning">
            <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-warning" />
                <h3 className="text-sm font-semibold">Alertas de plano de ação</h3>
              </div>
              <Link to="/planos" className="text-xs text-cyan hover:underline">Ver kanban</Link>
            </div>
            <div className="grid gap-4 md:grid-cols-4">
              <AlertStat label="Vencidas" value={data?.vencidas?.length ?? 0} tone="destructive" />
              <AlertStat label="Próximas (7 dias)" value={data?.proximas?.length ?? 0} tone="warning" />
              <AlertStat label="Alta prioridade" value={data?.alertasAlta?.length ?? 0} tone="warning" />
              <AlertStat label="Sem prazo" value={data?.semPrazo?.length ?? 0} tone="muted" />
            </div>
            {(data?.vencidas ?? []).length > 0 && (
              <ul className="mt-4 space-y-1.5 text-sm">
                {(data?.vencidas ?? []).slice(0, 5).map((a: any) => (
                  <li key={a.id} className="flex items-center justify-between gap-2 border-t border-border pt-2">
                    <span className="truncate">{a.acao}</span>
                    <span className="text-xs text-destructive shrink-0">
                      venceu em {new Date(a.prazo).toLocaleDateString("pt-BR")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}




        <div className="grid gap-4 md:grid-cols-3">
          <div className="surface rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle2 className="h-4 w-4 text-cyan" />
              <h3 className="text-sm font-semibold">Perspectivas aprovadas</h3>
            </div>
            <div className="text-3xl font-bold">{data?.aprovadas ?? 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              de {totalPersp} total ({totalPersp > 0 ? Math.round(((data?.aprovadas ?? 0) / totalPersp) * 100) : 0}%)
            </p>
          </div>
          <div className="surface rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="h-4 w-4 text-warning" />
              <h3 className="text-sm font-semibold">Aguardando curadoria</h3>
            </div>
            <div className="text-3xl font-bold">{data?.pendentes ?? 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Sugestões da IA pendentes</p>
          </div>
          <div className="surface rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <FileText className="h-4 w-4 text-cyan" />
              <h3 className="text-sm font-semibold">Compilações IA</h3>
            </div>
            <div className="text-3xl font-bold">{data?.recentCompilations?.length ?? 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Últimas geradas</p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="surface rounded-xl p-5">
            <h3 className="text-sm font-semibold mb-4">Funil de imersões</h3>
            <div className="space-y-3">
              {IMM_STATUS_ORDER.map(s => (
                <Bar key={s} label={s} value={data?.byStatus?.[s] ?? 0} total={totalImm || 1} />
              ))}
              {totalImm === 0 && <p className="text-xs text-muted-foreground">Nenhuma imersão ainda</p>}
            </div>
          </div>
          <div className="surface rounded-xl p-5">
            <h3 className="text-sm font-semibold mb-4">Perspectivas por lente</h3>
            <div className="space-y-2">
              {Object.entries(data?.byLente ?? {})
                .sort(([, a], [, b]) => (b as number) - (a as number))
                .map(([l, n]) => (
                  <Bar key={l} label={l} value={n as number} total={totalPersp || 1} />
                ))}
              {totalPersp === 0 && <p className="text-xs text-muted-foreground">Nenhuma perspectiva ainda</p>}
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="surface rounded-xl p-5">
            <h3 className="text-sm font-semibold mb-3">Clientes por grupo</h3>
            <div className="space-y-2">
              {["G1", "G2", "G2+", "Corporativo"].map(g => (
                <div key={g} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{g}</span>
                  <span className="font-semibold">{data?.byGroup?.[g] ?? 0}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="surface rounded-xl p-5">
            <h3 className="text-sm font-semibold mb-3">Clientes por categoria</h3>
            <div className="space-y-2">
              {["Black", "Gold", "Silver"].map(c => (
                <div key={c} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{c}</span>
                  <span className="font-semibold">{data?.byCategory?.[c] ?? 0}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="surface rounded-xl p-5">
            <h3 className="text-sm font-semibold mb-3">Perspectivas por escopo</h3>
            <div className="space-y-2">
              {["cliente", "familia", "competidor", "empresa"].map(e => (
                <div key={e} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground capitalize">{e}</span>
                  <span className="font-semibold">{data?.byEscopo?.[e] ?? 0}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="surface rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold">Últimas imersões</h3>
              <Link to="/imersoes" className="text-xs text-cyan hover:underline">Ver todas</Link>
            </div>
            <div className="space-y-2">
              {(data?.recentImm ?? []).map((i: any) => (
                <Link
                  key={i.id}
                  to="/imersoes/$id"
                  params={{ id: i.id }}
                  className="flex items-center justify-between text-sm p-2 rounded hover:bg-muted/50"
                >
                  <span className="truncate">{i.titulo}</span>
                  <span className="text-xs text-muted-foreground capitalize ml-2">
                    {i.status?.replace(/_/g, " ")}
                  </span>
                </Link>
              ))}
              {(data?.recentImm ?? []).length === 0 && (
                <p className="text-xs text-muted-foreground">Nenhuma imersão registrada</p>
              )}
            </div>
          </div>
          <div className="surface rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold">Últimas compilações IA</h3>
              <Link to="/compilacoes" className="text-xs text-cyan hover:underline">Ver todas</Link>
            </div>
            <div className="space-y-2">
              {(data?.recentCompilations ?? []).map((c: any) => (
                <div key={c.id} className="flex items-center justify-between text-sm p-2 rounded hover:bg-muted/50">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-3 w-3 text-cyan" />
                    <span className="capitalize">{c.tipo?.replace(/_/g, " ")}</span>
                    <span className="text-xs text-muted-foreground">v{c.versao ?? 1}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(c.created_at).toLocaleDateString("pt-BR")}
                  </span>
                </div>
              ))}
              {(data?.recentCompilations ?? []).length === 0 && (
                <p className="text-xs text-muted-foreground">Nenhuma compilação gerada</p>
              )}
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="surface rounded-xl p-5">
            <div className="flex items-center gap-2 mb-2"><TrendingUp className="h-4 w-4 text-cyan" /><h3 className="text-sm font-semibold">Oportunidades</h3></div>
            <p className="text-3xl font-bold">{data?.byLente?.["oportunidade"] ?? 0}</p>
            <p className="text-xs text-muted-foreground mt-1">Perspectivas na lente "oportunidade"</p>
          </div>
          <div className="surface rounded-xl p-5">
            <div className="flex items-center gap-2 mb-2"><AlertTriangle className="h-4 w-4 text-warning" /><h3 className="text-sm font-semibold">Ameaças</h3></div>
            <p className="text-3xl font-bold">{data?.byLente?.["ameaca"] ?? 0}</p>
            <p className="text-xs text-muted-foreground mt-1">Perspectivas na lente "ameaça"</p>
          </div>
        </div>
        </>
        )}
      </div>

    </div>
  );
}
