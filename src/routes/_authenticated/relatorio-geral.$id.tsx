import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  CheckCircle2,
  FileDown,
  Link2,
  Loader2,
  Mail,
  MessageCircle,
  Paperclip,
  Sparkles,
  Trash2,
  Undo2,
  Wand2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ReportView } from "@/components/general-report/ReportView";
import { BlockEditDialog } from "@/components/general-report/BlockEditDialog";
import { IntroEditDialog } from "@/components/general-report/IntroEditDialog";
import { InstructionDialog } from "@/components/general-report/InstructionDialog";
import { EnviarEmailGeralDialog } from "@/components/general-report/EnviarEmailGeralDialog";
import { ShareLinkDialog } from "@/components/general-report/ShareLinkDialog";
import { EnviarWhatsappGeralDialog } from "@/components/general-report/EnviarWhatsappGeralDialog";
import { ListenReportButton } from "@/components/executive-report/ListenReportButton";
import { buildGeneralSpeechScript } from "@/lib/general-report-speech";
import { exportGeneralReportPdf } from "@/lib/general-report-pdf";
import {
  detectKind,
  KIND_LABEL,
  type GeneralFileKind,
  type GeneralReportContent,
  type ReportBlock,
} from "@/lib/general-report-lib";
import {
  generateGeneralReport,
  processGeneralReportFile,
  reviseGeneralReport,
  reviseGeneralReportBlock,
  reviseGeneralReportIntro,
  createGeneralReportBlock,
} from "@/lib/general-report.functions";

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
  const reviseAll = useServerFn(reviseGeneralReport);
  const reviseBlock = useServerFn(reviseGeneralReportBlock);
  const reviseIntro = useServerFn(reviseGeneralReportIntro);
  const createBlock = useServerFn(createGeneralReportBlock);
  const [queue, setQueue] = useState<string[]>([]); // nomes em envio (um a um)
  const [generating, setGenerating] = useState(false);
  const [instructions, setInstructions] = useState("");
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewBusy, setReviewBusy] = useState(false);
  const [previous, setPrevious] = useState<GeneralReportContent | null>(null);
  const [editing, setEditing] = useState<{ c: number; b: number } | null>(null);
  const [addAt, setAddAt] = useState<{ c: number; after: number } | null>(null);
  const [introEdit, setIntroEdit] = useState(false);
  const [askIntro, setAskIntro] = useState(false);
  const [askAt, setAskAt] = useState<{ c: number; b: number } | null>(null);
  const [emailOpen, setEmailOpen] = useState(false);
  const [whatsOpen, setWhatsOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);

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

  async function saveContent(next: GeneralReportContent) {
    const { error } = await db
      .from("general_reports")
      .update({ report: next, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return toast.error(error.message);
    refresh();
  }

  function mapBlocks(c: number, fn: (blocks: ReportBlock[]) => ReportBlock[]) {
    const cur = report?.report as GeneralReportContent;
    return {
      ...cur,
      chapters: cur.chapters
        .map((ch, i) => (i === c ? { ...ch, blocks: fn(ch.blocks) } : ch))
        .filter((ch) => ch.blocks.length),
    };
  }

  async function onReviewAll(text: string) {
    setReviewBusy(true);
    const before = report?.report as GeneralReportContent;
    try {
      const r = await reviseAll({ data: { reportId: id, instructions: text } });
      if (!r.ok) return toast.error(r.error);
      setPrevious(before);
      setReviewOpen(false);
      toast.success("Relatório revisado.");
    } catch (e: any) {
      toast.error(e?.message ?? "Falha na revisão.");
    } finally {
      setReviewBusy(false);
      refresh();
    }
  }

  async function onAskBlock(text: string) {
    if (!askAt) return;
    setReviewBusy(true);
    try {
      const r = await reviseBlock({
        data: { reportId: id, chapterIdx: askAt.c, blockIdx: askAt.b, instruction: text },
      });
      if (!r.ok) return toast.error(r.error);
      setAskAt(null);
      toast.success("Bloco atualizado.");
    } catch (e: any) {
      toast.error(e?.message ?? "Falha na revisão do bloco.");
    } finally {
      setReviewBusy(false);
      refresh();
    }
  }

  async function onCreateBlock(text: string) {
    if (!addAt) return;
    setReviewBusy(true);
    try {
      const r = await createBlock({
        data: { reportId: id, chapterIdx: addAt.c, afterIdx: addAt.after, instruction: text },
      });
      if (!r.ok) return toast.error(r.error);
      setAddAt(null);
      toast.success("Bloco criado.");
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao criar o bloco.");
    } finally {
      setReviewBusy(false);
      refresh();
    }
  }

  async function onAskIntro(text: string) {
    setReviewBusy(true);
    try {
      const r = await reviseIntro({ data: { reportId: id, instruction: text } });
      if (!r.ok) return toast.error(r.error);
      setAskIntro(false);
      toast.success("Introdução atualizada.");
    } catch (e: any) {
      toast.error(e?.message ?? "Falha na revisão da introdução.");
    } finally {
      setReviewBusy(false);
      refresh();
    }
  }

  async function onPdf() {
    const root = document.getElementById("general-report-article");
    if (!root) return;
    setPdfBusy(true);
    try {
      await exportGeneralReportPdf(
        root,
        `relatorio-geral-${(report?.representatives?.nome ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${report?.report_date ?? ""}`,
      );
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível gerar o PDF.");
    } finally {
      setPdfBusy(false);
    }
  }

  const speechScript = useMemo(
    () =>
      report?.report
        ? buildGeneralSpeechScript(report.report as GeneralReportContent, {
            representative: report.representatives?.nome ?? "",
            dateLabel: new Date(report.report_date + "T12:00:00").toLocaleDateString("pt-BR"),
          })
        : [],
    [report],
  );

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
              <>
                <ListenReportButton
                  script={speechScript}
                  fileName={`relatorio-geral-${(report?.representatives?.nome ?? "")
                    .normalize("NFD")
                    .replace(/[\u0300-\u036f]/g, "")
                    .toLowerCase()
                    .replace(/[^a-z0-9]+/g, "-")}-${report?.report_date ?? ""}`}
                />
                <Button variant="outline" onClick={() => setReviewOpen(true)}>
                  <Wand2 className="h-4 w-4 mr-1" />
                  Solicitar revisão
                </Button>
                <Button variant="outline" onClick={() => void onPdf()} disabled={pdfBusy}>
                  {pdfBusy ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <FileDown className="h-4 w-4 mr-1" />
                  )}
                  Gerar PDF
                </Button>
                <Button variant="outline" onClick={() => setEmailOpen(true)}>
                  <Mail className="h-4 w-4 mr-1" />
                  E-mail
                </Button>
                <Button variant="outline" onClick={() => setWhatsOpen(true)}>
                  <MessageCircle className="h-4 w-4 mr-1" />
                  WhatsApp
                </Button>
                <Button variant="outline" onClick={() => setLinkOpen(true)}>
                  <Link2 className="h-4 w-4 mr-1" />
                  Link público
                </Button>
              </>
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
        {previous && content && (
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              await saveContent(previous);
              setPrevious(null);
              toast.success("Revisão desfeita.");
            }}
          >
            <Undo2 className="h-4 w-4 mr-1" />
            Desfazer última revisão geral
          </Button>
        )}
        {content && (
          <ReportView
            report={content}
            actions={{
              onAdd: (c, after) => setAddAt({ c, after }),
              onEditIntro: () => setIntroEdit(true),
              onAskAiIntro: () => setAskIntro(true),
              onDeleteIntro: () => {
                if (!confirm("Remover subtítulo e resumo da introdução?")) return;
                void saveContent({ ...content, subtitle: undefined, executive_summary: "" });
              },
              onEdit: (c, b) => setEditing({ c, b }),
              onAskAi: (c, b) => setAskAt({ c, b }),
              onDelete: (c, b) => {
                if (!confirm("Excluir este bloco?")) return;
                void saveContent(mapBlocks(c, (bl) => bl.filter((_, i) => i !== b)));
              },
            }}
          />
        )}
        {content && report && (
          <>
            <BlockEditDialog
              open={!!editing}
              onOpenChange={(v) => !v && setEditing(null)}
              block={editing ? (content.chapters[editing.c]?.blocks[editing.b] ?? null) : null}
              onSave={(nb) => {
                if (!editing) return;
                void saveContent(
                  mapBlocks(editing.c, (bl) =>
                    bl.map((x, i) =>
                      i === editing.b ? { ...nb, locked: x.locked ?? ("editado" as const) } : x,
                    ),
                  ),
                );
                setEditing(null);
              }}
            />
            <InstructionDialog
              open={!!addAt}
              onOpenChange={(v) => !v && setAddAt(null)}
              title="Novo bloco"
              description="Explique o que você quer neste bloco. A IA escolhe o formato (texto, tópicos, indicadores, gráfico, tabela, imagem ou destaque) e usa o material enviado."
              placeholder="Ex.: gráfico de pizza com a participação de cada marca nas vendas; ou: tabela com os 5 maiores riscos e a ação sugerida."
              busy={reviewBusy}
              submitLabel="Criar bloco"
              busyLabel="A IA está criando…"
              onSubmit={(t) => void onCreateBlock(t)}
            />
            <IntroEditDialog
              open={introEdit}
              onOpenChange={setIntroEdit}
              intro={content}
              onSave={(i) => {
                void saveContent({ ...content, ...i, intro_locked: true });
                setIntroEdit(false);
              }}
            />
            <InstructionDialog
              open={askIntro}
              onOpenChange={setAskIntro}
              title="Pedir alteração da introdução"
              description="A IA altera somente o título, o subtítulo e o resumo."
              placeholder="Ex.: deixe o resumo mais curto e destaque a queda de faturamento."
              busy={reviewBusy}
              onSubmit={(t) => void onAskIntro(t)}
            />
            <InstructionDialog
              open={reviewOpen}
              onOpenChange={setReviewOpen}
              title="Solicitar revisão geral"
              description="A IA revisa o relatório inteiro seguindo suas orientações, sem sair do material enviado. Você poderá desfazer."
              placeholder="Ex.: deixe mais curto, destaque os riscos, inclua um capítulo de próximos passos e use mais gráficos."
              busy={reviewBusy}
              onSubmit={(t) => void onReviewAll(t)}
            />
            <InstructionDialog
              open={!!askAt}
              onOpenChange={(v) => !v && setAskAt(null)}
              title="Pedir alteração deste bloco"
              description="A IA altera somente este bloco, usando a fonte dele."
              placeholder="Ex.: mostre apenas os 5 maiores; troque para gráfico de pizza; resuma em 3 tópicos."
              busy={reviewBusy}
              onSubmit={(t) => void onAskBlock(t)}
            />
            <EnviarEmailGeralDialog
              open={emailOpen}
              onOpenChange={setEmailOpen}
              reportId={id}
              report={content}
              representative={report.representatives?.nome ?? ""}
              dateLabel={new Date(report.report_date + "T12:00:00").toLocaleDateString("pt-BR")}
            />
            <EnviarWhatsappGeralDialog
              open={whatsOpen}
              onOpenChange={setWhatsOpen}
              reportId={id}
              report={content}
              representative={report.representatives?.nome ?? ""}
              dateLabel={new Date(report.report_date + "T12:00:00").toLocaleDateString("pt-BR")}
            />
            <ShareLinkDialog reportId={id} open={linkOpen} onOpenChange={setLinkOpen} />
          </>
        )}
      </div>
    </div>
  );
}
