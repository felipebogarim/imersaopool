import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { EmptyState } from "@/components/EmptyState";
import { FONTE_TIPOS, LENTES, LENTE_DEF, TIPO_LABEL, type FonteTipo, type Lente } from "@/lib/insight-lentes";
import type { SinteseResultado } from "@/lib/sintese-engine";
import { gerarPainelSintese } from "@/lib/sintese.functions";
import { importarAnaliseSintese } from "@/lib/sintese-import.functions";
import { extractFileText } from "@/lib/sintese-file-text";
import { exportSintesePdf } from "@/lib/sintese-pdf";
import { GerarTarefaDialog } from "@/components/sintese/GerarTarefaDialog";
import { VisaoPorFamilia } from "@/components/sintese/VisaoPorFamilia";
import { RefreshCw, Sparkles, ArrowRightLeft, Layers, ListChecks, Quote, Wand2, FileDown, Upload, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/sintese/tipos")({
  head: () => ({
    meta: [
      { title: "Síntese por tipo — PoolFlux" },
      { name: "description", content: "Convergências, divergências e pontos regionais únicos por lente, entre fontes de insight." },
      { property: "og:title", content: "Síntese por tipo — PoolFlux" },
      { property: "og:description", content: "O que é comum, o que diverge e o que é específico entre entrevistas, visitas e voz da loja." },
    ],
  }),
  component: SinteseTipos,
});

function SinteseTipos() {
  const qc = useQueryClient();
  const gerar = useServerFn(gerarPainelSintese);
  const importar = useServerFn(importarAnaliseSintese);
  const fileRef = useRef<HTMLInputElement>(null);
  const [tipos, setTipos] = useState<FonteTipo[]>(["entrevista"]);
  const [regiao, setRegiao] = useState<string>("todas");
  const [ativa, setAtiva] = useState<Lente>("marca_preco");
  const [busy, setBusy] = useState(false);
  const [tarefa, setTarefa] = useState<{ title: string; description: string } | null>(null);

  const { data: fontes = [] } = useQuery({
    queryKey: ["insight-fontes-sintese"],
    queryFn: async () =>
      (await supabase
        .from("insight_fontes")
        .select("id, tipo, titulo, pessoa, regiao, perfil_carteira, status_processamento, updated_at, arquivo_relatorio, interview_id")
        .neq("status_processamento", "pendente")).data ?? [],
  });

  const { data: painel } = useQuery({
    queryKey: ["painel-sintese", tipos.slice().sort().join(",")],
    queryFn: async () => {
      const { data } = await supabase
        .from("paineis_sintese")
        .select("id, versao, gerado_em, fontes_incluidas, tipos_incluidos, resultado, corte_convergencia")
        .order("gerado_em", { ascending: false })
        .limit(50);
      const alvo = tipos.slice().sort().join(",");
      return (data ?? []).find(p => (p.tipos_incluidos as string[]).slice().sort().join(",") === alvo) ?? null;
    },
  });

  const elegiveis = useMemo(() => fontes.filter((f: any) => tipos.includes(f.tipo)), [fontes, tipos]);

  const tiposVazios = useMemo<FonteTipo[]>(
    () => (tipos.length > 1 ? tipos.filter(t => !fontes.some((f: any) => f.tipo === t)) : []),
    [tipos, fontes],
  );

  const novas = useMemo(() => {
    if (!painel) return elegiveis;
    const inc = new Set((painel.fontes_incluidas as string[]) ?? []);
    return elegiveis.filter((f: any) => !inc.has(f.id) || new Date(f.updated_at) > new Date(painel.gerado_em));
  }, [elegiveis, painel]);

  const resultado = painel?.resultado as unknown as SinteseResultado | undefined;
  const fonteById = useMemo(() => new Map(fontes.map((f: any) => [f.id, f])), [fontes]);

  const regioes = useMemo(
    () => [...new Set(elegiveis.map((f: any) => (f.regiao ?? "").trim()).filter(Boolean))] as string[],
    [elegiveis],
  );

  function filtraFontes(refs: { id: string; regiao: string | null }[]) {
    if (regiao === "todas") return true;
    return refs.some(r => (r.regiao ?? "").trim() === regiao);
  }

  const lente = resultado?.lentes?.[ativa];
  const conv = (lente?.convergencia ?? []).filter(c => filtraFontes(c.fontes));
  const div = (lente?.divergencia ?? []).filter(d => filtraFontes(d.posicoes.map(p => ({ id: p.fonteId, regiao: p.regiao }))));
  const esp = (lente?.especifico ?? []).filter(e => regiao === "todas" || (e.regiao ?? "").trim() === regiao);

  function toggleTipo(t: FonteTipo) {
    setTipos(cur => (cur.includes(t) ? (cur.length === 1 ? cur : cur.filter(x => x !== t)) : [...cur, t]));
  }

  async function reprocessar() {
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc("reprocessar_fontes_entrevistas");
      if (error) throw error;
      const r = (data ?? {}) as { criadas?: number; atualizadas?: number };
      toast.success(`Fontes reprocessadas: ${r.criadas ?? 0} criadas, ${r.atualizadas ?? 0} atualizadas.`);
      qc.invalidateQueries({ queryKey: ["insight-fontes-sintese"] });
      qc.invalidateQueries({ queryKey: ["insight-fontes"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao reprocessar fontes.");
    } finally {
      setBusy(false);
    }
  }

  async function atualizar() {
    if (!elegiveis.length) {
      toast.error("Nenhuma fonte processada para consolidar.");
      return;
    }
    setBusy(true);
    try {
      const r = await gerar({ data: { tipos } });
      toast.success(`Nova versão v${r.versao} gerada com ${r.fontes} fontes.`);
      qc.invalidateQueries({ queryKey: ["painel-sintese"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao gerar a síntese.");
    } finally {
      setBusy(false);
    }
  }

  async function onImportFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    try {
      toast.info("Lendo arquivo…");
      const texto = await extractFileText(file);
      const r = await importar({ data: { tipos, texto, arquivo: file.name } });
      toast.success(`Análise importada como v${r.versao}. Ela prevalece sobre a consolidação interna.`);
      qc.invalidateQueries({ queryKey: ["painel-sintese"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao importar a análise.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function exportarPdf() {
    if (!resultado || !painel) {
      toast.error("Nenhuma síntese para exportar.");
      return;
    }
    exportSintesePdf({
      resultado,
      tipos,
      geradoEm: painel.gerado_em,
      versao: painel.versao,
      regiao,
      origem: (resultado.meta as any)?.origem ?? null,
    });
  }

  function relatorioLink(fonteId: string): string | null {
    const f: any = fonteById.get(fonteId);
    if (!f) return null;
    if (f.arquivo_relatorio) return f.arquivo_relatorio;
    if (f.interview_id) return `/entrevistas/${f.interview_id}`;
    return `/fontes/${f.id}`;
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div>
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.xlsx,.xls,.csv,.docx,.txt,.md"
          className="hidden"
          onChange={e => onImportFile(e.target.files?.[0])}
        />
        <PageHeader
          title="Síntese por tipo"
          subtitle={
            painel
              ? `Última análise: ${new Date(painel.gerado_em).toLocaleString("pt-BR")} · ${(painel.fontes_incluidas as string[]).length} fontes · v${painel.versao}${(painel.resultado as any)?.meta?.origem === "importada" ? " · análise importada" : ""}`
              : "Nenhuma análise gerada ainda para esta seleção."
          }
          actions={
            <>
              <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={busy}>
                <Upload className="h-4 w-4 mr-1" /> Carregar análise própria
              </Button>
              <Button variant="outline" onClick={exportarPdf} disabled={busy || !resultado}>
                <FileDown className="h-4 w-4 mr-1" /> Exportar relatório
              </Button>
              <Button variant="outline" onClick={reprocessar} disabled={busy}>
                <Wand2 className="h-4 w-4 mr-1" /> Reprocessar fontes existentes
              </Button>
              <Button onClick={atualizar} disabled={busy || !elegiveis.length}>
                <RefreshCw className={cn("h-4 w-4 mr-1", busy && "animate-spin")} /> Atualizar análise
              </Button>
            </>
          }
        />

        <div className="p-4 sm:p-8 space-y-5">
          <div className="surface rounded-xl p-3 sm:p-4 space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Universo de fontes
              </span>
              <span className="text-xs text-muted-foreground">
                {tipos.length > 1 ? (
                  <><ArrowRightLeft className="inline h-3 w-3 mr-1" />cruzamento entre universos</>
                ) : (
                  "universo isolado"
                )}
              </span>
              <div className="ml-auto w-48">
                <Select value={regiao} onValueChange={setRegiao}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Região" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas as regiões</SelectItem>
                    {regioes.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <nav className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4" aria-label="Tipos de fonte">
              {FONTE_TIPOS.map(t => {
                const ativo = tipos.includes(t);
                const total = fontes.filter((f: any) => f.tipo === t).length;
                return (
                  <button
                    key={t}
                    type="button"
                    aria-pressed={ativo}
                    onClick={() => toggleTipo(t)}
                    className={cn(
                      "group flex items-center justify-between gap-3 rounded-lg border px-4 py-3 text-left transition",
                      ativo
                        ? "border-primary bg-primary text-primary-foreground shadow-sm"
                        : "border-border bg-background hover:border-primary/50 hover:bg-muted",
                    )}
                  >
                    <span className="text-sm font-semibold leading-tight">{TIPO_LABEL[t]}</span>
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums",
                        ativo ? "bg-primary-foreground/20" : "bg-muted text-muted-foreground",
                      )}
                    >
                      {total}
                    </span>
                  </button>
                );
              })}
            </nav>
          </div>

          {tiposVazios.length > 0 && (
            <p className="rounded-xl border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
              Ainda não há fontes do tipo {tiposVazios.map(t => TIPO_LABEL[t]).join(", ")}. Adicione fontes desse tipo para cruzar.
            </p>
          )}

          {elegiveis.length > 0 && novas.length > 0 ? (
            <div className="rounded-xl border border-primary/40 bg-primary/5 px-4 py-3 flex flex-wrap items-center gap-3">
              <Sparkles className="h-4 w-4 text-primary" />
              <p className="text-sm">
                {novas.length} {novas.length === 1 ? "nova fonte disponível" : "novas fontes disponíveis"}:{" "}
                <span className="font-medium">{novas.map((f: any) => `${f.pessoa ?? f.titulo}${f.regiao ? ` — ${f.regiao}` : ""}`).join(", ")}</span>. Atualizar análise?
              </p>
              <Button size="sm" onClick={atualizar} disabled={busy}>Atualizar</Button>
            </div>
          ) : painel ? (
            <p className="text-xs text-muted-foreground">
              Análise em dia — nenhuma fonte nova desde {new Date(painel.gerado_em).toLocaleDateString("pt-BR")}.
            </p>
          ) : null}

          {!elegiveis.length && !resultado ? (
            <EmptyState
              icon={Layers}
              title="Nenhuma fonte processada ainda para este tipo."
              description="Traga as entrevistas já existentes para o modelo de fontes e a síntese passa a funcionar."
              action={
                <Button onClick={reprocessar} disabled={busy}>
                  <Wand2 className="h-4 w-4 mr-1" /> Reprocessar fontes existentes
                </Button>
              }
            />
          ) : !resultado ? (
            <EmptyState
              icon={Layers}
              title="Sem síntese para esta seleção"
              description={`${elegiveis.length} fonte(s) pronta(s). Clique em Atualizar análise para consolidar as 8 lentes.`}
              action={<Button onClick={atualizar} disabled={busy}>Atualizar análise</Button>}
            />
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-3">
                <MetricCard label="Convergências fortes" value={resultado.meta.convergencias_fortes} tone="teal" />
                <MetricCard label="Divergências a decidir" value={resultado.meta.divergencias} tone="amber" />
                <MetricCard label="Pontos regionais únicos" value={resultado.meta.especificos} tone="neutral" />
              </div>

              <div className="flex flex-wrap gap-2">
                {LENTES.map(l => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => setAtiva(l)}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs transition",
                      ativa === l ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted",
                    )}
                  >
                    {LENTE_DEF[l].label}
                  </button>
                ))}
              </div>

              <div className="space-y-8">
                <section className="space-y-3">
                  <h2 className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">Convergência</h2>
                  {conv.length === 0 ? <Vazio /> : (
                    <div className="space-y-3">
                      {conv.map((c, i) => <Convergencia key={i} item={c} link={relatorioLink} />)}
                    </div>
                  )}
                </section>

                <section className="space-y-3">
                  <h2 className="text-sm font-semibold text-amber-600 dark:text-amber-400">Divergência</h2>
                  {div.length === 0 ? <Vazio /> : div.map((d, i) => (
                    <div key={i} className="border-l-2 border-amber-500/60 pl-4 py-1 space-y-3">
                      <p className="text-sm font-medium">{d.tema}</p>
                      {d.posicoes.map((p, j) => (
                        <div key={j} className="space-y-1">
                          <p className="text-sm">
                            <span className="font-medium">{p.fonte}</span>
                            {p.regiao ? <span className="text-muted-foreground"> · {p.regiao}</span> : null} — {p.posicao}
                          </p>
                          {p.fala && <Fala texto={p.fala} />}
                        </div>
                      ))}
                    </div>
                  ))}
                </section>

                <section className="space-y-3">
                  <h2 className="text-sm font-semibold text-muted-foreground">Específico</h2>
                  {esp.length === 0 ? <Vazio /> : (
                    <ul className="space-y-1.5">
                      {esp.map((e, i) => (
                        <li key={i} className="text-sm flex flex-wrap gap-x-2">
                          <span>{e.texto}</span>
                          <span className="text-xs text-muted-foreground self-center">
                            {e.fonte}{e.regiao ? ` · ${e.regiao}` : ""}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>


                {lente?.acao_convergente && (
                  <div className="rounded-xl border border-primary/40 bg-primary/5 p-4 flex flex-wrap items-center gap-3">
                    <ListChecks className="h-4 w-4 text-primary" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Ação convergente</p>
                      <p className="text-sm">{lente.acao_convergente.texto}</p>
                    </div>
                    <Button
                      size="sm"
                      onClick={() =>
                        setTarefa({
                          title: lente.acao_convergente!.texto.slice(0, 120),
                          description: `Origem: lente ${LENTE_DEF[ativa].label}\nFontes: ${lente.acao_convergente!.fontes.map(f => `${f.nome}${f.regiao ? ` (${f.regiao})` : ""}`).join(", ")}\nPeso: ${lente.acao_convergente!.peso} de ${resultado.meta.total_fontes}`,
                        })
                      }
                    >
                      Gerar tarefa → Kanban
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}

          <VisaoPorFamilia />
        </div>

        <GerarTarefaDialog tarefa={tarefa} onClose={() => setTarefa(null)} />
      </div>
    </TooltipProvider>
  );
}

function MetricCard({ label, value, tone }: { label: string; value: number; tone: "teal" | "amber" | "neutral" }) {
  return (
    <div
      className={cn(
        "surface rounded-xl p-5",
        tone === "teal" && "border-emerald-500/30",
        tone === "amber" && "border-amber-500/40",
      )}
    >
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </div>
  );
}

function Convergencia({
  item,
  link,
}: {
  item: NonNullable<SinteseResultado["lentes"][string]>["convergencia"][number];
  link: (id: string) => string | null;
}) {
  const [aberto, setAberto] = useState(false);
  const evidencias = item.evidencias?.length
    ? item.evidencias
    : item.fala_representativa
      ? [{ fonteId: item.fontes[0]?.id ?? "", fonte: item.fontes[0]?.nome ?? "", regiao: item.fontes[0]?.regiao ?? null, fala: item.fala_representativa }]
      : [];

  return (
    <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-2">
      <div className="flex items-start gap-3">
        <p className="flex-1 text-base font-medium leading-snug">{item.texto}</p>
        <Badge variant="outline" className="shrink-0 border-emerald-500/40 text-emerald-600 dark:text-emerald-400">
          {item.peso} de {item.total}
        </Badge>
      </div>
      {item.reforcada && (
        <p className="text-xs text-emerald-600 dark:text-emerald-400">Reforçada por perfis de carteira diferentes</p>
      )}
      <button
        type="button"
        onClick={() => setAberto(v => !v)}
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", aberto && "rotate-180")} />
        {aberto ? "Ocultar evidências" : `Ver evidências (${item.fontes.length} fontes)`}
      </button>
      {aberto && (
        <div className="space-y-2 pt-1">
          {evidencias.map((e, i) => (
            <div key={i} className="space-y-1">
              <Fala texto={e.fala} />
              <p className="text-[11px] text-muted-foreground pl-5">
                {e.fonte}{e.regiao ? ` · ${e.regiao}` : ""}
              </p>
            </div>
          ))}
          <Fontes refs={item.fontes} link={link} />
        </div>
      )}
    </div>
  );
}


function Vazio() {
  return <p className="text-xs text-muted-foreground">Nada nesta categoria para a lente e filtros atuais.</p>;
}

function Fala({ texto }: { texto: string }) {
  return (
    <blockquote className="flex gap-2 italic font-serif text-sm text-muted-foreground border-l-2 border-border pl-3">
      <Quote className="h-3.5 w-3.5 shrink-0 mt-1 opacity-60" />
      <span>“{texto}”</span>
    </blockquote>
  );
}

function Fontes({
  refs,
  link,
}: {
  refs: { id: string; nome: string; regiao: string | null; perfil: string | null }[];
  link: (id: string) => string | null;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {refs.map(r => {
        const href = link(r.id);
        const chip = (
          <span className="inline-flex items-center rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-muted">
            {r.nome}{r.regiao ? ` · ${r.regiao}` : ""}
          </span>
        );
        return (
          <Tooltip key={r.id}>
            <TooltipTrigger asChild>
              {href ? <Link to={href as any}>{chip}</Link> : chip}
            </TooltipTrigger>
            <TooltipContent>{r.perfil ? `Perfil da carteira: ${r.perfil}` : "Perfil da carteira não informado"}</TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}
