import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { Briefcase, FileSearch, Tag, Users, TrendingUp, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "BI — PoolFlux" }] }),
  component: Dashboard,
});

function StatCard({ icon: Icon, label, value, hint }: { icon: any; label: string; value: string | number; hint?: string }) {
  return (
    <div className="surface rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
        <Icon className="h-4 w-4 text-cyan" />
      </div>
      <div className="text-3xl font-bold">{value}</div>
      {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
    </div>
  );
}

function Dashboard() {
  const { data } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const [clients, imm, reps, competitors] = await Promise.all([
        supabase.from("clients").select("id, grupo, categoria, status", { count: "exact" }),
        supabase.from("immersions").select("id, status", { count: "exact" }),
        supabase.from("representatives").select("id", { count: "exact", head: true }),
        supabase.from("price_competitors").select("id", { count: "exact", head: true }),
      ]);
      const byGroup: Record<string, number> = {};
      const byCategory: Record<string, number> = {};
      (clients.data ?? []).forEach((c: any) => {
        if (c.grupo) byGroup[c.grupo] = (byGroup[c.grupo] ?? 0) + 1;
        if (c.categoria) byCategory[c.categoria] = (byCategory[c.categoria] ?? 0) + 1;
      });
      const byStatus: Record<string, number> = {};
      (imm.data ?? []).forEach((i: any) => { byStatus[i.status] = (byStatus[i.status] ?? 0) + 1; });
      return {
        totalClients: clients.count ?? 0,
        totalImm: imm.count ?? 0,
        totalReps: reps.count ?? 0,
        totalCompetitors: competitors.count ?? 0,
        byGroup, byCategory, byStatus,
      };
    },
  });

  return (
    <div>
      <PageHeader title="Painel BI" subtitle="Indicadores consolidados das imersões comerciais" />
      <div className="p-8 space-y-8">
        <div className="grid gap-4 md:grid-cols-4">
          <StatCard icon={Briefcase} label="Clientes" value={data?.totalClients ?? 0} />
          <StatCard icon={FileSearch} label="Imersões" value={data?.totalImm ?? 0} />
          <StatCard icon={Users} label="Representantes" value={data?.totalReps ?? 0} />
          <StatCard icon={Tag} label="Competidores" value={data?.totalCompetitors ?? 0} />
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="surface rounded-xl p-5">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">Clientes por grupo</h3>
            <div className="space-y-2">
              {["G1","G2","G2+","Corporativo"].map(g => (
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
              {["Black","Gold","Silver"].map(c => (
                <div key={c} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{c}</span>
                  <span className="font-semibold">{data?.byCategory?.[c] ?? 0}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="surface rounded-xl p-5">
            <h3 className="text-sm font-semibold mb-3">Imersões por status</h3>
            <div className="space-y-2">
              {Object.entries(data?.byStatus ?? {}).map(([s, n]) => (
                <div key={s} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground capitalize">{s.replace(/_/g, " ")}</span>
                  <span className="font-semibold">{n}</span>
                </div>
              ))}
              {Object.keys(data?.byStatus ?? {}).length === 0 && (
                <p className="text-xs text-muted-foreground">Nenhuma imersão ainda</p>
              )}
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="surface rounded-xl p-5">
            <div className="flex items-center gap-2 mb-2"><TrendingUp className="h-4 w-4 text-cyan" /><h3 className="text-sm font-semibold">Oportunidades IA</h3></div>
            <p className="text-sm text-muted-foreground">Oportunidades identificadas pela IA aparecem aqui após gerar diagnósticos.</p>
          </div>
          <div className="surface rounded-xl p-5">
            <div className="flex items-center gap-2 mb-2"><AlertTriangle className="h-4 w-4 text-warning" /><h3 className="text-sm font-semibold">Ameaças IA</h3></div>
            <p className="text-sm text-muted-foreground">Ameaças identificadas pela IA aparecem aqui após gerar diagnósticos.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
