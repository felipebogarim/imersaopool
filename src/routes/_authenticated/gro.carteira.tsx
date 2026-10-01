/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowRight, Building2, CalendarClock, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useGroContext } from "@/hooks/useGroContext";
import { supabase } from "@/integrations/supabase/client";
import { isOverdue, periodKind } from "@/lib/gro-nr1";

const db = supabase as any;
export const Route = createFileRoute("/_authenticated/gro/carteira")({
  head: () => ({ meta: [{ title: "Carteira GRO NR1 — PoolFlux" }] }),
  component: Portfolio,
});

function Portfolio() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: context, isLoading } = useGroContext();
  const portfolio = useQuery({
    queryKey: ["gro-portfolio"],
    enabled: !!context?.isConsultant,
    queryFn: async () => {
      const [companies, periods, documents, questionnaires, reports, actions, evidences] =
        await Promise.all([
          db.from("companies").select("id,nome").order("nome"),
          db.from("gro_periods").select("*"),
          db.from("gro_documents").select("id,company_id,period_id,status"),
          db.from("gro_questionnaires").select("id,company_id,period_id,status,eligible_total"),
          db.from("gro_final_reports").select("id,company_id,period_id,status"),
          db.from("gro_actions").select("id,company_id,origin_period_id,status,due_on"),
          db.from("gro_evidences").select("id,company_id,status"),
        ]);
      for (const result of [
        companies,
        periods,
        documents,
        questionnaires,
        reports,
        actions,
        evidences,
      ])
        if (result.error) throw result.error;
      return {
        companies: companies.data ?? [],
        periods: periods.data ?? [],
        documents: documents.data ?? [],
        questionnaires: questionnaires.data ?? [],
        reports: reports.data ?? [],
        actions: actions.data ?? [],
        evidences: evidences.data ?? [],
      };
    },
  });
  if (isLoading || portfolio.isLoading)
    return (
      <div className="grid min-h-[70vh] place-items-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  if (!context?.isConsultant)
    return <div className="p-8 text-center">A Carteira é restrita à consultoria.</div>;
  if (portfolio.error || !portfolio.data)
    return (
      <div className="m-8 rounded-lg border border-destructive/30 p-5 text-destructive">
        {(portfolio.error as Error)?.message ?? "Falha ao carregar carteira"}
      </div>
    );
  async function enter(companyId: string) {
    const { error } = await db
      .from("profiles")
      .update({ active_company_id: companyId })
      .eq("id", context!.userId);
    if (error) return toast.error(error.message);
    await qc.invalidateQueries();
    navigate({ to: "/gro/empresa/$section", params: { section: "panorama" } });
  }
  return (
    <div className="min-h-screen bg-slate-50/70">
      <header className="border-b bg-background px-4 py-6 sm:px-8">
        <div className="mx-auto max-w-7xl">
          <h1 className="text-2xl font-bold">Carteira da Consultoria</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Central operacional: o que precisa da minha atenção?
          </p>
        </div>
      </header>
      <main className="mx-auto max-w-7xl space-y-4 p-4 sm:p-8">
        <div className="grid gap-3 sm:grid-cols-3">
          <Summary
            value={portfolio.data.companies.length}
            label="Empresas na carteira"
            icon={Building2}
          />
          <Summary
            value={portfolio.data.actions.filter(isOverdue).length}
            label="Ações vencidas"
            icon={AlertTriangle}
          />
          <Summary
            value={
              portfolio.data.periods.filter((period: any) => periodKind(period) === "programado")
                .length
            }
            label="Períodos programados"
            icon={CalendarClock}
          />
        </div>
        <div className="space-y-3 md:hidden">
          {portfolio.data.companies.map((company: any) => (
            <PortfolioMobileCard
              key={company.id}
              company={company}
              data={portfolio.data}
              onEnter={() => enter(company.id)}
            />
          ))}
        </div>
        <div className="hidden overflow-x-auto rounded-xl border bg-background md:block">
          <table className="w-full min-w-[980px] text-sm">
            <thead className="bg-muted/70 text-left text-xs text-muted-foreground">
              <tr>
                {[
                  "Empresa",
                  "Situação contratual",
                  "Período atual",
                  "Etapa técnica",
                  "Entrega consultoria",
                  "Execução empresa",
                  "Pendências",
                  "Vencidas",
                  "Próximo passo",
                  "",
                ].map((label) => (
                  <th key={label} className="px-3 py-3 font-medium">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {portfolio.data.companies.map((company: any) => (
                <PortfolioRow
                  key={company.id}
                  company={company}
                  data={portfolio.data}
                  onEnter={() => enter(company.id)}
                />
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}

function PortfolioRow({ company, data, onEnter }: any) {
  const companyPeriods = data.periods.filter((period: any) => period.company_id === company.id);
  const period =
    companyPeriods.find((item: any) => periodKind(item) === "atual") ?? companyPeriods[0];
  const docs = data.documents.filter(
    (item: any) => item.company_id === company.id && (!period || item.period_id === period.id),
  );
  const questionnaires = data.questionnaires.filter(
    (item: any) => item.company_id === company.id && (!period || item.period_id === period.id),
  );
  const reports = data.reports.filter(
    (item: any) => item.company_id === company.id && (!period || item.period_id === period.id),
  );
  const actions = data.actions.filter((item: any) => item.company_id === company.id);
  const complete = actions.filter((item: any) => item.status === "completed").length;
  const execution = actions.length ? Math.round((complete / actions.length) * 100) : 0;
  const overdue = actions.filter(isOverdue).length;
  let next = "Criar período";
  let stage = "Não iniciado";
  let delivery = 0;
  if (period) {
    stage = "Preparação";
    delivery = 20;
    next = "Receber documentação";
  }
  if (docs.length) {
    stage = "Avaliação";
    delivery = 40;
    next = "Aplicar questionários";
  }
  if (questionnaires.some((item: any) => item.status === "closed")) {
    stage = "Consolidação";
    delivery = 65;
    next = "Consolidar diagnóstico";
  }
  if (reports.some((item: any) => item.status === "validated")) {
    stage = "Entrega";
    delivery = 90;
    next = "Publicar relatório";
  }
  if (reports.some((item: any) => item.status === "delivered")) {
    stage = "Acompanhamento";
    delivery = 100;
    next = overdue ? "Cobrar ações vencidas" : "Acompanhar execução";
  }
  const pending =
    (docs.length ? 0 : 1) +
    (questionnaires.length ? 0 : 1) +
    (reports.some((item: any) => ["published", "delivered"].includes(item.status)) ? 0 : 1);
  return (
    <tr className="border-t">
      <td className="px-3 py-4 font-medium">{company.nome}</td>
      <td className="px-3 py-4">
        <Badge variant="outline">Ativo</Badge>
      </td>
      <td className="px-3 py-4">{period?.name ?? "—"}</td>
      <td className="px-3 py-4">{stage}</td>
      <td className="px-3 py-4">{delivery}%</td>
      <td className="px-3 py-4">{execution}%</td>
      <td className="px-3 py-4">{pending}</td>
      <td className={overdue ? "px-3 py-4 font-semibold text-destructive" : "px-3 py-4"}>
        {overdue}
      </td>
      <td className="px-3 py-4">{next}</td>
      <td className="px-3 py-4">
        <Button size="sm" variant="ghost" onClick={onEnter}>
          Abrir <ArrowRight className="ml-1 h-4 w-4" />
        </Button>
      </td>
    </tr>
  );
}

function PortfolioMobileCard({ company, data, onEnter }: any) {
  const periods = data.periods.filter((item: any) => item.company_id === company.id);
  const period = periods.find((item: any) => periodKind(item) === "atual") ?? periods[0];
  const actions = data.actions.filter((item: any) => item.company_id === company.id);
  const overdue = actions.filter(isOverdue).length;
  const report = data.reports.find(
    (item: any) => item.company_id === company.id && (!period || item.period_id === period.id),
  );
  const next = !period
    ? "Criar período"
    : !report
      ? "Avançar preparação técnica"
      : report.status === "delivered"
        ? overdue
          ? "Tratar ações vencidas"
          : "Acompanhar execução"
        : "Concluir relatório";
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <strong>{company.nome}</strong>
            <p className="text-xs text-muted-foreground">{period?.name ?? "Não iniciado"}</p>
          </div>
          {overdue > 0 && <Badge variant="destructive">{overdue} vencida(s)</Badge>}
        </div>
        <p className="mt-4 text-xs uppercase tracking-wide text-muted-foreground">Próximo passo</p>
        <p className="text-sm font-medium">{next}</p>
        <Button className="mt-4 w-full" size="sm" variant="outline" onClick={onEnter}>
          Abrir empresa <ArrowRight className="ml-1 h-4 w-4" />
        </Button>
      </CardContent>
    </Card>
  );
}
function Summary({ value, label, icon: Icon }: any) {
  return (
    <Card>
      <CardContent className="p-4">
        <Icon className="mb-2 h-4 w-4 text-primary" />
        <strong className="text-2xl">{value}</strong>
        <p className="text-xs text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}
