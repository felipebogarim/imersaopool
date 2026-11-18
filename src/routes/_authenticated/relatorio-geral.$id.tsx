import { createFileRoute, Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Paperclip,
  Printer,
  Sparkles,
  Trash2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ReportView } from "@/components/general-report/ReportView";
import {
  detectKind,
  KIND_LABEL,
  type GeneralFileKind,
  type GeneralReportContent,
} from "@/lib/general-report-lib";
import { generateGeneralReport, processGeneralReportFile } from "@/lib/general-report.functions";

export const Route = createFileRoute("/_authenticated/relatorio-geral/$id")({
  head: () => ({ meta: [{ title: "Relatório Geral | PoolFlux" }] }),
  component: RelatorioGeralDetail,
});

const BUCKET = "general-reports";
const MAX_BYTES = 50 * 1024 * 1024;
const db = supabase as any;

function RelatorioGeralDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const processFile = useServerFn(processGeneralReportFile);
  const generate = useServerFn(generateGeneralReport);
  const [queue, setQueue] = useState<string[]>([]); // nomes em envio (um a um)
  const [generating, setGenerating] = useState(false);
  const [instructions, setInstructions] = useState("");

  const { data: report } = useQuery({
    queryKey: ["general-report", id],
    queryFn: async () => {
      const { data, error } = await db
        .from("general_reports")
        .select("id, title, report_date, status, report, error_message, representatives(nome)")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });
  const { data: files = [] } = useQuery({
    queryKey: ["general-report-files", id],
    refetchInterval: (q) =>
      (q.state.data as any[] | undefined)?.some((f) => f.status === "processando") ? 3000 : false,
    queryFn: async () => {
      const { data, error } = await db
        .from("general_report_files")
        .select("id, file_name, kind, size_bytes, status, error_message, storage_path")
        .eq("report_id", id)
        .order("created_at");
      if (error) throw error;
      return data as any[];
    },
  });
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["general-report-files", id] });
    void qc.invalidateQueries({ queryKey: ["general-report", id] });
  };

  /** Envia e lê os arquivos UM A UM, para o usuário ver cada um ficar pronto. */
  async function onPick(list: FileList | null) {
    if (!list?.length) return;
    const picked = Array.from(list);
    setQueue(picked.map((f) => f.name));
    for (const file of picked) {
      try {
        if (file.size > MAX_BYTES) throw new Error("maior que 50 MB");
        const kind = detectKind(file.name, file.type);
        const path = `${id}/${Date.now()}-${file.name.replace(/[^\w.-]/g, "_")}`;
        const up = await supabase.storage
          .from(BUCKET)
          .upload(path, file, { contentType: file.type || undefined });
        if (up.error) throw up.error;
        const { data: row, error } = await db
          .from("general_report_files")
          .insert({
            report_id: id,
            storage_path: path,
            file_name: file.name,
            mime_type: file.type,
            size_bytes: file.size,
            kind,
          })
          .select("id")
          .single();
        if (error) throw error;
        refresh();
        const r = await processFile({ data: { fileId: row.id } });
        if (!r.ok) toast.error(`${file.name}: ${r.error}`);
      } catch (e: any) {
        toast.error(`${file.name}: ${e?.message ?? "falha no envio"}`);
      } finally {
        setQueue((q) => q.filter((n) => n !== file.name));
        refresh();
      }
    }
    if (inputRef.current) inputRef.current.value = "";
  }

  async function removeFile(f: any) {
    await supabase.storage.from(BUCKET).remove([f.storage_path]);
    const { error } = await db.from("general_report_files").delete().eq("id", f.id);
    if (error) return toast.error(error.message);
    refresh();
  }

  async function onGenerate() {
    setGenerating(true);
    try {
      const r = await generate({ data: { reportId: id, instructions } });
      if (!r.ok) toast.error(r.error);
      else toast.success("Relatório gerado.");
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao gerar o relatório.");
    } finally {
      setGenerating(false);
      refresh();
    }
  }

  const readyCount = files.filter((f) => f.status === "lido").length;
  const busy = queue.length > 0 || files.some((f) => f.status === "processando");
  const content = report?.report as GeneralReportContent | null;

  return (
    <div>
      <PageHeader
        title={report?.title || "Relatório Geral"}
        subtitle={
          report
            ? `${report.representatives?.nome ?? "—"} · ${new Date(report.report_date + "T12:00:00").toLocaleDateString("pt-BR")}`
            : undefined
        }
        actions={
          <>
            {content && (
              <Button variant="outline" onClick={() => window.print()}>
                <Printer className="h-4 w-4 mr-1" />
                Imprimir / PDF
              </Button>
            )}
            <Button variant="outline" asChild>
              <Link to="/relatorio-geral">
                <ArrowLeft className="h-4 w-4 mr-1" />
                Relatórios
              </Link>
            </Button>
          </>
        }
      />
      <div className="px-4 sm:px-8 py-6 space-y-6 max-w-5xl">
        <section className="rounded-2xl border border-border bg-card p-4 space-y-3 print:hidden">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h3 className="font-semibold">Arquivos</h3>
              <p className="text-xs text-muted-foreground">
                Planilhas, textos, imagens, áudios, vídeos, PDFs e apresentações. Até 50 MB cada; a
                IA lê até 20 MB por arquivo.
              </p>
            </div>
            <Button onClick={() => inputRef.current?.click()}>
              <Paperclip className="h-4 w-4 mr-1" />
              Anexar arquivos
            </Button>
            <input
              ref={inputRef}
              type="file"
              multiple
              hidden
              onChange={(e) => void onPick(e.target.files)}
            />
          </div>
          <ul className="space-y-1.5">
            {files.map((f) => (
              <li
                key={f.id}
                className="flex items-center gap-3 rounded-lg bg-muted/40 px-3 py-2 text-sm"
              >
                {f.status === "lido" ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                ) : f.status === "erro" ? (
                  <XCircle className="h-4 w-4 text-destructive shrink-0" />
                ) : (
                  <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                )}
                <span className="truncate flex-1">{f.file_name}</span>
                <span className="text-xs text-muted-foreground">
                  {KIND_LABEL[f.kind as GeneralFileKind] ?? "Arquivo"}
                </span>
                <span className="text-xs text-muted-foreground w-28 text-right">
                  {f.status === "lido"
                    ? "Lido"
                    : f.status === "erro"
                      ? "Erro"
                      : f.status === "processando"
                        ? "Lendo…"
                        : "Enviado"}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeFile(f)}
                  aria-label="Remover"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
                {f.status === "erro" && f.error_message && (
                  <span className="sr-only">{f.error_message}</span>
                )}
              </li>
            ))}
            {files.some((f) => f.status === "erro") && (
              <li className="text-xs text-destructive px-1">
                {files
                  .filter((f) => f.status === "erro")
                  .map((f) => `${f.file_name}: ${f.error_message}`)
                  .join(" · ")}
              </li>
            )}
          </ul>
          <Textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder="Instruções opcionais para a IA (ex.: foque em exposição de produto e metas do semestre)"
            rows={2}
          />
          <Button onClick={onGenerate} disabled={generating || busy || readyCount === 0}>
            {generating ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4 mr-1" />
            )}
            {content ? "Gerar novamente" : "Gerar relatório"} ({readyCount} arquivo
            {readyCount === 1 ? "" : "s"} lido{readyCount === 1 ? "" : "s"})
          </Button>
          {report?.status === "erro" && report.error_message && (
            <p className="text-sm text-destructive">{report.error_message}</p>
          )}
        </section>

        {generating && (
          <p className="text-sm text-muted-foreground">
            A IA está analisando todo o material… isso pode levar alguns minutos.
          </p>
        )}
        {content && <ReportView report={content} />}
      </div>
    </div>
  );
}
