/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from "react";
import { FileText, Loader2, Upload } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
import { DOCUMENT_CATEGORIES, PRACTICE_TOPICS } from "@/lib/gro-nr1";

const db = supabase as any;
const STATUS_LABELS: Record<string, string> = {
  received: "Recebido",
  processing: "Processando",
  analyzed: "Analisado",
  reviewed: "Revisado",
};

export function GroDocuments({ context, periodId, data, isConsultant }: any) {
  const qc = useQueryClient();
  const [category, setCategory] = useState("administrative");
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [aggregate, setAggregate] = useState("");
  const [days, setDays] = useState("");
  const [saving, setSaving] = useState(false);

  async function uploadDocument() {
    if (!periodId || !title.trim()) return toast.error("Informe o período e o título");
    setSaving(true);
    try {
      let storagePath: string | null = null;
      if (file) {
        storagePath = `${context.companyId}/documents/${periodId}/${crypto.randomUUID()}-${file.name}`;
        const { error } = await supabase.storage.from("gro-nr1").upload(storagePath, file);
        if (error) throw error;
      }
      const { error } = await db.from("gro_documents").insert({
        company_id: context.companyId,
        period_id: periodId,
        category,
        title: title.trim(),
        storage_path: storagePath,
        file_name: file?.name ?? null,
        mime_type: file?.type ?? null,
        aggregate_count: aggregate ? Number(aggregate) : null,
        absence_days: days ? Number(days) : null,
      });
      if (error) throw error;
      setTitle("");
      setFile(null);
      setAggregate("");
      setDays("");
      await qc.invalidateQueries({ queryKey: ["gro-workspace"] });
      toast.success("Documento registrado");
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(id: string, status: string) {
    const { error } = await db.from("gro_documents").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    await qc.invalidateQueries({ queryKey: ["gro-workspace"] });
  }

  return (
    <div className="space-y-5">
      {isConsultant && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Entrada técnica de documentos</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <div>
              <Label>Categoria</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(DOCUMENT_CATEGORIES).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Título</Label>
              <Input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Nome do documento"
              />
            </div>
            <div>
              <Label>Arquivo</Label>
              <Input
                type="file"
                accept=".pdf,image/*,.doc,.docx"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              />
            </div>
            <div className="flex items-end">
              <Button className="w-full" disabled={saving} onClick={uploadDocument}>
                {saving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="mr-2 h-4 w-4" />
                )}{" "}
                Registrar
              </Button>
            </div>
            {(category === "cat" || category === "medical_certificates") && (
              <div>
                <Label>Quantidade agregada</Label>
                <Input
                  type="number"
                  min="0"
                  value={aggregate}
                  onChange={(event) => setAggregate(event.target.value)}
                />
              </div>
            )}
            {category === "medical_certificates" && (
              <div>
                <Label>Dias de afastamento</Label>
                <Input
                  type="number"
                  min="0"
                  value={days}
                  onChange={(event) => setDays(event.target.value)}
                />
              </div>
            )}
            <p className="text-xs text-muted-foreground md:col-span-2 lg:col-span-4">
              Registre apenas dados agregados de atestados no ambiente visível ao cliente. O sistema
              não executa análise por IA sem infraestrutura real configurada.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {Object.entries(DOCUMENT_CATEGORIES).map(([key, label]) => {
          const docs = data.documents.filter((doc: any) => doc.category === key);
          return (
            <Card key={key}>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileText className="h-4 w-4 text-primary" />
                  {label}
                  <Badge variant="secondary">{docs.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {docs.map((doc: any) => (
                  <div
                    key={doc.id}
                    className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{doc.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {doc.file_name ?? "Registro sem anexo"}
                        {doc.aggregate_count != null ? ` · ${doc.aggregate_count} registro(s)` : ""}
                        {doc.absence_days != null ? ` · ${doc.absence_days} dia(s)` : ""}
                      </p>
                    </div>
                    {isConsultant ? (
                      <Select
                        value={doc.status}
                        onValueChange={(value) => updateStatus(doc.id, value)}
                      >
                        <SelectTrigger className="w-full sm:w-36">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(STATUS_LABELS).map(([value, text]) => (
                            <SelectItem key={value} value={value}>
                              {text}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge>{STATUS_LABELS[doc.status]}</Badge>
                    )}
                  </div>
                ))}
                {!docs.length && (
                  <p className="text-sm text-muted-foreground">Nenhum documento nesta categoria.</p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <GoodPractices context={context} periodId={periodId} practices={data.practices} />
    </div>
  );
}

function GoodPractices({ context, periodId, practices }: any) {
  const qc = useQueryClient();
  const [drafts, setDrafts] = useState<Record<string, { applies: boolean; details: string }>>({});
  const current = (topic: string) =>
    drafts[topic] ??
    practices.find((item: any) => item.topic === topic) ?? { applies: false, details: "" };

  async function save(topic: string) {
    if (!periodId) return;
    const value = current(topic);
    const { error } = await db.from("gro_good_practices").upsert(
      {
        company_id: context.companyId,
        period_id: periodId,
        topic,
        applies: value.applies,
        details: value.details,
      },
      { onConflict: "period_id,topic" },
    );
    if (error) return toast.error(error.message);
    await qc.invalidateQueries({ queryKey: ["gro-workspace"] });
    toast.success("Prática atualizada");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Boas práticas que a empresa já realiza</CardTitle>
        <p className="text-sm text-muted-foreground">
          Checklist da liderança; não é questionário psicossocial de colaboradores.
        </p>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-2">
        {PRACTICE_TOPICS.map((topic) => {
          const value = current(topic);
          return (
            <div key={topic} className="rounded-lg border p-3">
              <label className="flex items-center gap-2 text-sm font-medium">
                <Checkbox
                  checked={value.applies}
                  onCheckedChange={(checked) =>
                    setDrafts((old) => ({
                      ...old,
                      [topic]: { ...value, applies: checked === true },
                    }))
                  }
                />
                {topic}
              </label>
              <Textarea
                className="mt-2 min-h-16"
                value={value.details ?? ""}
                onChange={(event) =>
                  setDrafts((old) => ({
                    ...old,
                    [topic]: { ...value, details: event.target.value },
                  }))
                }
                placeholder="Como funciona hoje?"
              />
              <Button size="sm" variant="outline" className="mt-2" onClick={() => save(topic)}>
                Salvar
              </Button>
            </div>
          );
        })}
        <p className="text-xs text-muted-foreground md:col-span-2">
          Áudio/transcrição está preparado no modelo de dados, mas não é apresentado como envio
          automático porque não há pipeline de transcrição GRO configurado.
        </p>
      </CardContent>
    </Card>
  );
}
