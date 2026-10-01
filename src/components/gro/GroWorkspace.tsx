/* eslint-disable @typescript-eslint/no-explicit-any, max-lines */
import { useCallback, useState } from "react";
import {
  ArrowLeft,
  Building2,
  Check,
  Circle,
  Loader2,
  Plus,
  Settings,
  ShieldCheck,
  Users,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GroActionPlan } from "@/components/gro/GroActionPlan";
import { GroCulture } from "@/components/gro/GroCulture";
import { GroDocuments } from "@/components/gro/GroDocuments";
import { GroFieldReports } from "@/components/gro/GroFieldReports";
import { GroFinalReport } from "@/components/gro/GroFinalReport";
import { GroPanorama } from "@/components/gro/GroPanorama";
import { GroPeriodSelector, type GroPeriod } from "@/components/gro/GroPeriodSelector";
import { GroQuestionnaires } from "@/components/gro/GroQuestionnaires";
import { useGroContext } from "@/hooks/useGroContext";
import { useGroWorkspaceData } from "@/hooks/useGroWorkspaceData";
import { supabase } from "@/integrations/supabase/client";
import { CONSULTANCY_STEPS, GRO_SECTIONS, setPreferredGroExperience } from "@/lib/gro-nr1";

const db = supabase as any;

export function GroWorkspace({ section }: { section: string }) {
  const qc = useQueryClient();
  const { data: context, isLoading: contextLoading, error: contextError } = useGroContext();
  const [selectedPeriods, setSelectedPeriods] = useState<string[]>([]);
  const [periodOpen, setPeriodOpen] = useState(false);
  const {
    data: periods = [],
    isLoading: periodsLoading,
    error: periodsError,
  } = useQuery<GroPeriod[]>({
    queryKey: ["gro-periods", context?.companyId],
    enabled: !!context?.companyId,
    queryFn: async () => {
      const { data, error } = await db
        .from("gro_periods")
        .select("*")
        .eq("company_id", context!.companyId)
        .order("starts_on", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  const workspace = useGroWorkspaceData(context?.companyId ?? undefined, selectedPeriods);
  const onPeriodChange = useCallback((ids: string[]) => setSelectedPeriods(ids), []);

  if (contextLoading || periodsLoading) return <Loading />;
  if (contextError || periodsError) return <SetupError error={contextError ?? periodsError} />;
  if (!context) return null;
  const allowed = [
    ...(context.isConsultant ? GRO_SECTIONS.consultant : GRO_SECTIONS.company),
    ...(context.canManageCompany ? GRO_SECTIONS.administration : []),
  ];
  if (!allowed.some(([key]) => key === section)) return <Restricted />;
  const isAdministration = GRO_SECTIONS.administration.some(([key]) => key === section);
  const selected = periods.filter((period) => selectedPeriods.includes(period.id));
  const primaryPeriod = selected.length === 1 ? selected[0] : undefined;

  return (
    <div className="min-h-screen bg-slate-50/70 pb-16">
      <header className="border-b bg-background px-4 py-4 sm:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              <h1 className="truncate text-xl font-bold">{context.companyName}</h1>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>
                {primaryPeriod
                  ? `Período atual: ${primaryPeriod.name}`
                  : selectedPeriods.length > 1
                    ? `${selectedPeriods.length} períodos selecionados`
                    : "Período não selecionado"}
              </span>
              <span>·</span>
              <span>{context.isConsultant ? "Consultoria" : "Empresa"}</span>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            {context.hasConsultantContext && (
              <Button
                variant="ghost"
                onClick={() => {
                  setPreferredGroExperience("consultancy");
                  window.location.assign("/gro/carteira");
                }}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar para Carteira
              </Button>
            )}
            <GroPeriodSelector
              periods={periods}
              value={selectedPeriods}
              onChange={onPeriodChange}
            />
            {context.isConsultant && (
              <Button variant="outline" onClick={() => setPeriodOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Novo período
              </Button>
            )}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl p-4 sm:p-8">
        {isAdministration ? (
          <CompanyAdministrationArea section={section} context={context} />
        ) : !periods.length ? (
          <NoPeriods canCreate={context.isConsultant} onCreate={() => setPeriodOpen(true)} />
        ) : !selectedPeriods.length ? (
          <Loading />
        ) : workspace.isLoading ? (
          <Loading />
        ) : workspace.error ? (
          <SetupError error={workspace.error} />
        ) : workspace.data ? (
          <>
            <SectionTitle section={section} comparative={selectedPeriods.length > 1} />
            {section === "panorama" && (
              <>
                <GroPanorama data={workspace.data} periods={selected} />
                {context.isConsultant && primaryPeriod && (
                  <StepEditor
                    context={context}
                    period={primaryPeriod}
                    steps={workspace.data.steps}
                  />
                )}
              </>
            )}
            {section === "documentos" && (
              <GroDocuments
                context={context}
                periodId={primaryPeriod?.id}
                data={workspace.data}
                isConsultant={context.isConsultant}
              />
            )}
            {section === "questionarios" && (
              <GroQuestionnaires
                context={context}
                periodId={primaryPeriod?.id}
                data={workspace.data}
              />
            )}
            {section === "relatorio-final" && (
              <GroFinalReport
                context={context}
                periodId={primaryPeriod?.id}
                period={primaryPeriod}
                data={workspace.data}
                isConsultant={context.isConsultant}
              />
            )}
            {section === "plano-de-acao" && (
              <GroActionPlan
                context={context}
                periodId={primaryPeriod?.id}
                periods={periods}
                data={workspace.data}
                isConsultant={context.isConsultant}
              />
            )}
            {section === "nossa-cultura" && (
              <GroCulture
                context={context}
                periodId={primaryPeriod?.id}
                data={workspace.data}
                isConsultant={context.isConsultant}
              />
            )}
            {section === "reportes-de-campo" && (
              <GroFieldReports
                context={context}
                periodId={primaryPeriod?.id}
                reports={workspace.data.fieldReports}
              />
            )}
          </>
        ) : null}
      </main>
      <PeriodDialog
        open={periodOpen}
        onOpenChange={setPeriodOpen}
        context={context}
        onCreated={async (id: string) => {
          await qc.invalidateQueries({ queryKey: ["gro-periods"] });
          setSelectedPeriods([id]);
        }}
      />
    </div>
  );
}

function PeriodDialog({ open, onOpenChange, context, onCreated }: any) {
  const year = new Date().getFullYear();
  const [form, setForm] = useState({
    name: `Período ${year}`,
    start: `${year}-01-01`,
    end: `${year}-12-31`,
    status: "active",
  });
  const [saving, setSaving] = useState(false);
  async function create() {
    setSaving(true);
    const { data, error } = await db
      .from("gro_periods")
      .insert({
        company_id: context.companyId,
        name: form.name,
        starts_on: form.start,
        ends_on: form.end,
        status: form.status,
        consultant_id: context.userId,
      })
      .select("id")
      .single();
    if (error) {
      setSaving(false);
      return toast.error(error.message);
    }
    const steps = CONSULTANCY_STEPS.map(([step_key, label], position) => ({
      company_id: context.companyId,
      period_id: data.id,
      step_key,
      label,
      position,
    }));
    const stepResult = await db.from("gro_consultancy_steps").insert(steps);
    setSaving(false);
    if (stepResult.error) return toast.error(stepResult.error.message);
    onOpenChange(false);
    await onCreated(data.id);
    toast.success("Período criado");
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo Período de Avaliação</DialogTitle>
        </DialogHeader>
        <div>
          <Label>Nome</Label>
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Início</Label>
            <Input
              type="date"
              value={form.start}
              onChange={(e) => setForm({ ...form, start: e.target.value })}
            />
          </div>
          <div>
            <Label>Fim</Label>
            <Input
              type="date"
              value={form.end}
              onChange={(e) => setForm({ ...form, end: e.target.value })}
            />
          </div>
        </div>
        <div>
          <Label>Situação</Label>
          <Select
            value={form.status}
            onValueChange={(value) => setForm({ ...form, status: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="planned">Programado</SelectItem>
              <SelectItem value="active">Atual</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button disabled={saving} onClick={create}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Criar período
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StepEditor({ context, period, steps }: any) {
  const qc = useQueryClient();
  const list = steps.length ? [...steps].sort((a: any, b: any) => a.position - b.position) : [];
  async function toggle(step: any) {
    const completed = step.completed_at ? null : new Date().toISOString();
    const { error } = await db
      .from("gro_consultancy_steps")
      .update({ completed_at: completed, completed_by: completed ? context.userId : null })
      .eq("id", step.id);
    if (error) return toast.error(error.message);
    await qc.invalidateQueries({ queryKey: ["gro-workspace"] });
  }
  async function closePeriod() {
    const { error } = await db.rpc("gro_close_period", { _period_id: period.id });
    if (error) return toast.error(error.message);
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["gro-periods"] }),
      qc.invalidateQueries({ queryKey: ["gro-workspace"] }),
    ]);
    toast.success("Período encerrado com snapshot das ações");
  }
  return (
    <Card className="mt-5">
      <CardHeader>
        <CardTitle className="text-base">Controle da entrega técnica</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {list.map((step: any) => (
          <button
            key={step.id}
            onClick={() => toggle(step)}
            className="flex w-full items-center gap-2 rounded-md border p-3 text-left text-sm hover:bg-muted"
          >
            {step.completed_at ? (
              <Check className="h-4 w-4 text-teal-600" />
            ) : (
              <Circle className="h-4 w-4 text-muted-foreground" />
            )}
            {step.label}
          </button>
        ))}
        {period.status !== "closed" && (
          <Button variant="outline" className="mt-3" onClick={closePeriod}>
            Encerrar período e registrar snapshot
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function SectionTitle({ section, comparative }: { section: string; comparative: boolean }) {
  const all = [...GRO_SECTIONS.consultant, ...GRO_SECTIONS.administration];
  const label = all.find(([key]) => key === section)?.[1] ?? section;
  return (
    <div className="mb-5">
      <div className="flex items-center gap-2">
        <h2 className="text-xl font-bold">{label}</h2>
        {comparative && <Badge variant="outline">Comparativo</Badge>}
      </div>
    </div>
  );
}

function CompanyAdministrationArea({ section, context }: any) {
  const users = section === "usuarios-permissoes";
  const Icon = users ? Users : Settings;
  return (
    <>
      <SectionTitle section={section} comparative={false} />
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Icon className="h-5 w-5 text-primary" />
              {users ? "Acessos da empresa" : "Preferências do workspace"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {users
                ? "Área reservada aos administradores para organizar usuários e permissões da empresa."
                : "Configurações do ambiente da empresa e do contexto de Período."}
            </p>
            <div className="mt-4 rounded-lg border border-dashed p-4 text-sm">
              {context.companyName} · acesso administrativo confirmado pelo RBAC.
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Estado inicial</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Nenhuma alteração administrativa pendente neste workspace.
          </CardContent>
        </Card>
      </div>
    </>
  );
}
function Loading() {
  return (
    <div className="flex min-h-64 items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
    </div>
  );
}
function NoPeriods({ canCreate, onCreate }: { canCreate: boolean; onCreate: () => void }) {
  return (
    <Card>
      <CardContent className="p-10 text-center">
        <ShieldCheck className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
        <h2 className="font-semibold">Nenhum período cadastrado</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Crie o primeiro Período de Avaliação para iniciar o fluxo.
        </p>
        {canCreate && (
          <Button className="mt-4" onClick={onCreate}>
            Criar período
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
function SetupError({ error }: { error: any }) {
  return (
    <div className="m-4 rounded-xl border border-destructive/30 bg-destructive/5 p-6 sm:m-8">
      <h2 className="font-semibold text-destructive">Não foi possível carregar o GRO NR1</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        {error instanceof Error
          ? error.message
          : "Verifique se a migration GRO NR1 foi aplicada no Supabase."}
      </p>
    </div>
  );
}
function Restricted() {
  return (
    <div className="grid min-h-[60vh] place-items-center p-6 text-center">
      <div>
        <ShieldCheck className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
        <h2 className="text-xl font-semibold">Conteúdo restrito à consultoria</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Questionários individuais, reportes de campo e rascunhos técnicos não estão disponíveis
          para o perfil empresa.
        </p>
      </div>
    </div>
  );
}
