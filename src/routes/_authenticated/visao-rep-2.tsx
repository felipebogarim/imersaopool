import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/EmptyState";
import { cn } from "@/lib/utils";
import { extractFileText } from "@/lib/sintese-file-text";
import { gerarVisaoRep2 } from "@/lib/visao-rep2.functions";
import { contentHash, parseVisaoRepMarkdown, toVisaoRepMarkdown } from "@/lib/visao-rep2-markdown";
import {
  CLASSIFICATION_LABEL,
  CONFIDENCE_LABEL,
  EVIDENCE_LABEL,
  VISAO_REP_SCHEMA_VERSION,
  normalizeVisaoRep2,
  validateVisaoRep2,
  isExecutiveBriefV1,

  type LineClassification,
  type VisaoRep2,
} from "@/lib/visao-rep2-schema";
import { LeituraIntegradaV2 } from "@/components/visao-rep2/LeituraIntegradaV2";
import { ExecutiveBriefV2 } from "@/components/visao-rep2/ExecutiveBriefV2";
import { briefingParaRepresentante } from "@/components/visao-rep2/briefing-fabio";

import { buildPerfResumo, fmtPct, type PerfRowLite, type UploadLite } from "@/lib/visao-rep";
import { exportVisaoRep2Pdf } from "@/lib/visao-rep2-pdf";
import {
  AlertTriangle,
  ChevronDown,
  Eraser,
  FileDown,
  FileText,
  FileUp,
  Link2,
  Loader2,
  Shield,
  Sparkles,
  Trash2,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/visao-rep-2")({
  head: () => ({
    meta: [
      { title: "Visão Rep 2 — PoolFlux" },
      {
        name: "description",
        content:
          "Visão Rep 2: leitura executiva do representante em modelo canônico, gerada por IA ou importada a partir de um relatório final pronto.",
      },
      { property: "og:title", content: "Visão Rep 2 — PoolFlux" },
      { property: "og:description", content: "Relatórios executivos por representante: geração por IA ou importação fiel do relatório pronto." },
    ],
  }),
  component: VisaoRep2Page,
});

type Row = {
  id: string;
  representative_id: string | null;
  representative_name: string;
  region: string | null;
  creation_mode: "ai_generated" | "imported_ready";
  schema_version: string;
  source_file_name: string | null;
  content_hash: string | null;
  created_at: string;
  updated_at: string;
  data: unknown;
};

const MODE_LABEL = { ai_generated: "Gerado com IA", imported_ready: "Relatório pronto" } as const;

const has = (v: unknown) => typeof v === "string" && v.trim().length > 0;

function Card({ title, children, className }: { title?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-xl border bg-card p-4 sm:p-5", className)}>
      {title ? <h3 className="mb-3 text-sm font-semibold tracking-tight">{title}</h3> : null}
      {children}
    </section>
  );
}

function Field({ label, value }: { label: string; value: unknown }) {
  if (!has(value)) return null;
  return (
    <div className="space-y-0.5">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <p className="whitespace-pre-wrap text-sm leading-relaxed">{String(value)}</p>
    </div>
  );
}

function Collapse({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-lg border">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm font-medium"
      >
        <span>{title}</span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform", open && "rotate-180")} />
      </button>
      {open ? <div className="border-t px-3 py-3">{children}</div> : null}
    </div>
  );
}

const LAST_KEY = "vr2:last-report-id";

function VisaoRep2Page() {
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string>("");
  const [repId, setRepId] = useState<string>("");
  const [draft, setDraft] = useState<VisaoRep2 | null>(null);
  const [draftFile, setDraftFile] = useState<string | null>(null);
  const [draftHash, setDraftHash] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const gerar = useServerFn(gerarVisaoRep2);

  const { data: reps = [] } = useQuery({
    queryKey: ["vr2-reps"],
    queryFn: async () => (await supabase.from("representatives").select("id, nome, regiao").order("nome")).data ?? [],
  });

  const { data: reports = [] } = useQuery({
    queryKey: ["vr2-reports"],
    queryFn: async () =>
      ((
        await supabase
          .from("visao_rep_reports")
          .select("id, representative_id, representative_name, region, creation_mode, schema_version, source_file_name, content_hash, created_at, updated_at, data")
          .order("created_at", { ascending: false })
      ).data ?? []) as unknown as Row[],
  });

  const selected = useMemo(() => reports.find(r => r.id === selectedId) ?? null, [reports, selectedId]);
  const visao = useMemo(() => (selected ? normalizeVisaoRep2(selected.data) : null), [selected]);

  // ---- Performance vinculada ----
  const { data: uploads = [] } = useQuery({
    queryKey: ["vr2-uploads"],
    queryFn: async () =>
      ((
        await supabase
          .from("rep_performance_uploads")
          .select("id, representative_id, periodo_label, atingimento_geral, familias, familia_atingimento_categoria, created_at")
          .is("substituida_em", null)
          .order("created_at", { ascending: false })
      ).data ?? []) as unknown as UploadLite[],
  });
  const upload = useMemo(
    () => uploads.find(u => u.representative_id === selected?.representative_id) ?? null,
    [uploads, selected],
  );
  const { data: perfRows = [] } = useQuery({
    queryKey: ["vr2-rows", upload?.id],
    enabled: !!upload?.id,
    queryFn: async () =>
      ((
        await supabase
          .from("rep_performance_rows")
          .select("categoria, metas_status, total_pct, total_pct_status")
          .eq("upload_id", upload!.id)
      ).data ?? []) as unknown as PerfRowLite[],
  });
  const perf = useMemo(() => buildPerfResumo({ upload, rows: perfRows, todosUploads: uploads }), [upload, perfRows, uploads]);

  // Ao voltar à página, reabre o mesmo relatório salvo (último aberto ou o mais recente).
  useEffect(() => {
    if (selectedId || !reports.length) return;
    const lembrado = typeof window !== "undefined" ? window.localStorage.getItem(LAST_KEY) : null;
    setSelectedId(reports.find(r => r.id === lembrado)?.id ?? reports[0].id);
  }, [reports, selectedId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (selectedId) window.localStorage.setItem(LAST_KEY, selectedId);
  }, [selectedId]);

  // Selecionar um representante já abre o relatório salvo dele, sem gerar de novo.
  useEffect(() => {
    if (!repId) return;
    const doRep = reports.find(r => r.representative_id === repId);
    if (doRep) setSelectedId(doRep.id);
  }, [repId, reports]);



  // ---- Ações ----
  const salvar = useMutation({
    mutationFn: async (v: VisaoRep2) => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id ?? null;
      const now = new Date().toISOString();
      const imported = v.metadata.creation_mode === "imported_ready";
      const payload: VisaoRep2 = {
        ...v,
        metadata: { ...v.metadata, created_by: uid, created_at: now, updated_at: now, source_file_name: draftFile },
        source_control: {
          ...v.source_control,
          creation_mode: v.metadata.creation_mode,
          source_file: draftFile,
          schema_version: VISAO_REP_SCHEMA_VERSION,
          import_date: imported ? now : null,
          imported_by: imported ? uid : null,
          last_update: now,
          content_hash: draftHash,
        },
      };
      const { data, error } = await supabase
        .from("visao_rep_reports")
        .insert({
          representative_id: v.metadata.representative_id,
          representative_name: v.metadata.representative_name ?? "Sem representante",
          region: v.metadata.region,
          creation_mode: v.metadata.creation_mode,
          schema_version: VISAO_REP_SCHEMA_VERSION,
          titulo: v.executive_view.central_thesis?.slice(0, 120) ?? null,
          data: payload as never,
          source_file_name: draftFile,
          content_hash: draftHash,
          created_by: uid,
          imported_by: imported ? uid : null,
          import_date: imported ? now : null,
        })
        .select("id")
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: id => {
      toast.success("Visão Rep 2 salva.");
      setDraft(null);
      setDraftFile(null);
      setDraftHash(null);
      qc.invalidateQueries({ queryKey: ["vr2-reports"] });
      setSelectedId(id);
    },
    onError: (e: any) => toast.error(e?.message ?? "Não foi possível salvar."),
  });

  const excluir = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("visao_rep_reports").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Relatório excluído.");
      setSelectedId("");
      qc.invalidateQueries({ queryKey: ["vr2-reports"] });
    },
  });

  const limparTodos = useMutation({
    mutationFn: async () => {
      const { data: dirs } = await supabase.storage.from("visao-rep-2").list();
      const dirsToClean = (dirs ?? []).filter(d => d.name.includes("/") || !d.id).map(d => d.name);
      for (const dir of dirsToClean) {
        const { data: files } = await supabase.storage.from("visao-rep-2").list(dir);
        const paths = (files ?? []).map(f => `${dir}/${f.name}`);
        if (paths.length) await supabase.storage.from("visao-rep-2").remove(paths);
      }
      const { error } = await supabase.from("visao_rep_reports").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Todos os dados de Visão Rep 2 foram limpos.");
      setSelectedId("");
      setDraft(null);
      setDraftFile(null);
      setDraftHash(null);
      if (typeof window !== "undefined") window.localStorage.removeItem(LAST_KEY);
      qc.invalidateQueries({ queryKey: ["vr2-reports"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Não foi possível limpar os dados."),
  });

  async function onLimparTudo() {
    if (!reports.length) return toast.info("Não há relatórios salvos para limpar.");
    if (!window.confirm("Tem certeza que deseja limpar TODOS os relatórios de Visão Rep 2? Esta ação não pode ser desfeita.")) return;
    await limparTodos.mutateAsync();
  }

  /** Gera e salva de uma vez: o relatório do representante fica fixo na página. */
  async function gerarESalvar(repIdAlvo: string) {
    const v = await gerar({ data: { representativeId: repIdAlvo } });
    setDraftFile(null);
    setDraftHash(null);
    await salvar.mutateAsync(normalizeVisaoRep2(v));
  }

  async function onGerarIA() {
    if (!repId) return toast.error("Selecione um representante.");
    const existente = reports.find(r => r.representative_id === repId && r.creation_mode === "ai_generated");
    if (existente) {
      setSelectedId(existente.id);
      toast.info("Este representante já tem uma Visão Rep salva. Use “Regerar com IA” para substituí-la.");
      return;
    }
    setBusy(true);
    try {
      await gerarESalvar(repId);
      toast.success("Visão Rep gerada e salva. Ela ficará fixa nesta página.");
    } catch (e: any) {
      toast.error(e?.message ?? "Falha na geração.");
    } finally {
      setBusy(false);
    }
  }

  /** Substitui o relatório salvo por uma nova geração (ação explícita do usuário). */
  async function onRegerar(row: Row) {
    if (!row.representative_id) return toast.error("Relatório sem representante vinculado.");
    if (!window.confirm(`Regerar a Visão Rep de ${row.representative_name}? O relatório atual será substituído.`)) return;
    setBusy(true);
    try {
      const { error } = await supabase.from("visao_rep_reports").delete().eq("id", row.id);
      if (error) throw error;
      await gerarESalvar(row.representative_id);
      toast.success("Visão Rep regerada e salva.");
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao regerar.");
    } finally {
      setBusy(false);
    }
  }


  async function onImportar(file: File) {
    setBusy(true);
    try {
      const texto = await extractFileText(file);
      const parsed = parseVisaoRepMarkdown(texto);
      const rep = reps.find((r: any) => (parsed.metadata.representative_name ?? "").toLowerCase().includes(String(r.nome).toLowerCase()));
      parsed.metadata.representative_id = rep?.id ?? null;
      if (!parsed.metadata.region && rep?.regiao) parsed.metadata.region = rep.regiao;
      setDraft(normalizeVisaoRep2(parsed));
      setDraftFile(file.name);
      setDraftHash(await contentHash(texto));
      toast.success("Relatório lido. Confira a prévia antes de confirmar.");
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível ler o arquivo.");
    } finally {
      setBusy(false);
    }
  }

  function exportar(v: VisaoRep2, nome: string) {
    const blob = new Blob([toVisaoRepMarkdown(v)], { type: "text/markdown;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `visao-rep-${nome.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.md`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const validacao = draft ? validateVisaoRep2(draft) : null;

  return (
    <div>
      <PageHeader
        title="Visão Rep 2"
        subtitle="Leitura executiva do representante em modelo canônico. Gere com IA ou importe o relatório final pronto — os dois modos alimentam a mesma estrutura."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Modo 1 */}
        <Card title="Gerar com IA">
          <p className="mb-3 text-sm text-muted-foreground">
            O sistema lê a entrevista já processada do representante e organiza o conteúdo no modelo canônico. Nada é inventado: campos sem base ficam vazios.
            O relatório é salvo automaticamente e fica fixo — ao voltar nesta página você verá sempre o mesmo conteúdo, até regerar manualmente.
          </p>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Select value={repId} onValueChange={setRepId}>
              <SelectTrigger className="sm:w-72">
                <SelectValue placeholder="Selecione o representante" />
              </SelectTrigger>
              <SelectContent>
                {reps.map((r: any) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={onGerarIA} disabled={busy}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              Gerar Visão Rep
            </Button>
          </div>
        </Card>

        {/* Modo 2 */}
        <Card title="Importar Visão Rep pronta">
          <p className="mb-3 text-sm text-muted-foreground">
            Envie o relatório final já estruturado. O sistema apenas lerá, validará e distribuirá os campos. Nenhum conteúdo será reescrito ou reinterpretado.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <input
              id="vr2-file"
              type="file"
              accept=".md,.markdown,.txt,.docx"
              className="hidden"
              onChange={e => {
                const f = e.target.files?.[0];
                e.currentTarget.value = "";
                if (f) void onImportar(f);
              }}
            />
            <Button variant="secondary" disabled={busy} onClick={() => document.getElementById("vr2-file")?.click()}>
              <FileUp className="mr-2 h-4 w-4" />
              Enviar relatório pronto
            </Button>
            <span className="text-xs text-muted-foreground">.md (preferencial), .txt ou .docx</span>
          </div>
        </Card>
      </div>

      <div className="mt-4 flex justify-end">
        <Button
          variant="destructive"
          size="sm"
          disabled={limparTodos.isPending || !reports.length}
          onClick={onLimparTudo}
        >
          {limparTodos.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Eraser className="mr-2 h-4 w-4" />
          )}
          Limpar dados
        </Button>
      </div>

      {/* Prévia da importação/geração */}
      {draft && validacao ? (
        <Card className="mt-4 border-primary/40" title="Prévia antes de salvar">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Badge variant="secondary">Modo de origem: {MODE_LABEL[draft.metadata.creation_mode]}</Badge>
            {draftFile ? <Badge variant="outline">{draftFile}</Badge> : null}
          </div>
          {draft.metadata.creation_mode === "imported_ready" ? (
            <p className="mb-3 rounded-md border bg-muted/40 p-3 text-sm">
              O conteúdo será importado exatamente como enviado. Nenhuma interpretação adicional será realizada.
            </p>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1">
              <Label className="text-xs">Representante</Label>
              <Input
                value={draft.metadata.representative_name ?? ""}
                onChange={e => setDraft({ ...draft, metadata: { ...draft.metadata, representative_name: e.target.value } })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Região</Label>
              <Input
                value={draft.metadata.region ?? ""}
                onChange={e => setDraft({ ...draft, metadata: { ...draft.metadata, region: e.target.value } })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Data da entrevista</Label>
              <Input
                value={draft.metadata.interview_date ?? ""}
                onChange={e => setDraft({ ...draft, metadata: { ...draft.metadata, interview_date: e.target.value } })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Vincular ao cadastro</Label>
              <Select
                value={draft.metadata.representative_id ?? ""}
                onValueChange={v => setDraft({ ...draft, metadata: { ...draft.metadata, representative_id: v } })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Representante" />
                </SelectTrigger>
                <SelectContent>
                  {reps.map((r: any) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mt-4">
            {validacao.missingRequired.length ? (
              <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-3 text-sm">
                <div className="mb-1 flex items-center gap-1.5 font-semibold text-destructive">
                  <AlertTriangle className="h-4 w-4" /> Corrija antes de importar
                </div>
                <ul className="space-y-1 text-destructive">
                  {validacao.missingRequired.map(r => (
                    <li key={r}>• Informe “{r}” no relatório e envie o arquivo novamente.</li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
                Arquivo validado e pronto para importação.
              </p>
            )}
          </div>


          <div className="mt-4">
            <Collapse title="Prévia do conteúdo" defaultOpen>
              <VisaoRep2View visao={draft} perf={null} />
            </Collapse>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              onClick={() => salvar.mutate(draft)}
              disabled={salvar.isPending || validacao.missingRequired.length > 0}
            >
              {salvar.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Confirmar importação
            </Button>
            <Button variant="secondary" onClick={() => exportVisaoRep2Pdf(normalizeVisaoRep2(draft), null)}>
              <FileText className="mr-2 h-4 w-4" />
              Exportar PDF
            </Button>
            <Button variant="secondary" onClick={() => exportar(normalizeVisaoRep2(draft), draft.metadata.representative_name ?? "relatorio")}>
              <FileDown className="mr-2 h-4 w-4" />
              Exportar relatório estruturado
            </Button>
            <Button variant="ghost" onClick={() => { setDraft(null); setDraftFile(null); setDraftHash(null); }}>
              Cancelar
            </Button>

          </div>
        </Card>
      ) : null}

      {/* Lista */}
      <Card className="mt-4" title="Relatórios salvos">
        {!reports.length ? (
          <EmptyState title="Nenhuma Visão Rep 2 ainda" description="Gere com IA ou importe um relatório pronto para começar." />
        ) : (
          <div className="space-y-2">
            {reports.map(r => (
              <div
                key={r.id}
                className={cn(
                  "flex flex-wrap items-center gap-2 rounded-lg border p-3",
                  selectedId === r.id && "border-primary/60 bg-muted/30",
                )}
              >
                <button className="flex-1 text-left" onClick={() => setSelectedId(selectedId === r.id ? "" : r.id)}>
                  <div className="text-sm font-medium">{r.representative_name}</div>
                  <div className="text-xs text-muted-foreground">
                    {r.region ? `${r.region} · ` : ""}
                    {new Date(r.created_at).toLocaleDateString("pt-BR")}
                    {r.source_file_name ? ` · ${r.source_file_name}` : ""}
                  </div>
                </button>
                <Badge variant={r.creation_mode === "imported_ready" ? "outline" : "secondary"}>{MODE_LABEL[r.creation_mode]}</Badge>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => exportVisaoRep2Pdf(normalizeVisaoRep2(r.data), selectedId === r.id ? perf : null)}
                  title="Exportar PDF visual"
                >
                  <FileText className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => exportar(normalizeVisaoRep2(r.data), r.representative_name)}
                  title="Exportar relatório estruturado (.md)"
                >
                  <FileDown className="h-4 w-4" />
                </Button>
                {r.creation_mode === "ai_generated" && r.representative_id ? (
                  <Button size="sm" variant="ghost" disabled={busy} onClick={() => void onRegerar(r)} title="Regerar com IA (substitui o salvo)">
                    <Sparkles className="h-4 w-4" />
                  </Button>
                ) : null}
                <Button size="sm" variant="ghost" onClick={() => excluir.mutate(r.id)} title="Excluir">

                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Detalhe */}
      {visao && selected ? (
        <div className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">Modo de origem: {MODE_LABEL[selected.creation_mode]}</Badge>
            <Badge variant="outline">{selected.schema_version}</Badge>
            {selected.content_hash ? (
              <Badge variant="outline" className="font-mono text-[10px]">
                hash {selected.content_hash.slice(0, 12)}
              </Badge>
            ) : null}
            <Button size="sm" onClick={() => exportVisaoRep2Pdf(visao, perf)}>
              <FileText className="mr-2 h-4 w-4" />
              Exportar PDF
            </Button>
            <Button size="sm" variant="secondary" onClick={() => exportar(visao, selected.representative_name)}>
              <FileDown className="mr-2 h-4 w-4" />
              Exportar relatório estruturado
            </Button>
          </div>
          <VisaoRep2View visao={visao} perf={perf} />
        </div>
      ) : null}
    </div>
  );
}

// ============================ Visualização ============================

function VisaoRep2View({
  visao,
  perf,
}: {
  visao: VisaoRep2;
  perf: ReturnType<typeof buildPerfResumo> | null;
}) {
  const [filtroLinha, setFiltroLinha] = useState<LineClassification | "todas">("todas");
  const ev = visao.executive_view;
  const ctx = visao.representative_context;
  const cv = visao.comparative_view;

  const linhas = visao.product_line_views.filter(l => filtroLinha === "todas" || l.classification === filtroLinha);

  const clientesPrincipais = visao.strategic_clients.slice(0, 5);
  const temContexto = ctx.represented_brands.length > 0 || has(ctx.region_summary) || has(ctx.service_model);
  const brief = briefingParaRepresentante(visao.metadata.representative_name);
  const briefV1 = isExecutiveBriefV1(visao);


  return (
    <div className="space-y-4">
      {brief ? (
        <ExecutiveBriefV2
          brief={brief}
          nome={visao.metadata.representative_name ?? "Representante"}
          regiao={visao.metadata.region}
          dataEntrevista={visao.metadata.interview_date}
          dataRelatorio={
            visao.metadata.updated_at ? new Date(visao.metadata.updated_at).toLocaleDateString("pt-BR") : null
          }
        />
      ) : (
        <>
      {/* Contexto e carteira estratégica */}
      {temContexto || clientesPrincipais.length ? (

        <Card title="Contexto e carteira estratégica">
          <div className="space-y-4">
            {temContexto ? (
              <div className="space-y-3">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Contexto do representante
                </div>
                {ctx.represented_brands.length ? (
                  <div>
                    <div className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">
                      Marcas que representa além da Newline
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {ctx.represented_brands.map(m => (
                        <Badge key={m} variant="outline">
                          {m}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ) : null}
                {has(ctx.region_summary) || has(ctx.service_model) ? (
                  <div>
                    <div className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">
                      Região e modelo de atendimento
                    </div>
                    <p className="whitespace-pre-line break-words text-sm">
                      {[ctx.region_summary, ctx.service_model].filter(has).join("\n")}
                    </p>
                  </div>
                ) : null}
              </div>
            ) : null}

            {clientesPrincipais.length ? (
              <div className="space-y-2">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Clientes estratégicos
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {clientesPrincipais.map((c, i) => (
                    <div key={i} className="rounded-lg border p-3">
                      <div className="break-words text-sm font-semibold">{c.client_name ?? `Cliente ${i + 1}`}</div>
                      {has(c.strategic_reason) ? (
                        <p className="mt-1 whitespace-pre-line break-words text-sm text-muted-foreground">
                          {c.strategic_reason}
                        </p>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </Card>
      ) : null}

      <LeituraIntegradaV2 visao={visao} />
        </>
      )}


      {/* Performance */}
      <Card title="Conexão com a Performance">
        {perf ? (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2 text-sm">
              <Badge variant="secondary">{perf.periodoLabel}</Badge>
              <Badge variant="outline">Resultado geral {fmtPct(perf.geralPct)}</Badge>
              <Badge variant="outline">{perf.clientes} clientes</Badge>
            </div>
            {perf.familias.length ? (
              <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                {perf.familias.map(f => (
                  <div key={f.familia} className="flex items-center justify-between rounded-md border px-3 py-1.5 text-sm">
                    <span>{f.familia}</span>
                    <span className="text-muted-foreground">{fmtPct(f.pct)}</span>
                  </div>
                ))}
              </div>
            ) : null}
            {perf.criticas.length ? (
              <p className="text-xs text-muted-foreground">
                Famílias mais pressionadas: {perf.criticas.map(f => f.familia).join(", ")}.
              </p>
            ) : null}
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Ainda não há uma Performance ativa para este representante. Após a integração, será possível validar os sinais da entrevista por cliente, família e faixa de atendimento.
            </p>
            <Button asChild size="sm" variant="secondary">
              <a href="/representantes/performance">
                <Link2 className="mr-2 h-4 w-4" />
                Vincular Performance
              </a>
            </Button>
          </div>
        )}
      </Card>

      {/* Áreas de aprofundamento */}
      <div className="space-y-3 pt-2">
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        Áreas de aprofundamento
      </h3>
      <Collapse title="Perspectivas completas">

        <div className="grid gap-2 md:grid-cols-2">
          {visao.perspectives.map(p => {
            const vazia = !has(p.executive_finding) && !has(p.full_reading);
            return (
              <div key={p.perspective_number} className={cn("rounded-lg border p-3", vazia && "opacity-60")}>
                <div className="mb-1 flex flex-wrap items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">{String(p.perspective_number).padStart(2, "0")}</span>
                  <span className="text-sm font-semibold">{p.perspective_title}</span>
                  {p.confidence_level ? <Badge variant="outline">{CONFIDENCE_LABEL[p.confidence_level]}</Badge> : null}
                  {p.evidence_status ? <Badge variant="secondary">{EVIDENCE_LABEL[p.evidence_status]}</Badge> : null}
                </div>
                {vazia ? (
                  <p className="text-xs text-muted-foreground">Sem conteúdo informado.</p>
                ) : (
                  <div className="space-y-2">
                    <Field label="Achado executivo" value={p.executive_finding} />
                    <Field label="Impacto comercial" value={p.business_impact} />
                    <Field label="Ação recomendada" value={p.recommended_action} />
                    <Field label="Evidência" value={p.evidence} />
                    <Field label="Classificação comparativa" value={p.comparative_classification} />
                    {has(p.source_quote) ? (
                      <blockquote className="border-l-2 pl-3 text-sm italic text-muted-foreground">{p.source_quote}</blockquote>
                    ) : null}
                    {has(p.full_reading) ? (
                      <Collapse title="Ver análise completa">
                        <p className="whitespace-pre-wrap text-sm leading-relaxed">{p.full_reading}</p>
                      </Collapse>
                    ) : null}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Collapse>


      {/* Paralelo */}
      {cv.consensus_points.length || cv.divergences.length || cv.unaddressed_topics.length || cv.exclusive_readings.length || cv.comparable_source_count ? (
        <Collapse title="Paralelo completo">
          <div className="mb-3 flex flex-wrap gap-2 text-xs">
            {cv.supported_points != null && cv.comparable_point_count != null ? (
              <Badge variant="secondary">
                {cv.supported_points} de {cv.comparable_point_count} pontos comparáveis sustentados
              </Badge>
            ) : null}
            {cv.comparable_source_count != null ? <Badge variant="outline">Base de {cv.comparable_source_count} entrevistas</Badge> : null}
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {cv.consensus_points.length ? (
              <div className="space-y-2 rounded-lg border p-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Consensos</div>
                {cv.consensus_points.map((c, i) => (
                  <div key={i} className="text-sm">
                    <p>{c.statement}</p>
                    {c.supporting_source_count != null ? (
                      <span className="text-xs text-muted-foreground">
                        {c.supporting_source_count}
                        {c.comparable_source_count != null ? ` de ${c.comparable_source_count}` : ""} fontes sustentam
                      </span>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}
            {cv.unaddressed_topics.length ? (
              <div className="space-y-2 rounded-lg border p-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Temas não abordados</div>
                {cv.unaddressed_topics.map((t, i) => (
                  <div key={i} className="text-sm">
                    <p>{t.statement}</p>
                    <span className="text-xs text-muted-foreground">
                      {t.classification ?? "Tema não abordado"}
                      {t.question_was_asked === false ? " · pergunta não foi feita" : ""}
                    </span>
                    <Field label="Nota metodológica" value={t.methodological_note} />
                  </div>
                ))}
              </div>
            ) : null}
            {cv.divergences.length ? (
              <div className="space-y-2 rounded-lg border p-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Divergências</div>
                {cv.divergences.map((d, i) => (
                  <div key={i} className="space-y-1 text-sm">
                    <p className="font-medium">{d.topic}</p>
                    <Field label="Leitura predominante" value={d.predominant_view} />
                    <Field label="Leitura do representante" value={d.representative_view} />
                    <Field label="Evidência" value={d.evidence} />
                  </div>
                ))}
              </div>
            ) : null}
            {cv.exclusive_readings.length ? (
              <div className="space-y-2 rounded-lg border p-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Hipótese regional ou leitura exclusiva
                </div>
                {cv.exclusive_readings.map((e, i) => (
                  <div key={i} className="space-y-1 text-sm">
                    <p>{e.statement}</p>
                    <Field label="Região" value={e.region} />
                    <Field label="Evidência" value={e.supporting_evidence} />
                    <Field label="Validação necessária" value={e.validation_required} />
                  </div>
                ))}
              </div>
            ) : null}
          </div>
          <Field label="Nota metodológica" value={cv.methodology_note} />
        </Collapse>

      ) : null}


      {/* Visão executiva — oculta no schema 3.0 (executive_brief_v1): tese central e
          sinais prioritários existem apenas como espelho interno do briefing. */}
      {!briefV1 && (has(ev.central_thesis) || ev.priority_signals.length) ? (

        <Collapse title="Relatório de origem · visão executiva">
          <div className="space-y-3">
            <Field label="Tese central" value={ev.central_thesis} />
            <Field label="Risco estratégico" value={ev.strategic_risk} />

            {ev.priority_signals.length ? (
              <div className="grid gap-2 md:grid-cols-2">
                {ev.priority_signals.map((s, i) => (
                  <div key={i} className="rounded-lg border p-3">
                    <div className="mb-1 flex flex-wrap items-center gap-1.5">
                      <span className="text-sm font-semibold">{s.title ?? `Sinal ${i + 1}`}</span>
                      {s.confidence_level ? <Badge variant="outline">{CONFIDENCE_LABEL[s.confidence_level]}</Badge> : null}
                      {s.evidence_status ? <Badge variant="secondary">{EVIDENCE_LABEL[s.evidence_status]}</Badge> : null}
                    </div>
                    <div className="space-y-2">
                      <Field label="Achado" value={s.finding} />
                      <Field label="Impacto comercial" value={s.business_impact} />
                      <Field label="Ação recomendada" value={s.recommended_action} />
                      <Field label="Capítulo de origem" value={s.source_chapter} />
                      {has(s.source_quote) ? (
                        <blockquote className="border-l-2 pl-3 text-sm italic text-muted-foreground">{s.source_quote}</blockquote>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
            <div className="grid gap-3 md:grid-cols-2">
              {ev.decisions_required.length ? (
                <div className="rounded-lg border p-3">
                  <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Decisões requeridas</div>
                  <ul className="list-disc space-y-1 pl-4 text-sm">
                    {ev.decisions_required.map((d, i) => (
                      <li key={i}>{d}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {ev.validation_required.length ? (
                <div className="rounded-lg border p-3">
                  <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Validações necessárias</div>
                  <ul className="list-disc space-y-1 pl-4 text-sm">
                    {ev.validation_required.map((d, i) => (
                      <li key={i}>{d}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
            <Field label="Síntese final" value={ev.final_synthesis} />
          </div>
        </Collapse>

      ) : null}


      {/* Linhas de produto */}
      {visao.product_line_views.length ? (
        <Collapse title="Informações adicionais · linhas de produto">
          <div className="mb-3 flex flex-wrap gap-1.5">
            {(["todas", ...(Object.keys(CLASSIFICATION_LABEL) as LineClassification[])] as const).map(k => (
              <button
                key={k}
                onClick={() => setFiltroLinha(k as any)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs",
                  filtroLinha === k ? "border-primary bg-primary/10 text-foreground" : "text-muted-foreground",
                )}
              >
                {k === "todas" ? "Todas" : CLASSIFICATION_LABEL[k as LineClassification]}
              </button>
            ))}
          </div>
          <div className="space-y-2">
            {linhas.map((l, i) => (
              <Collapse key={i} title={`${l.product_line ?? "Linha"}${l.classification ? ` · ${CLASSIFICATION_LABEL[l.classification]}` : ""}`}>
                <div className="space-y-2">
                  <Field label="Leitura resumida" value={l.summary} />
                  <Field label="O que funciona" value={l.what_works} />
                  <Field label="Principal barreira" value={l.main_barrier} />
                  <Field label="Concorrente principal" value={l.main_competitor} />
                  <Field label="Vantagem do concorrente" value={l.competitor_advantage} />
                  <Field label="Oportunidade" value={l.opportunity} />
                  <Field label="Ação recomendada" value={l.recommended_action} />
                  <Field label="Evidência" value={l.evidence} />
                  {has(l.source_quote) ? (
                    <blockquote className="border-l-2 pl-3 text-sm italic text-muted-foreground">{l.source_quote}</blockquote>
                  ) : null}
                </div>
              </Collapse>
            ))}
          </div>
        </Collapse>
      ) : null}
      </div>


      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Shield className="h-3.5 w-3.5" />
        Conteúdo confidencial: armazenado de forma privada, restrito à sua empresa e auditado por modo de origem, autor e data.
      </p>
    </div>
  );
}
