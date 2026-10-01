/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  FileCheck2,
  HeartPulse,
  ShieldAlert,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { CONSULTANCY_STEPS, formatDate, isOverdue } from "@/lib/gro-nr1";

export function GroPanorama({ data, periods }: { data: any; periods: any[] }) {
  const actions = data.actions ?? [];
  const evidences = data.evidences ?? [];
  const documents = data.documents ?? [];
  const completed = actions.filter((action: any) => action.status === "completed").length;
  const overdue = actions.filter(isOverdue).length;
  const inProgress = actions.filter((action: any) => action.status === "in_progress").length;
  const withEvidence = new Set(evidences.map((item: any) => item.action_id)).size;
  const execution = actions.length ? Math.round((completed / actions.length) * 100) : 0;
  const configuredSteps = data.steps?.length
    ? data.steps
    : CONSULTANCY_STEPS.map(([step_key, label], position) => ({ step_key, label, position }));
  const completedSteps = configuredSteps.filter((step: any) => step.completed_at).length;
  const delivery = configuredSteps.length
    ? Math.round((completedSteps / configuredSteps.length) * 100)
    : 0;
  const catCount = documents
    .filter((doc: any) => doc.category === "cat")
    .reduce((sum: number, doc: any) => sum + (doc.aggregate_count ?? 1), 0);
  const absenceDays = documents
    .filter((doc: any) => doc.category === "medical_certificates")
    .reduce((sum: number, doc: any) => sum + (doc.absence_days ?? 0), 0);
  const comparison = periods.length > 1;

  return (
    <div className="space-y-5">
      {comparison && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm">
          <strong>Visão comparativa/agregada:</strong> {periods.length} períodos selecionados. A
          evolução só é exibida para dados com a mesma base técnica.
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-teal-600/30">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <ClipboardCheck className="h-5 w-5 text-teal-600" /> Entrega da Consultoria
              </CardTitle>
              <strong className="text-2xl text-teal-700">{delivery}%</strong>
            </div>
            <Progress value={delivery} />
            <p className="text-xs text-muted-foreground">
              {completedSteps} de {configuredSteps.length} etapas concluídas
            </p>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2">
            {configuredSteps
              .sort((a: any, b: any) => a.position - b.position)
              .map((step: any) => (
                <div key={step.step_key} className="flex items-center gap-2 text-sm">
                  {step.completed_at ? (
                    <CheckCircle2 className="h-4 w-4 text-teal-600" />
                  ) : (
                    <span className="h-4 w-4 rounded-full border" />
                  )}
                  <span className={step.completed_at ? "" : "text-muted-foreground"}>
                    {step.label}
                  </span>
                </div>
              ))}
          </CardContent>
        </Card>

        <Card className="border-sky-700/30">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <FileCheck2 className="h-5 w-5 text-sky-700" /> Execução da Empresa
              </CardTitle>
              <strong className="text-2xl text-sky-800">{execution}%</strong>
            </div>
            <Progress value={execution} className="[&>div]:bg-sky-700" />
            <p className="text-xs text-muted-foreground">
              {completed} de {actions.length} ações concluídas
            </p>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Metric value={actions.length} label="Ações" />
            <Metric value={inProgress} label="Em andamento" />
            <Metric value={overdue} label="Vencidas" alert={overdue > 0} />
            <Metric value={withEvidence} label="Com evidência" />
            <Metric
              value={Math.max(actions.length - withEvidence, 0)}
              label="Aguardando evidência"
            />
            <Metric value={completed} label="Concluídas" />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Summary icon={ClipboardCheck} value={inProgress} label="Ações em andamento" />
        <Summary icon={AlertTriangle} value={overdue} label="Ações vencidas" alert />
        <Summary icon={FileCheck2} value={evidences.length} label="Evidências registradas" />
        <Summary icon={ShieldAlert} value={catCount} label="CAT no período" />
        <Summary icon={HeartPulse} value={absenceDays} label="Dias de afastamento" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Situação e pontos de atenção</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {overdue > 0 && (
            <Attention>{overdue} ação(ões) vencida(s) exigem atuação da empresa.</Attention>
          )}
          {actions.length > withEvidence && (
            <Attention>
              {actions.length - withEvidence} ação(ões) ainda não possuem evidência registrada.
            </Attention>
          )}
          {data.reports?.some((report: any) => report.status === "validated") && (
            <Attention>Relatório validado aguardando publicação ou entrega.</Attention>
          )}
          {!overdue && actions.length === withEvidence && (
            <p className="text-muted-foreground">
              Nenhum ponto crítico automático para os períodos selecionados.
            </p>
          )}
          {actions
            .filter(
              (action: any) =>
                action.status_at_period_close && action.status_at_period_close !== action.status,
            )
            .slice(0, 3)
            .map((action: any) => (
              <div key={action.id} className="rounded-lg border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <strong>{action.title}</strong>
                  <Badge variant="outline">Histórico longitudinal</Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Situação no encerramento: {action.status_at_period_close} · Status atual:{" "}
                  {action.status}
                  {action.completed_at ? ` · Concluída em ${formatDate(action.completed_at)}` : ""}
                </p>
              </div>
            ))}
        </CardContent>
      </Card>
    </div>
  );
}

function Metric({ value, label, alert }: { value: number; label: string; alert?: boolean }) {
  return (
    <div>
      <strong className={alert ? "text-destructive" : "text-xl"}>{value}</strong>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function Summary({
  icon: Icon,
  value,
  label,
  alert,
}: {
  icon: typeof AlertTriangle;
  value: number;
  label: string;
  alert?: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <Icon className={`mb-2 h-4 w-4 ${alert && value ? "text-destructive" : "text-primary"}`} />
        <strong className="text-2xl">{value}</strong>
        <p className="text-xs text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}

function Attention({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-amber-950">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      {children}
    </div>
  );
}
