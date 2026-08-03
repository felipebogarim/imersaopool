import { VisaoPorFamilia } from "@/components/sintese/VisaoPorFamilia";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
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
import { BrandPositioningRadarV2 } from "@/components/visao-rep2/BrandPositioningRadarV2";

import { ExecutiveBriefV2 } from "@/components/visao-rep2/ExecutiveBriefV2";
import { PerspectivasEntrevistaV2 } from "@/components/visao-rep2/PerspectivasV2";
import { AcoesSecao } from "@/components/visao-rep2/AcoesSecao";

import { buildPerspectivasVM } from "@/lib/visao-rep2-perspectivas";
import { briefingPadrao } from "@/lib/visao-rep2-briefing";

import { buildPerfResumo, fmtPct, matchRepresentativeId, type PerfRowLite, type UploadLite } from "@/lib/visao-rep";
import { exportVisaoRep2Pdf } from "@/lib/visao-rep2-pdf";
import {
  AlertTriangle,
  ArrowLeft,
  ChevronDown,
  Eraser,
  FileDown,
  FileText,
  FileUp,
  Link2,
  Loader2,
  RefreshCw,
  Shield,
  Sparkles,
  Trash2,
  BarChart3,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/visao-rep-2")({
  head: () => ({
    meta: [
      { title: "Visão Rep — PoolFlux" },
      {
        name: "description",
        content:
          "Visão Rep: leitura executiva do representante em modelo canônico, gerada por IA ou importada a partir de um relatório final pronto.",
      },
      { property: "og:title", content: "Visão Rep — PoolFlux" },
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

/** Opção virtual da lista: visão consolidada de todos os entrevistados. */
const CONSOLIDADO_ID = "__consolidado__";
const CONSOLIDADO_NOME = "CONSOLIDADO";

/** Normaliza nomes para comparação (sem acentos, maiúsculo). */
const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();



function VisaoRep2Page() {
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string>("");
  const [repId, setRepId] = useState<string>("");
  const [draft, setDraft] = useState<VisaoRep2 | null>(null);
  const [draftFile, setDraftFile] = useState<string | null>(null);
  const [draftHash, setDraftHash] = useState<string | null>(null);
  const [draftSalvo, setDraftSalvo] = useState(false);
  const [busy, setBusy] = useState(false);
  const [atualizandoComparativos, setAtualizandoComparativos] = useState(false);

  /** Recarrega todos os relatórios salvos para recalcular a base comparativa da teia. */
  async function onAtualizarComparativos() {
    setAtualizandoComparativos(true);
    try {
      await Promise.all([
        qc.refetchQueries({ queryKey: ["vr2-reports"] }),
        qc.refetchQueries({ queryKey: ["vr2-uploads"] }),
      ]);

      toast.success("Comparativos atualizados a partir de todos os relatórios salvos.");
    } catch (e: any) {
      console.error("[visao-rep-2] falha ao atualizar comparativos", e);
      toast.error("Não foi possível atualizar os comparativos.");
    } finally {
      setAtualizandoComparativos(false);
    }
  }


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

  /**
   * Base comparativa da teia: apenas relatórios salvos, um por representante
   * (o mais recente), excluindo o relatório e o representante atualmente abertos.
   */
  const comparaveis = useMemo(() => {
    const vistos = new Set<string>();
    const atualKey = (selected?.representative_id ?? norm(selected?.representative_name ?? "")) || "";
    return reports
      .filter(r => r.id !== selected?.id)
      .filter(r => norm(r.representative_name ?? "") !== CONSOLIDADO_NOME)
      .filter(r => {
        const key = r.representative_id ?? norm(r.representative_name ?? "");
        if (!key || key === atualKey || vistos.has(key)) return false;
        vistos.add(key);
        return true;
      })
      .map(r => normalizeVisaoRep2(r.data));
  }, [reports, selected]);



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
  /** Vincula performance pelo id do representante; se o relatório não tiver id, casa por nome (regra canônica).
   *  Vale também para o rascunho importado, para o atingimento aparecer já na prévia. */
  const repVinculadoId = useMemo(() => {
    const alvo = draft?.metadata ?? selected ?? null;
    const id = (alvo as any)?.representative_id as string | null | undefined;
    const nome = ((alvo as any)?.representative_name ?? null) as string | null;
    return id ?? matchRepresentativeId(nome, reps);
  }, [draft, selected, reps]);



  const upload = useMemo(
    () => uploads.find(u => u.representative_id === repVinculadoId) ?? null,
    [uploads, repVinculadoId],
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

  // A tela inicial sempre mostra a lista; o relatório só abre por ação explícita.




  // ---- Ações ----
  /** Um relatório por representante: localiza o(s) salvo(s) do mesmo rep. */
  function existentesDoRep(v: VisaoRep2) {
    const id = v.metadata.representative_id;
    const nome = (v.metadata.representative_name ?? "").trim().toLowerCase();
    return reports.filter(r =>
      id ? r.representative_id === id : !!nome && r.representative_name.trim().toLowerCase() === nome,
    );
  }

  const salvar = useMutation({
    mutationFn: async (v: VisaoRep2) => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id ?? null;
      const now = new Date().toISOString();
      const imported = v.metadata.creation_mode === "imported_ready";

      // Substitui o relatório anterior do mesmo representante (um por rep).
      const dupIds = existentesDoRep(v).map(r => r.id);
      if (dupIds.length) {
        const { error: delErr } = await supabase.from("visao_rep_reports").delete().in("id", dupIds);
        if (delErr) throw delErr;
      }

      // Preserva a versão declarada pelo próprio relatório (ex.: 3.0).
      const schemaVersion = v.metadata.schema_version || VISAO_REP_SCHEMA_VERSION;
      // Padroniza o vínculo: relatórios importados sem id são casados pelo nome.
      const repIdFinal = v.metadata.representative_id ?? matchRepresentativeId(v.metadata.representative_name, reps);
      const payload: VisaoRep2 = {
        ...v,
        metadata: {
          ...v.metadata,
          representative_id: repIdFinal,
          created_by: uid,
          created_at: now,
          updated_at: now,
          source_file_name: draftFile,
        },
        source_control: {
          ...v.source_control,
          creation_mode: v.metadata.creation_mode,
          source_file: draftFile,
          schema_version: schemaVersion,
          import_date: imported ? now : null,
          imported_by: imported ? uid : null,
          last_update: now,
          content_hash: draftHash,
        },
      };
      const { data, error } = await supabase
        .from("visao_rep_reports")
        .insert({
          representative_id: repIdFinal,
          representative_name: v.metadata.representative_name ?? "Sem representante",
          region: v.metadata.region,
          creation_mode: v.metadata.creation_mode,
          schema_version: schemaVersion,
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
    onSuccess: () => {
      toast.success("Relatório salvo. Use “Voltar para a lista” para ver os salvos.");
      setDraftSalvo(true);
      setRepId("");
      qc.invalidateQueries({ queryKey: ["vr2-reports"] });
      setSelectedId("");
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
      toast.success("Todos os dados de Visão Rep foram limpos.");
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
    if (!window.confirm("Tem certeza que deseja limpar TODOS os relatórios de Visão Rep? Esta ação não pode ser desfeita.")) return;
    await limparTodos.mutateAsync();
  }

  /** Gera e salva de uma vez: um relatório por representante. */
  async function gerarESalvar(repIdAlvo: string) {
    const v = await gerar({ data: { representativeId: repIdAlvo } });
    setDraftFile(null);
    setDraftHash(null);
    await salvar.mutateAsync(normalizeVisaoRep2(v));
  }

  /** Fecha a prévia e volta para a tela inicial com a lista de relatórios salvos. */
  function voltarParaLista() {
    setDraft(null);
    setDraftFile(null);
    setDraftHash(null);
    setDraftSalvo(false);
    setSelectedId("");
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /** Salva pedindo confirmação quando o representante já tem relatório salvo. */
  async function salvarUnico(v: VisaoRep2) {
    const dup = existentesDoRep(v);
    if (dup.length) {
      const ok = window.confirm(
        `Já existe um relatório salvo para ${dup[0].representative_name}. Deseja substituir o relatório atual por este?`,
      );
      if (!ok) return;
    }
    await salvar.mutateAsync(v);
  }

  async function onGerarIA() {
    if (!repId) return toast.error("Selecione um representante.");
    if (repId === CONSOLIDADO_ID)
      return toast.info("A visão CONSOLIDADO é criada apenas por envio de relatório pronto.");
    const existente = reports.find(r => r.representative_id === repId);
    if (existente) {
      const ok = window.confirm(
        `${existente.representative_name} já tem um relatório salvo. Deseja substituí-lo por uma nova geração?`,
      );
      if (!ok) return;
    }
    setBusy(true);
    try {
      await gerarESalvar(repId);
      toast.success(existente ? "Relatório substituído e salvo na lista." : "Relatório gerado e salvo na lista.");
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
      console.error("[visao-rep-2] falha ao importar relatório", e);
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

  // ---- Tela de leitura de um relatório salvo ----
  if (visao && selected) {
    return (
      <div className="mx-auto w-full max-w-[1400px] space-y-6 px-4 py-6 sm:px-8 lg:px-10">

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => setSelectedId("")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar para a lista
          </Button>
          <Badge variant="secondary">Modo de origem: {MODE_LABEL[selected.creation_mode]}</Badge>
          <Badge variant="outline">{selected.schema_version}</Badge>
          {selected.content_hash ? (
            <Badge variant="outline" className="font-mono text-[10px]">
              hash {selected.content_hash.slice(0, 12)}
            </Badge>
          ) : null}
          <div className="ml-auto flex flex-wrap gap-2">
            <Button size="sm" onClick={() => exportVisaoRep2Pdf(visao, perf)}>
              <FileText className="mr-2 h-4 w-4" />
              Exportar PDF
            </Button>
            <Button size="sm" variant="secondary" onClick={() => exportar(visao, selected.representative_name)}>
              <FileDown className="mr-2 h-4 w-4" />
              Exportar relatório estruturado
            </Button>
          </div>
        </div>
        <VisaoRep2View visao={visao} perf={perf} comparaveis={comparaveis} biRepId={repVinculadoId} />
      </div>
    );
  }

  const repSel = reps.find((r: any) => r.id === repId) as any;

  return (
    <div>
      <PageHeader
        title="Visão Rep"
        subtitle="Leitura executiva do representante em modelo canônico: gere com IA ou importe o relatório final pronto."
      />

      <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card px-4 py-3 shadow-sm sm:px-5">
        <Label className="shrink-0 text-sm text-muted-foreground">Representante</Label>
        <Select value={repId} onValueChange={setRepId}>
          <SelectTrigger className="w-[240px]">
            <SelectValue placeholder="Selecione" />
          </SelectTrigger>
          <SelectContent>
            {reps.map((r: any) => (
              <SelectItem key={r.id} value={r.id}>
                {r.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {repSel?.regiao ? (
          <Badge variant="secondary" className="uppercase">
            {repSel.regiao}
          </Badge>
        ) : null}

        <Button onClick={onGerarIA} disabled={busy} size="sm">
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
          Gerar Visão Rep
        </Button>

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
        <Button variant="secondary" size="sm" disabled={busy} onClick={() => document.getElementById("vr2-file")?.click()}>
          <FileUp className="mr-2 h-4 w-4" />
          Enviar relatório pronto
        </Button>

        <Button
          variant="outline"
          size="sm"
          disabled={atualizandoComparativos}
          onClick={() => void onAtualizarComparativos()}
          title="Recarrega todos os relatórios salvos e recalcula a média das demais na teia comparativa"
        >
          {atualizandoComparativos ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          Atualizar comparativos
        </Button>


        <Button
          variant="ghost"
          size="sm"
          className="ml-auto text-destructive hover:text-destructive"
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
        <div className="mt-4 space-y-4">
          <div className="flex justify-end">
            <Button variant="secondary" size="sm" onClick={voltarParaLista}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar
            </Button>
          </div>

          <Collapse title="Dados do relatório" defaultOpen>
            <div className="space-y-5 p-1 sm:p-2">
              <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Representante</Label>
                  <Input
                    value={draft.metadata.representative_name ?? ""}
                    onChange={e => setDraft({ ...draft, metadata: { ...draft.metadata, representative_name: e.target.value } })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Região</Label>
                  <Input
                    value={draft.metadata.region ?? ""}
                    onChange={e => setDraft({ ...draft, metadata: { ...draft.metadata, region: e.target.value } })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Data da entrevista</Label>
                  <Input
                    value={draft.metadata.interview_date ?? ""}
                    onChange={e => setDraft({ ...draft, metadata: { ...draft.metadata, interview_date: e.target.value } })}
                  />
                </div>
                <div className="space-y-1.5">
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

              {validacao.missingRequired.length ? (
                <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-4 text-sm">
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
                <p className="rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">
                  Arquivo validado e pronto para importação.
                </p>
              )}
            </div>
          </Collapse>


          <Collapse title="Prévia do conteúdo" defaultOpen>
            <VisaoRep2View visao={draft} perf={perf} />
          </Collapse>

          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => void salvarUnico(draft)}
              disabled={salvar.isPending || validacao.missingRequired.length > 0}
            >
              {salvar.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {draftSalvo ? "Salvar novamente" : "Salvar"}
            </Button>
            <Button variant="secondary" onClick={() => exportVisaoRep2Pdf(normalizeVisaoRep2(draft), perf)}>
              <FileText className="mr-2 h-4 w-4" />
              Exportar PDF
            </Button>
            <Button variant="secondary" onClick={() => exportar(normalizeVisaoRep2(draft), draft.metadata.representative_name ?? "relatorio")}>
              <FileDown className="mr-2 h-4 w-4" />
              Exportar relatório estruturado
            </Button>
            <Button variant="ghost" onClick={voltarParaLista}>
              Cancelar
            </Button>
          </div>
        </div>
      ) : null}

      {/* Lista */}
      <Card className="mt-4" title="Relatórios salvos">
        <p className="mb-3 text-sm text-muted-foreground">
          Cada representante fica salvo aqui. Abrir um relatório não substitui nenhum outro — para trocar o conteúdo de um
          representante use “Regerar com IA”.
        </p>
        {!reports.length ? (
          <EmptyState title="Nenhuma Visão Rep ainda" description="Gere com IA ou importe um relatório pronto para começar." />
        ) : (
          <div className="space-y-2">
            {reports.map(r => (
              <div key={r.id} className="flex flex-wrap items-center gap-2 rounded-lg border p-3">
                <Button size="sm" onClick={() => { setSelectedId(r.id); window.scrollTo({ top: 0 }); }}>
                  Abrir Visão
                </Button>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">{r.representative_name}</div>
                  <div className="text-xs text-muted-foreground">
                    {r.region ? `${r.region} · ` : ""}
                    {new Date(r.created_at).toLocaleDateString("pt-BR")}
                    {r.source_file_name ? ` · ${r.source_file_name}` : ""}
                  </div>
                </div>
                <Badge variant={r.creation_mode === "imported_ready" ? "outline" : "secondary"}>{MODE_LABEL[r.creation_mode]}</Badge>

                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => exportVisaoRep2Pdf(normalizeVisaoRep2(r.data), null)}
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


    </div>

  );
}

// ============================ Visualização ============================

function VisaoRep2View({
  visao,
  perf,
  comparaveis = [],
  biRepId = null,
}: {
  visao: VisaoRep2;
  perf: ReturnType<typeof buildPerfResumo> | null;
  /** Relatórios usados na média da teia comparativa. */
  comparaveis?: VisaoRep2[];
  /** Representante vinculado, usado para abrir o BI em nova janela. */
  biRepId?: string | null;
}) {
  const [filtroLinha, setFiltroLinha] = useState<LineClassification | "todas">("todas");
  const ev = visao.executive_view;
  const cv = visao.comparative_view;

  const linhas = visao.product_line_views.filter(l => filtroLinha === "todas" || l.classification === filtroLinha);

  // Modelo padrão único: todo relatório é exibido no mesmo briefing executivo.
  const brief = briefingPadrao(visao);
  const briefV1 = isExecutiveBriefV1(visao);
  const perspectivas = useMemo(() => {
    const doRelatorio = buildPerspectivasVM(visao);
    if (doRelatorio.some(p => p.temConteudo)) return doRelatorio;
    return undefined;
  }, [visao]);

  return (
    <div className="space-y-4">
      {biRepId ? (
        <div className="flex justify-end">
          <Button
            size="sm"
            variant="secondary"
            onClick={() =>
              window.open(
                `/representantes/performance?rep=${encodeURIComponent(biRepId)}&bi=1`,
                "_blank",
                "noopener,noreferrer",
              )
            }
          >
            <BarChart3 className="mr-2 h-4 w-4" />
            BI do rep
          </Button>
        </div>
      ) : null}
      <ExecutiveBriefV2
        brief={brief}
        nome={visao.metadata.representative_name ?? "Representante"}
        regiao={visao.metadata.region}
        dataEntrevista={visao.metadata.interview_date}
        dataRelatorio={
          visao.metadata.updated_at ? new Date(visao.metadata.updated_at).toLocaleDateString("pt-BR") : null
        }
        perspectivas={perspectivas}
        contexto={visao.metadata.representative_id ?? visao.metadata.representative_name ?? undefined}
        perf={perf}
        leitura={<LeituraIntegradaV2 visao={visao} />}
        teia={<BrandPositioningRadarV2 atual={visao} comparaveis={comparaveis} />}
      />




      {/* Visão por família */}
      <VisaoPorFamilia
        repNome={visao.metadata.representative_name}
        mostrarUpload={false}
      />

      {/* Áreas de aprofundamento */}
      <div className="space-y-3 pt-2">
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        Áreas de aprofundamento
      </h3>




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
                      <span className="ml-auto">
                        <AcoesSecao
                          titulo={s.title ?? `Sinal ${i + 1}`}
                          descricao={[s.finding, s.business_impact].filter(Boolean).join("\n\n")}
                          contexto={visao.metadata.representative_id ?? visao.metadata.representative_name ?? undefined}
                          escopo={`sinal-${i + 1}`}
                        />
                      </span>
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
