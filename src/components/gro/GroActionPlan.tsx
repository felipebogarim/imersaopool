/* eslint-disable @typescript-eslint/no-explicit-any, max-lines */
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Calendar, CheckCircle2, FileCheck2, Plus, User } from "lucide-react";
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
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { ACTION_COLUMNS, formatDate, isOverdue } from "@/lib/gro-nr1";

const db = supabase as any;

export function GroActionPlan({ context, periodId, data, isConsultant, periods }: any) {
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [filter, setFilter] = useState("all");
  const [form, setForm] = useState({
    title: "",
    description: "",
    riskId: "none",
    priority: "medium",
    owner: "",
    email: "",
    area: "",
    due: "",
  });
  const actions = useMemo(
    () =>
      data.actions.filter(
        (action: any) =>
          filter === "all" || (filter === "overdue" ? isOverdue(action) : action.status === filter),
      ),
    [data.actions, filter],
  );

  async function createAction() {
    if (!form.title || !periodId) return toast.error("Informe título e período de origem");
    const { error } = await db.from("gro_actions").insert({
      company_id: context.companyId,
      origin_period_id: periodId,
      title: form.title,
      description: form.description,
      risk_id: form.riskId === "none" ? null : form.riskId,
      priority: form.priority,
      owner_name: form.owner || null,
      owner_email: form.email || null,
      area: form.area || null,
      due_on: form.due || null,
      source: isConsultant ? "consultancy" : "company",
      technical_origin: isConsultant
        ? "Relatório técnico / inclusão da consultoria"
        : "Ação complementar da empresa",
    });
    if (error) return toast.error(error.message);
    setCreateOpen(false);
    setForm({
      title: "",
      description: "",
      riskId: "none",
      priority: "medium",
      owner: "",
      email: "",
      area: "",
      due: "",
    });
    await refresh();
    toast.success("Ação criada");
  }

  async function refresh() {
    await qc.invalidateQueries({ queryKey: ["gro-workspace"] });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as ações</SelectItem>
              <SelectItem value="todo">A fazer</SelectItem>
              <SelectItem value="in_progress">Em andamento</SelectItem>
              <SelectItem value="awaiting_evidence">Aguardando evidência</SelectItem>
              <SelectItem value="completed">Concluídas</SelectItem>
              <SelectItem value="overdue">Vencidas</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          {isConsultant ? "Criar ação" : "Adicionar ação própria"}
        </Button>
      </div>
      <Tabs defaultValue="kanban">
        <TabsList>
          <TabsTrigger value="kanban">Kanban</TabsTrigger>
          <TabsTrigger value="list">Lista</TabsTrigger>
          <TabsTrigger value="evidence">Evidências</TabsTrigger>
        </TabsList>
        <TabsContent value="kanban">
          <div className="flex snap-x gap-3 overflow-x-auto pb-2 xl:grid xl:grid-cols-4 xl:overflow-visible">
            {ACTION_COLUMNS.map(([status, label]) => (
              <div
                key={status}
                className="w-[82vw] max-w-sm shrink-0 snap-start rounded-xl bg-muted/50 p-3 xl:w-auto xl:max-w-none"
              >
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold">{label}</h3>
                  <Badge variant="secondary">
                    {actions.filter((action: any) => action.status === status).length}
                  </Badge>
                </div>
                <div className="space-y-3">
                  {actions
                    .filter((action: any) => action.status === status)
                    .map((action: any) => (
                      <ActionCard
                        key={action.id}
                        action={action}
                        period={periods.find(
                          (period: any) => period.id === action.origin_period_id,
                        )}
                        onClick={() => setSelected(action)}
                      />
                    ))}
                </div>
              </div>
            ))}
          </div>
        </TabsContent>
        <TabsContent value="list">
          <div className="space-y-2">
            {actions.map((action: any) => (
              <ActionCard
                key={action.id}
                action={action}
                period={periods.find((period: any) => period.id === action.origin_period_id)}
                onClick={() => setSelected(action)}
              />
            ))}
          </div>
        </TabsContent>
        <TabsContent value="evidence">
          <EvidenceList evidences={data.evidences} actions={data.actions} />
        </TabsContent>
      </Tabs>
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {isConsultant ? "Nova ação técnica" : "Nova ação complementar da empresa"}
            </DialogTitle>
          </DialogHeader>
          <Field label="Título">
            <Input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </Field>
          <Field label="Descrição / forma de execução">
            <Textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </Field>
          {isConsultant && (
            <Field label="Risco relacionado">
              <Select
                value={form.riskId}
                onValueChange={(value) => setForm({ ...form, riskId: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem vínculo</SelectItem>
                  {data.risks.map((risk: any) => (
                    <SelectItem key={risk.id} value={risk.id}>
                      {risk.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Responsável">
              <Input
                value={form.owner}
                onChange={(e) => setForm({ ...form, owner: e.target.value })}
              />
            </Field>
            <Field label="E-mail opcional">
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </Field>
            <Field label="Área">
              <Input
                value={form.area}
                onChange={(e) => setForm({ ...form, area: e.target.value })}
              />
            </Field>
            <Field label="Prazo">
              <Input
                type="date"
                value={form.due}
                onChange={(e) => setForm({ ...form, due: e.target.value })}
              />
            </Field>
          </div>
          <p className="text-xs text-muted-foreground">
            O e-mail é persistido para controle. Não há envio automático porque nenhuma
            infraestrutura de notificação GRO está configurada.
          </p>
          <DialogFooter>
            <Button onClick={createAction}>Criar ação</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ActionDetail
        action={selected}
        onClose={() => setSelected(null)}
        context={context}
        evidence={data.evidences.filter((item: any) => item.action_id === selected?.id)}
        isConsultant={isConsultant}
        refresh={refresh}
        period={periods.find((item: any) => item.id === selected?.origin_period_id)}
      />
    </div>
  );
}

function ActionCard({ action, period, onClick }: any) {
  const overdue = isOverdue(action);
  return (
    <button
      onClick={onClick}
      className="w-full rounded-lg border bg-card p-3 text-left shadow-sm transition hover:border-primary"
    >
      <div className="flex items-start justify-between gap-2">
        <strong className="line-clamp-2 text-sm">{action.title}</strong>
        {action.source === "company" && <Badge variant="outline">Própria</Badge>}
      </div>
      <Progress value={action.progress} className="my-3" />
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        {action.owner_name && (
          <span className="flex items-center gap-1">
            <User className="h-3 w-3" />
            {action.owner_name}
          </span>
        )}
        {action.due_on && (
          <span
            className={`flex items-center gap-1 ${overdue ? "font-medium text-destructive" : ""}`}
          >
            <Calendar className="h-3 w-3" />
            {formatDate(action.due_on)}
          </span>
        )}
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">Origem: {period?.name ?? "Período"}</p>
    </button>
  );
}

function ActionDetail({ action, onClose, context, evidence, isConsultant, refresh, period }: any) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState<any>(action ?? {});
  const [evidenceText, setEvidenceText] = useState("");
  const [comment, setComment] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [participant, setParticipant] = useState({ name: "", role: "", email: "" });
  const { data: details } = useQuery({
    queryKey: ["gro-action-details", action?.id],
    enabled: !!action,
    queryFn: async () => {
      const [participants, comments, history] = await Promise.all([
        db.from("gro_action_participants").select("*").eq("action_id", action.id),
        db.from("gro_action_comments").select("*").eq("action_id", action.id),
        db
          .from("gro_action_history")
          .select("*")
          .eq("action_id", action.id)
          .order("created_at", { ascending: false })
          .limit(10),
      ]);
      return {
        participants: participants.data ?? [],
        comments: comments.data ?? [],
        history: history.data ?? [],
      };
    },
  });
  useEffect(() => {
    setDraft(action ?? {});
  }, [action]);

  async function save() {
    const payload: any = {
      status: draft.status,
      progress: Number(draft.progress),
      owner_name: draft.owner_name || null,
      owner_email: draft.owner_email || null,
      area: draft.area || null,
      due_on: draft.due_on || null,
      completion_justification: draft.completion_justification || null,
      description: draft.description,
    };
    const { error } = await db.from("gro_actions").update(payload).eq("id", action.id);
    if (error) return toast.error(error.message);
    await refresh();
    onClose();
    toast.success("Ação atualizada");
  }
  async function addEvidence() {
    if (!evidenceText.trim() && !file) return toast.error("Inclua texto ou arquivo");
    let path = null;
    if (file) {
      path = `${context.companyId}/evidence/${action.id}/${crypto.randomUUID()}-${file.name}`;
      const up = await supabase.storage.from("gro-nr1").upload(path, file);
      if (up.error) return toast.error(up.error.message);
    }
    const { error } = await db.from("gro_evidences").insert({
      action_id: action.id,
      company_id: context.companyId,
      evidence_type: file
        ? file.type.startsWith("image/")
          ? "photo"
          : file.type === "application/pdf"
            ? "pdf"
            : "file"
        : "text",
      description: evidenceText || null,
      storage_path: path,
      file_name: file?.name ?? null,
    });
    if (error) return toast.error(error.message);
    setEvidenceText("");
    setFile(null);
    await refresh();
    toast.success("Evidência registrada");
  }
  async function addParticipant() {
    if (!participant.name) return;
    const { error } = await db.from("gro_action_participants").insert({
      action_id: action.id,
      company_id: context.companyId,
      name: participant.name,
      role_name: participant.role || null,
      email: participant.email || null,
    });
    if (error) return toast.error(error.message);
    setParticipant({ name: "", role: "", email: "" });
    toast.success("Participante adicionado");
  }
  async function addComment() {
    if (!comment.trim()) return;
    const { error } = await db.from("gro_action_comments").insert({
      action_id: action.id,
      company_id: context.companyId,
      body: comment.trim(),
    });
    if (error) return toast.error(error.message);
    setComment("");
    await qc.invalidateQueries({ queryKey: ["gro-action-details", action.id] });
  }
  return (
    <Dialog open={!!action} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{action?.title}</DialogTitle>
        </DialogHeader>
        {action && (
          <div className="space-y-5">
            <div className="rounded-lg bg-muted p-3 text-sm">
              <strong>Origem:</strong> {period?.name}
              <br />
              {action.status_at_period_close && (
                <>
                  <strong>Situação no encerramento:</strong> {action.status_at_period_close}
                  <br />
                </>
              )}
              <strong>Status atual:</strong> {action.status}
              {action.completed_at && <> · concluída em {formatDate(action.completed_at)}</>}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Status">
                <Select
                  value={draft.status ?? action.status}
                  onValueChange={(value) => setDraft({ ...draft, status: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ACTION_COLUMNS.map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Progresso (%)">
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={draft.progress ?? action.progress}
                  onChange={(e) => setDraft({ ...draft, progress: e.target.value })}
                />
              </Field>
              <Field label="Responsável">
                <Input
                  value={draft.owner_name ?? ""}
                  onChange={(e) => setDraft({ ...draft, owner_name: e.target.value })}
                />
              </Field>
              <Field label="E-mail">
                <Input
                  value={draft.owner_email ?? ""}
                  onChange={(e) => setDraft({ ...draft, owner_email: e.target.value })}
                />
              </Field>
              <Field label="Área">
                <Input
                  value={draft.area ?? ""}
                  onChange={(e) => setDraft({ ...draft, area: e.target.value })}
                />
              </Field>
              <Field label="Prazo">
                <Input
                  type="date"
                  value={draft.due_on ?? ""}
                  onChange={(e) => setDraft({ ...draft, due_on: e.target.value })}
                />
              </Field>
            </div>
            <Field label={isConsultant ? "Descrição técnica / execução" : "Forma de execução"}>
              <Textarea
                value={draft.description ?? ""}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              />
            </Field>
            <Field label="Justificativa para conclusão sem anexo">
              <Textarea
                value={draft.completion_justification ?? ""}
                onChange={(e) => setDraft({ ...draft, completion_justification: e.target.value })}
              />
            </Field>
            <Button onClick={save}>Salvar ação</Button>
            <section className="border-t pt-4">
              <h3 className="mb-3 font-semibold">Evidências ({evidence.length})</h3>
              {evidence.map((item: any) => (
                <div key={item.id} className="mb-2 rounded-lg border p-3 text-sm">
                  <div className="flex justify-between">
                    <span>{item.file_name ?? item.description}</span>
                    <Badge>{item.status}</Badge>
                  </div>
                </div>
              ))}
              <Textarea
                value={evidenceText}
                onChange={(e) => setEvidenceText(e.target.value)}
                placeholder="Descreva a evidência"
              />
              <Input
                className="mt-2"
                type="file"
                accept="application/pdf,image/*"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              <Button className="mt-2" variant="outline" onClick={addEvidence}>
                <FileCheck2 className="mr-2 h-4 w-4" />
                Anexar evidência
              </Button>
            </section>
            <section className="border-t pt-4">
              <h3 className="mb-3 font-semibold">Participantes</h3>
              <div className="grid gap-2 sm:grid-cols-3">
                <Input
                  placeholder="Nome"
                  value={participant.name}
                  onChange={(e) => setParticipant({ ...participant, name: e.target.value })}
                />
                <Input
                  placeholder="Função"
                  value={participant.role}
                  onChange={(e) => setParticipant({ ...participant, role: e.target.value })}
                />
                <Input
                  placeholder="E-mail opcional"
                  value={participant.email}
                  onChange={(e) => setParticipant({ ...participant, email: e.target.value })}
                />
              </div>
              <Button className="mt-2" size="sm" variant="outline" onClick={addParticipant}>
                Adicionar participante
              </Button>
              {details?.participants.map((item: any) => (
                <p key={item.id} className="mt-2 text-sm">
                  {item.name} · {item.role_name || "Função não informada"}
                </p>
              ))}
            </section>
            <section className="border-t pt-4">
              <h3 className="mb-3 font-semibold">Comentários</h3>
              {details?.comments.map((item: any) => (
                <p key={item.id} className="mb-2 rounded-lg bg-muted p-3 text-sm">
                  {item.body}
                </p>
              ))}
              <div className="flex gap-2">
                <Input
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                  placeholder="Registrar comentário"
                />
                <Button variant="outline" onClick={addComment}>
                  Comentar
                </Button>
              </div>
            </section>
            <section className="border-t pt-4">
              <h3 className="font-semibold">Histórico</h3>
              {details?.history.map((item: any) => (
                <p key={item.id} className="mt-2 text-xs text-muted-foreground">
                  {formatDate(item.created_at)} · {item.event_type}
                </p>
              ))}
            </section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function EvidenceList({ evidences, actions }: any) {
  return (
    <div className="space-y-2">
      {evidences.map((item: any) => (
        <Card key={item.id}>
          <CardContent className="flex items-center justify-between gap-3 p-4">
            <div>
              <strong className="text-sm">
                {actions.find((action: any) => action.id === item.action_id)?.title}
              </strong>
              <p className="text-xs text-muted-foreground">
                {item.file_name ?? item.description ?? "Evidência"} · {formatDate(item.occurred_on)}
              </p>
            </div>
            <Badge>{item.status}</Badge>
          </CardContent>
        </Card>
      ))}
      {!evidences.length && (
        <p className="text-sm text-muted-foreground">Nenhuma evidência registrada.</p>
      )}
    </div>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
