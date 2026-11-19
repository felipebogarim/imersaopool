import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { AlertTriangle, CheckCircle2, FileJson, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ImportedReportView } from "@/components/general-report/ImportedReportView";
import {
  looksLikePdf,
  parseImportJson,
  periodText,
  sha256Hex,
  type ImportedReport,
  type ImportIssue,
} from "@/lib/general-report-import";

const BUCKET = "general-reports";
const MAX_JSON = 5 * 1024 * 1024;
const MAX_PDF = 50 * 1024 * 1024;
const db = supabase as any;

const BLOCK_LABEL: Record<string, string> = {
  intro: "Introdução",
  overall_result: "Resultado geral",
  monthly_by_state: "Média mensal por estado",
  loss_concentration: "Concentração das perdas",
  top10_growth: "Top 10 crescimentos",
  top6_comparison: "Top 6 · Comparativo",
  top6_reasons: "Top 6 · Motivos",
};

export function ImportReportDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [jsonFile, setJsonFile] = useState<File | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [data, setData] = useState<ImportedReport | null>(null);
  const [jsonIssues, setJsonIssues] = useState<ImportIssue[]>([]);
  const [pdfIssue, setPdfIssue] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function reset() {
    setJsonFile(null);
    setPdfFile(null);
    setData(null);
    setJsonIssues([]);
    setPdfIssue(null);
  }

  async function pickJson(file: File | null) {
    setJsonFile(file);
    setData(null);
    setJsonIssues([]);
    if (!file) return;
    if (file.size > MAX_JSON)
      return setJsonIssues([{ path: file.name, message: "o JSON passa de 5 MB" }]);
    const r = parseImportJson(await file.text());
    if (r.ok) setData(r.data);
    else setJsonIssues(r.issues);
  }

  async function pickPdf(file: File | null) {
    setPdfFile(file);
    setPdfIssue(null);
    if (!file) return;
    if (file.size > MAX_PDF) return setPdfIssue("o PDF passa de 50 MB");
    const head = new Uint8Array(await file.slice(0, 5).arrayBuffer());
    if (!looksLikePdf(head)) setPdfIssue("o arquivo não é um PDF válido");
  }

  const ready = !!data && !!jsonFile && !!pdfFile && !pdfIssue && !jsonIssues.length;

  async function save() {
    if (!ready || !data || !pdfFile) return;
    setSaving(true);
    let id: string | null = null;
    let path: string | null = null;
    try {
      const sha = await sha256Hex(await pdfFile.arrayBuffer());
      const { data: row, error } = await db
        .from("general_reports")
        .insert({
          report_date: new Date().toISOString().slice(0, 10),
          title: data.title,
          status: "pronto",
          source: "importado",
          import_data: data,
          import_pdf_name: pdfFile.name,
          import_pdf_sha256: sha,
          generated_at: new Date().toISOString(),
        })
        .select("id")
        .single();
      if (error) throw error;
      id = row.id as string;
      path = `${id}/original-${Date.now()}-${pdfFile.name.replace(/[^\w.-]/g, "_")}`;
      const up = await supabase.storage
        .from(BUCKET)
        .upload(path, pdfFile, { contentType: "application/pdf" });
      if (up.error) throw up.error;
      const { error: e2 } = await db
        .from("general_reports")
        .update({ import_pdf_path: path })
        .eq("id", id);
      if (e2) throw e2;
      toast.success("Relatório importado.");
      void qc.invalidateQueries({ queryKey: ["general-reports"] });
      onOpenChange(false);
      reset();
      void navigate({ to: "/relatorio-geral/$id", params: { id } });
    } catch (e: any) {
      // Não deixa um relatório incompleto salvo.
      if (path) await supabase.storage.from(BUCKET).remove([path]);
      if (id) await db.from("general_reports").delete().eq("id", id);
      toast.error(
        `Não foi possível salvar${e?.message ? `: ${e.message}` : ""}. Nada foi gravado.`,
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!saving) onOpenChange(v);
        if (!v && !saving) reset();
      }}
    >
      <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar relatório pronto</DialogTitle>
          <DialogDescription>
            Anexe o JSON (alimenta os gráficos e quadros) e o PDF do mesmo relatório. Nada é
            recalculado nem lido do PDF: a PoolFlux só valida, formata e exibe.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5">
              <FileJson className="h-4 w-4" /> 1. Arquivo JSON *
            </Label>
            <input
              type="file"
              accept=".json,application/json"
              onChange={(e) => void pickJson(e.target.files?.[0] ?? null)}
              className="block w-full text-sm file:mr-3 file:rounded-md file:border file:border-border file:bg-muted file:px-3 file:py-1.5"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5">
              <FileText className="h-4 w-4" /> 2. Arquivo PDF *
            </Label>
            <input
              type="file"
              accept=".pdf,application/pdf"
              onChange={(e) => void pickPdf(e.target.files?.[0] ?? null)}
              className="block w-full text-sm file:mr-3 file:rounded-md file:border file:border-border file:bg-muted file:px-3 file:py-1.5"
            />
          </div>
        </div>

        {(jsonIssues.length > 0 || pdfIssue) && (
          <div
            className="rounded-lg border border-destructive/50 bg-destructive/5 p-3 text-sm space-y-1"
            role="alert"
          >
            <div className="flex items-center gap-1.5 font-semibold">
              <AlertTriangle className="h-4 w-4" /> Corrija antes de salvar (troque o anexo acima)
            </div>
            <ul className="list-disc pl-5 space-y-0.5">
              {jsonIssues.slice(0, 30).map((i, k) => (
                <li key={k}>
                  <strong>{jsonFile?.name ?? "JSON"}</strong> · <code>{i.path}</code>: {i.message}
                </li>
              ))}
              {jsonIssues.length > 30 && <li>… e mais {jsonIssues.length - 30} problema(s).</li>}
              {pdfIssue && (
                <li>
                  <strong>{pdfFile?.name ?? "PDF"}</strong>: {pdfIssue}
                </li>
              )}
            </ul>
          </div>
        )}

        {!pdfFile && data && (
          <p className="text-sm text-amber-600">Falta anexar o PDF para poder salvar.</p>
        )}
        {!data && !jsonIssues.length && jsonFile === null && (
          <p className="text-sm text-muted-foreground">
            Ordem: anexar → validar → pré-visualizar → salvar.
          </p>
        )}

        {data && (
          <div className="space-y-3">
            <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm space-y-1">
              <div className="flex items-center gap-1.5 font-semibold text-emerald-600">
                <CheckCircle2 className="h-4 w-4" /> JSON válido — pré-visualização
              </div>
              <div>
                <strong>{data.title}</strong>
              </div>
              <div className="text-muted-foreground">
                {data.representative_name}
                {data.company ? ` · ${data.company}` : ""} · {periodText(data.period)}
              </div>
              <div className="text-muted-foreground">
                Blocos, na ordem:{" "}
                {data.blocks.map((b) => BLOCK_LABEL[b.type] ?? b.type).join(" → ")}
              </div>
            </div>
            <div className="max-h-[55vh] overflow-y-auto rounded-xl border border-border p-4">
              <ImportedReportView report={data} />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" disabled={saving} onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => void save()} disabled={!ready || saving}>
            {saving && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
            Salvar como novo relatório
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
