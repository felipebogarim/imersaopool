import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
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
import { GerarTarefaDialog } from "@/components/sintese/GerarTarefaDialog";
import { RefreshCw, Sparkles, ArrowRightLeft, Layers, ListChecks, Quote, Wand2 } from "lucide-react";
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
        <PageHeader
          title="Síntese por tipo"
          subtitle={
            painel
              ? `Última análise: ${new Date(painel.gerado_em).toLocaleString("pt-BR")} · ${(painel.fontes_incluidas as string[]).length} fontes · v${painel.versao}`
              : "Nenhuma análise gerada ainda para esta seleção."
          }
          actions={
            <>
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
          <div className="flex flex-wrap items-center gap-2">
            {FONTE_TIPOS.map(t => (
              <button
                key={t}
                type="button"
                onClick={() => toggleTipo(t)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs transition",
                  tipos.includes(t) ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted",
                )}
              >
                {TIPO_LABEL[t]}
              </button>
            ))}
            <span className="text-xs text-muted-foreground ml-1">
              {tipos.length > 1 ? <><ArrowRightLeft className="inline h-3 w-3 mr-1" />cruzamento entre universos</> : "universo isolado"}
            </span>
            <div className="ml-auto w-48">
              <Select value={regiao} onValueChange={setRegiao}>
                <SelectTrigger><SelectValue placeholder="Região" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas as regiões</SelectItem>
                  {regioes.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
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

          {!elegiveis.length ? (
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

              <div className="space-y-4">
                <Bloco titulo="Convergência" cor="teal">
                  {conv.length === 0 ? <Vazio /> : conv.map((c, i) => (
                    <div key={i} className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-2">
                      <div className="flex items-start gap-2">
                        <p className="text-sm flex-1">{c.texto}</p>
                        <Badge variant="outline" className="shrink-0">{c.peso} de {c.total}</Badge>
                        {c.reforcada && <Badge className="shrink-0">reforçada</Badge>}
                      </div>
                      {c.fala_representativa && <Fala texto={c.fala_representativa} />}
                      <Fontes refs={c.fontes} link={relatorioLink} />
                    </div>
                  ))}
                </Bloco>

                <Bloco titulo="Divergência" cor="amber">
                  {div.length === 0 ? <Vazio /> : div.map((d, i) => (
                    <div key={i} className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-4 space-y-3">
                      <p className="text-sm font-medium">{d.tema}</p>
                      {d.posicoes.map((p, j) => (
                        <div key={j} className="border-l-2 border-amber-500/50 pl-3 space-y-1">
                          <p className="text-sm">{p.posicao}</p>
                          <p className="text-xs text-muted-foreground">
                            {p.fonte}{p.regiao ? ` · ${p.regiao}` : ""}{" "}
                            {relatorioLink(p.fonteId) && (
                              <Link to={relatorioLink(p.fonteId) as any} className="underline">ver relatório</Link>
                            )}
                          </p>
                          {p.fala && <Fala texto={p.fala} />}
                        </div>
                      ))}
                    </div>
                  ))}
                </Bloco>

                <Bloco titulo="Específico da região" cor="neutral">
                  {esp.length === 0 ? <Vazio /> : esp.map((e, i) => (
                    <div key={i} className="rounded-lg border border-border bg-muted/30 p-3 flex items-start gap-2">
                      <p className="text-sm flex-1">{e.texto}</p>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {e.fonte}{e.regiao ? ` · ${e.regiao}` : ""}
                      </span>
                    </div>
                  ))}
                </Bloco>

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

function Bloco({ titulo, cor, children }: { titulo: string; cor: "teal" | "amber" | "neutral"; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2
        className={cn(
          "text-sm font-semibold",
          cor === "teal" && "text-emerald-600 dark:text-emerald-400",
          cor === "amber" && "text-amber-600 dark:text-amber-400",
          cor === "neutral" && "text-muted-foreground",
        )}
      >
        {titulo}
      </h2>
      <div className="space-y-2">{children}</div>
    </section>
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
