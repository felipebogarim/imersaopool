/* eslint-disable @typescript-eslint/no-explicit-any, max-lines */
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Clipboard, FileUp, Link2, Printer, QrCode, Users } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";

const db = supabase as any;

export function GroQuestionnaires({ context, periodId, data }: any) {
  const qc = useQueryClient();
  const [templateOpen, setTemplateOpen] = useState(false);
  const [questionnaireOpen, setQuestionnaireOpen] = useState(false);
  const [manualFor, setManualFor] = useState<any>(null);
  const [template, setTemplate] = useState({
    name: "",
    version: "1.0",
    description: "",
    parameters: "{}",
  });
  const [form, setForm] = useState({
    name: "",
    templateId: "",
    eligible: "",
    invitations: "",
    exclusions: "0",
    modes: ["link", "qr", "print", "manual", "physical_upload"],
  });
  const [answers, setAnswers] = useState("{}");
  const { data: templates = [] } = useQuery({
    queryKey: ["gro-questionnaire-templates"],
    queryFn: async () => {
      const { data: rows, error } = await db
        .from("gro_questionnaire_templates")
        .select("*")
        .order("name");
      if (error) throw error;
      return rows ?? [];
    },
  });

  async function createTemplate() {
    try {
      const parameters = JSON.parse(template.parameters || "{}");
      const { error } = await db.from("gro_questionnaire_templates").insert({
        ...template,
        parameters,
        question_count: 0,
        questions: [],
        technical_parameters_ready: false,
      });
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["gro-questionnaire-templates"] });
      setTemplateOpen(false);
      toast.success("Estrutura de modelo criada sem fabricar perguntas");
    } catch (error: any) {
      toast.error(error.message);
    }
  }

  async function createQuestionnaire() {
    if (!periodId || !form.name || !form.templateId) return toast.error("Preencha nome e modelo");
    const { error } = await db.from("gro_questionnaires").insert({
      company_id: context.companyId,
      period_id: periodId,
      template_id: form.templateId,
      name: form.name,
      eligible_total: Number(form.eligible || 0),
      invitations_total: Number(form.invitations || 0),
      exclusions_total: Number(form.exclusions || 0),
      application_modes: form.modes,
      status: "ready",
    });
    if (error) return toast.error(error.message);
    await qc.invalidateQueries({ queryKey: ["gro-workspace"] });
    setQuestionnaireOpen(false);
    toast.success("Questionário configurado");
  }

  async function changeStatus(id: string, status: string) {
    const { error } = await db.from("gro_questionnaires").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    await qc.invalidateQueries({ queryKey: ["gro-workspace"] });
  }

  async function registerManual() {
    try {
      const parsed = JSON.parse(answers);
      const { error } = await db.from("gro_questionnaire_responses").insert({
        questionnaire_id: manualFor.id,
        company_id: context.companyId,
        source: "manual",
        answers: parsed,
        reviewed_by: context.userId,
      });
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["gro-workspace"] });
      setManualFor(null);
      setAnswers("{}");
      toast.success("Resposta física lançada e revisada");
    } catch (error: any) {
      toast.error(error.message);
    }
  }

  async function uploadPhysical(questionnaire: any, file?: File) {
    if (!file) return;
    const path = `${context.companyId}/questionnaires/${questionnaire.id}/${crypto.randomUUID()}-${file.name}`;
    const { error: uploadError } = await supabase.storage.from("gro-nr1").upload(path, file);
    if (uploadError) return toast.error(uploadError.message);
    const { error } = await db.from("gro_questionnaire_responses").insert({
      questionnaire_id: questionnaire.id,
      company_id: context.companyId,
      source: "physical_upload",
      answers: {},
      physical_storage_path: path,
      extraction_status: "pending",
    });
    if (error) return toast.error(error.message);
    await qc.invalidateQueries({ queryKey: ["gro-workspace"] });
    toast.success("Questionário físico recebido; revisão humana pendente");
  }

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
        <strong>Parâmetros técnicos aguardam importação.</strong> A plataforma não inventa
        perguntas, fórmulas ou matriz de severidade. Cadastre versões e importe a metodologia
        oficial antes da consolidação.
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => setTemplateOpen(true)}>
          Novo template
        </Button>
        <Button onClick={() => setQuestionnaireOpen(true)}>Configurar aplicação</Button>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {data.questionnaires.map((item: any) => {
          const responses = data.responses.filter(
            (response: any) => response.questionnaire_id === item.id,
          ).length;
          const denominator = Math.max(item.eligible_total - item.exclusions_total, 0);
          const participation = denominator ? Math.round((responses / denominator) * 100) : 0;
          const url =
            typeof window === "undefined" ? "" : `${window.location.origin}/q/${item.public_token}`;
          return (
            <Card key={item.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-base">{item.name}</CardTitle>
                    <p className="mt-1 text-xs text-muted-foreground">
                      População elegível e respostas são contagens distintas.
                    </p>
                  </div>
                  <Select
                    value={item.status}
                    onValueChange={(value) => changeStatus(item.id, value)}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {["draft", "ready", "open", "closed", "consolidated"].map((value) => (
                        <SelectItem key={value} value={value}>
                          {value}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-4 gap-2">
                  <Stat value={item.eligible_total} label="Elegíveis" />
                  <Stat value={item.invitations_total} label="Disponibilizados" />
                  <Stat value={responses} label="Respondentes" />
                  <Stat value={`${participation}%`} label="Participação" />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      navigator.clipboard
                        .writeText(url)
                        .then(() =>
                          toast.success("Link copiado para envio, inclusive por WhatsApp"),
                        )
                    }
                  >
                    <Link2 className="mr-1 h-4 w-4" />
                    Link
                  </Button>
                  <QrButton url={url} name={item.name} />
                  <Button size="sm" variant="outline" onClick={() => window.print()}>
                    <Printer className="mr-1 h-4 w-4" />
                    Impressão
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setManualFor(item)}>
                    <Clipboard className="mr-1 h-4 w-4" />
                    Lançamento manual
                  </Button>
                  <label className="inline-flex cursor-pointer items-center rounded-md border px-3 text-xs font-medium hover:bg-muted">
                    <FileUp className="mr-1 h-4 w-4" />
                    Upload físico
                    <input
                      className="hidden"
                      type="file"
                      accept="application/pdf,image/*"
                      onChange={(event) => uploadPhysical(item, event.target.files?.[0])}
                    />
                  </label>
                </div>
                <p className="text-xs text-muted-foreground">
                  Exclusões justificadas: {item.exclusions_total} · Não respondentes:{" "}
                  {Math.max(denominator - responses, 0)}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>
      {!data.questionnaires.length && <Empty />}

      <Dialog open={templateOpen} onOpenChange={setTemplateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo template técnico</DialogTitle>
          </DialogHeader>
          <Field label="Nome">
            <Input
              value={template.name}
              onChange={(e) => setTemplate({ ...template, name: e.target.value })}
            />
          </Field>
          <Field label="Versão">
            <Input
              value={template.version}
              onChange={(e) => setTemplate({ ...template, version: e.target.value })}
            />
          </Field>
          <Field label="Descrição">
            <Textarea
              value={template.description}
              onChange={(e) => setTemplate({ ...template, description: e.target.value })}
            />
          </Field>
          <Field label="Parâmetros (JSON)">
            <Textarea
              value={template.parameters}
              onChange={(e) => setTemplate({ ...template, parameters: e.target.value })}
            />
          </Field>
          <DialogFooter>
            <Button onClick={createTemplate}>Salvar estrutura</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={questionnaireOpen} onOpenChange={setQuestionnaireOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configurar questionário</DialogTitle>
          </DialogHeader>
          <Field label="Nome">
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="Template">
            <Select
              value={form.templateId}
              onValueChange={(value) => setForm({ ...form, templateId: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {templates.map((item: any) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name} · v{item.version}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <div className="grid grid-cols-3 gap-2">
            <Field label="Elegíveis">
              <Input
                type="number"
                value={form.eligible}
                onChange={(e) => setForm({ ...form, eligible: e.target.value })}
              />
            </Field>
            <Field label="Disponibilizados">
              <Input
                type="number"
                value={form.invitations}
                onChange={(e) => setForm({ ...form, invitations: e.target.value })}
              />
            </Field>
            <Field label="Exclusões">
              <Input
                type="number"
                value={form.exclusions}
                onChange={(e) => setForm({ ...form, exclusions: e.target.value })}
              />
            </Field>
          </div>
          <p className="text-xs text-muted-foreground">
            Modalidades habilitadas: link, QR Code, impressão, lançamento manual e upload físico.
          </p>
          <DialogFooter>
            <Button onClick={createQuestionnaire}>Criar aplicação</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={!!manualFor} onOpenChange={(open) => !open && setManualFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Lançamento manual revisado</DialogTitle>
          </DialogHeader>
          <Field label="Respostas estruturadas (JSON)">
            <Textarea
              className="min-h-48 font-mono text-xs"
              value={answers}
              onChange={(e) => setAnswers(e.target.value)}
            />
          </Field>
          <p className="text-xs text-muted-foreground">
            A extração automática nunca é validada sem revisão do consultor.
          </p>
          <DialogFooter>
            <Button onClick={registerManual}>Registrar respostas</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Stat({ value, label }: { value: string | number; label: string }) {
  return (
    <div>
      <strong>{value}</strong>
      <p className="text-[10px] text-muted-foreground">{label}</p>
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
function Empty() {
  return (
    <Card>
      <CardContent className="flex flex-col items-center p-10 text-center">
        <Users className="mb-3 h-8 w-8 text-muted-foreground" />
        <p className="font-medium">Nenhum questionário neste período</p>
        <p className="text-sm text-muted-foreground">Configure um template oficial para iniciar.</p>
      </CardContent>
    </Card>
  );
}

function QrButton({ url, name }: { url: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [src, setSrc] = useState("");
  useEffect(() => {
    if (open && url) void QRCode.toDataURL(url, { width: 320, margin: 2 }).then(setSrc);
  }, [open, url]);
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <QrCode className="mr-1 h-4 w-4" />
        QR Code
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{name}</DialogTitle>
          </DialogHeader>
          {src && <img src={src} alt={`QR Code para ${name}`} className="mx-auto w-64" />}
          <p className="break-all text-xs text-muted-foreground">{url}</p>
        </DialogContent>
      </Dialog>
    </>
  );
}
