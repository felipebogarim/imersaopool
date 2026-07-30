import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/EmptyState";
import { LENTES, LENTE_DEF, type Lente } from "@/lib/insight-lentes";
import type { SinteseResultado } from "@/lib/sintese-engine";
import { FAROL_CELL_CLASS } from "@/lib/performance-farol";
import { RaioXRep } from "@/components/RaioXRep";
import {
  buildParaleloRep,
  buildPerfResumo,
  buildQuadroRep,
  buildRaioX,
  findFonteDoRep,
  fmtPct,
  fmtPp,
  introRaioX,
  leituraCruzada,
  type FonteLite,
  type PerfRowLite,
  type UploadLite,
} from "@/lib/visao-rep";
import { exportVisaoRepPdf } from "@/lib/visao-rep-pdf";
import { cn } from "@/lib/utils";
import { ArrowRightLeft, BarChart3, ChevronDown, ExternalLink, FileDown, ScanSearch, Sparkles, Target } from "lucide-react";


export const Route = createFileRoute("/_authenticated/visao-rep")({
  head: () => ({
    meta: [
      { title: "Visão Rep — PoolFlux" },
      { name: "description", content: "Raio-x estratégico do representante: as 8 perspectivas da entrevista, o paralelo com a síntese do grupo e a performance da carteira." },
      { property: "og:title", content: "Visão Rep — PoolFlux" },
      { property: "og:description", content: "Resumo gerencial por representante cruzando entrevista, síntese por tipo e performance." },
    ],
  }),
  component: VisaoRep,
});

function VisaoRep() {
  const [repId, setRepId] = useState<string>("");

  const { data: reps = [] } = useQuery({
    queryKey: ["visao-rep-representantes"],
    queryFn: async () =>
      (await supabase.from("representatives").select("id, nome, regiao").order("nome")).data ?? [],
  });

  const { data: fontes = [] } = useQuery({
    queryKey: ["visao-rep-fontes"],
    queryFn: async () =>
      ((
        await supabase
          .from("insight_fontes")
          .select("id, tipo, titulo, pessoa, regiao, perfil_carteira, interview_id, updated_at")
          .eq("tipo", "entrevista")
          .neq("status_processamento", "pendente")
      ).data ?? []) as FonteLite[],
  });

  const { data: uploads = [] } = useQuery({
    queryKey: ["visao-rep-uploads"],
    queryFn: async () =>
      ((
        await supabase
          .from("rep_performance_uploads")
          .select("id, representative_id, periodo_label, atingimento_geral, familias, familia_atingimento_categoria, created_at")
          .is("substituida_em", null)
          .order("created_at", { ascending: false })
      ).data ?? []) as unknown as UploadLite[],
  });

  const { data: painel } = useQuery({
    queryKey: ["visao-rep-painel"],
    queryFn: async () => {
      const { data } = await supabase
        .from("paineis_sintese")
        .select("id, versao, gerado_em, tipos_incluidos, resultado")
        .order("gerado_em", { ascending: false })
        .limit(50);
      return (data ?? []).find(p => (p.tipos_incluidos as string[]).join(",") === "entrevista") ?? null;
    },
  });

  const rep = useMemo(() => reps.find((r: any) => r.id === repId) ?? null, [reps, repId]);
  const fonte = useMemo(() => (rep ? findFonteDoRep(fontes, rep.nome) : null), [fontes, rep]);
  const upload = useMemo(() => uploads.find(u => u.representative_id === repId) ?? null, [uploads, repId]);

  const comEntrevista = useMemo(
    () => new Set(reps.filter((r: any) => findFonteDoRep(fontes, r.nome)).map((r: any) => r.id)),
    [reps, fontes],
  );

  const { data: lentesRows = [] } = useQuery({
    queryKey: ["visao-rep-lentes", fonte?.id],
    enabled: !!fonte?.id,
    queryFn: async () =>
      (
        await supabase
          .from("insight_fonte_lentes")
          .select("lente, leitura_estrategica, sintese_campos, highlights")
          .eq("fonte_id", fonte!.id)
      ).data ?? [],
  });

  const { data: perfRows = [] } = useQuery({
    queryKey: ["visao-rep-rows", upload?.id],
    enabled: !!upload?.id,
    queryFn: async () =>
      ((
        await supabase
          .from("rep_performance_rows")
          .select("categoria, metas_status, total_pct, total_pct_status")
          .eq("upload_id", upload!.id)
      ).data ?? []) as unknown as PerfRowLite[],
  });

  const quadro = useMemo(() => buildQuadroRep(lentesRows as any), [lentesRows]);
  const raiox = useMemo(() => buildRaioX(quadro), [quadro]);
  const paralelo = useMemo(
    () => buildParaleloRep((painel?.resultado as unknown as SinteseResultado) ?? null, fonte?.id ?? null, rep?.nome ?? ""),
    [painel, fonte, rep],
  );
  const perf = useMemo(
    () => buildPerfResumo({ upload, rows: perfRows, todosUploads: uploads }),
    [upload, perfRows, uploads],
  );

  return (
    <div>
      <PageHeader
        title="Visão Rep"
        subtitle="Raio-x estratégico: as 8 perspectivas da entrevista, o paralelo com a síntese do grupo e a performance da carteira."
      />

      <div className="p-4 sm:p-8 space-y-6">
        <div className="surface rounded-xl p-4 flex flex-wrap items-center gap-3">
          <label className="text-sm text-muted-foreground" htmlFor="rep-select">
            Representante
          </label>
          <div className="w-full sm:w-80">
            <Select value={repId} onValueChange={setRepId}>
              <SelectTrigger id="rep-select">
                <SelectValue placeholder="Escolha um representante" />
              </SelectTrigger>
              <SelectContent>
                {reps.map((r: any) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.nome}
                    {comEntrevista.has(r.id) ? "" : " — sem entrevista"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {rep?.regiao && <Badge variant="outline">{rep.regiao}</Badge>}
          <div className="ml-auto flex items-center gap-2">
            {fonte?.interview_id && (
              <Button variant="ghost" size="sm" asChild>
                <Link to="/entrevistas/$id" params={{ id: fonte.interview_id }}>
                  <ExternalLink className="h-4 w-4 mr-1" /> Abrir entrevista
                </Link>
              </Button>
            )}
            <Button
              size="sm"
              disabled={!rep}
              onClick={() =>
                rep &&
                exportVisaoRepPdf({
                  repNome: rep.nome,
                  regiao: rep.regiao,
                  leitura: leituraCruzada(rep.nome, paralelo, perf),
                  intro: introRaioX(rep.nome, raiox),
                  raiox,
                  paralelo,
                  perf,
                })
              }
            >
              <FileDown className="h-4 w-4 mr-1" /> Exportar relatório
            </Button>
          </div>
        </div>


        {!rep ? (
          <EmptyState
            icon={ScanSearch}
            title="Escolha um representante"
            description="Selecione um representante para ver o raio-x estratégico, o paralelo com a síntese do grupo e a performance da carteira."
          />
        ) : (
          <>
            {/* Leitura executiva */}
            <section className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-2">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" /> Leitura gerencial
              </h2>
              <p className="text-sm leading-relaxed">{leituraCruzada(rep.nome, paralelo, perf)}</p>
            </section>

            {/* Performance */}
            <section className="space-y-3">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <BarChart3 className="h-4 w-4" /> Performance da carteira
              </h2>
              {!perf ? (
                <p className="text-sm text-muted-foreground rounded-xl border bg-muted/30 px-4 py-3">
                  Nenhuma planilha de performance ativa para este representante.
                </p>
              ) : (
                <>
                  {perf.estimado && (
                    <p className="text-xs text-muted-foreground rounded-lg border border-dashed px-3 py-2">
                      Esta planilha não trouxe o atingimento consolidado: os percentuais abaixo são um índice
                      estimado a partir do farol de cada célula da matriz.
                    </p>
                  )}
                  <div className="grid gap-3 sm:grid-cols-4">
                    <Metric
                      label={`${perf.estimado ? "Índice de farol" : "Atingimento geral"} · ${perf.periodoLabel}`}
                      value={fmtPct(perf.geralPct)}
                    />
                    <Metric label="Média do grupo" value={fmtPct(perf.mediaGrupoPct)} />
                    <Metric label="Diferença" value={fmtPp(perf.diffPp)} tone={perf.diffPp != null && perf.diffPp < 0 ? "amber" : "teal"} />
                    <Metric
                      label="Posição"
                      value={perf.posicao ? `${perf.posicao}º de ${perf.totalReps}` : "—"}
                      hint={`${perf.clientes} clientes na carteira`}
                    />
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="surface rounded-xl p-4 space-y-2">
                      <p className="text-xs uppercase tracking-wider text-muted-foreground">
                        {perf.estimado ? "Famílias por índice de farol" : "Famílias por atingimento"}
                      </p>
                      <ul className="space-y-1.5">
                        {perf.familias.length === 0 && (
                          <li className="text-xs text-muted-foreground">Sem dados por família nesta planilha.</li>
                        )}
                        {perf.familias.map(f => (
                          <li key={f.familia} className="flex items-center gap-2 text-sm">
                            <span className="w-40 shrink-0 truncate">{f.familia}</span>
                            <span className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                              <span
                                className="block h-full rounded-full bg-primary"
                                style={{ width: `${Math.min(100, Math.max(2, f.pct))}%` }}
                              />
                            </span>
                            <span className="w-16 text-right tabular-nums">{fmtPct(f.pct)}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="surface rounded-xl p-4 space-y-3">
                      <p className="text-xs uppercase tracking-wider text-muted-foreground">Distribuição do farol (células)</p>
                      <div className="flex flex-wrap gap-2">
                        {perf.farol.map(f => (
                          <span key={f.status} className={cn("rounded-full px-2.5 py-1 text-xs", FAROL_CELL_CLASS[f.status])}>
                            {f.label} · {fmtPct(f.pct)}
                          </span>
                        ))}
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2 pt-1">
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Destaques</p>
                          {perf.destaques.map(f => (
                            <p key={f.familia} className="text-sm">
                              {f.familia} <span className="text-muted-foreground">{fmtPct(f.pct)}</span>
                            </p>
                          ))}
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Pontos críticos</p>
                          {perf.criticas.map(f => (
                            <p key={f.familia} className="text-sm">
                              {f.familia} <span className="text-muted-foreground">{fmtPct(f.pct)}</span>
                            </p>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </section>

            {/* Quadro das 8 perspectivas */}
            <section className="space-y-3">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <Target className="h-4 w-4" /> Raio-x da entrevista · 8 perspectivas
              </h2>
              {!fonte ? (
                <p className="text-sm text-muted-foreground rounded-xl border bg-muted/30 px-4 py-3">
                  Não há entrevista processada como fonte de insight para {rep.nome}.
                </p>
              ) : (
                <RaioXRep intro={introRaioX(rep.nome, raiox)} data={raiox} />
              )}
            </section>

            {/* Paralelo com a síntese */}
            <section className="space-y-3">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <ArrowRightLeft className="h-4 w-4" /> Paralelo com a Síntese por tipo
              </h2>
              {!paralelo ? (
                <p className="text-sm text-muted-foreground rounded-xl border bg-muted/30 px-4 py-3">
                  Nenhuma síntese de entrevistas disponível para comparação.{" "}
                  <Link to="/sintese/tipos" className="underline">
                    Gerar síntese
                  </Link>
                  .
                </p>
              ) : (
                <>
                  <div className="grid gap-3 sm:grid-cols-4">
                    <Metric
                      label="Alinhamento ao grupo"
                      value={paralelo.indiceAlinhamento == null ? "—" : fmtPct(paralelo.indiceAlinhamento)}
                      tone="teal"
                      hint={`${paralelo.totalFontes} entrevistas na base`}
                    />
                    <Metric label="Pontos sustentados" value={String(paralelo.alinhamentos)} />
                    <Metric label="Pontos cegos" value={String(paralelo.lacunas)} tone="amber" />
                    <Metric label="Divergências / únicos" value={`${paralelo.divergencias} / ${paralelo.unicos}`} />
                  </div>

                  <div className="space-y-2">
                    {paralelo.lentes.map(l => (
                      <LenteParalelo key={l.lente} lente={l} />
                    ))}
                  </div>
                </>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "neutral" | "teal" | "amber";
}) {
  return (
    <div className="surface rounded-xl p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={cn(
          "text-xl font-semibold tabular-nums",
          tone === "teal" && "text-emerald-600 dark:text-emerald-400",
          tone === "amber" && "text-amber-600 dark:text-amber-400",
        )}
      >
        {value}
      </p>
      {hint && <p className="text-[11px] text-muted-foreground mt-0.5">{hint}</p>}
    </div>
  );
}

type FocoParalelo = "alinhado" | "cegos" | "divergencias" | "unicos";

function LenteParalelo({ lente }: { lente: ReturnType<typeof buildParaleloRep> extends infer _ ? any : never }) {
  const [open, setOpen] = useState(false);
  const [foco, setFoco] = useState<FocoParalelo | null>(null);
  const total = lente.alinhado.length + lente.foraDaCurva.length + lente.divergencias.length + lente.unicos.length;
  const def = LENTE_DEF[lente.lente as Lente];

  const mostra = (k: FocoParalelo) => foco === null || foco === k;

  const chips: { key: FocoParalelo; label: string; n: number; ativo: string; base: string }[] = [
    {
      key: "alinhado",
      label: "alinhados",
      n: lente.alinhado.length,
      base: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
      ativo: "ring-2 ring-emerald-500",
    },
    {
      key: "cegos",
      label: "cegos",
      n: lente.foraDaCurva.length,
      base: "bg-muted text-muted-foreground",
      ativo: "ring-2 ring-foreground/40",
    },
    {
      key: "divergencias",
      label: "divergências",
      n: lente.divergencias.length,
      base: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
      ativo: "ring-2 ring-amber-500",
    },
    {
      key: "unicos",
      label: "únicos",
      n: lente.unicos.length,
      base: "bg-muted text-muted-foreground",
      ativo: "ring-2 ring-foreground/40",
    },
  ];

  const selecionar = (k: FocoParalelo, n: number) => {
    if (!n) return;
    setOpen(true);
    setFoco(f => (f === k ? null : k));
  };

  return (
    <div className="surface rounded-xl">
      <div className="w-full flex items-center gap-3 px-4 py-3">
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          className="flex items-center gap-3 text-left"
          aria-expanded={open}
        >
          <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
          <span className="text-sm font-medium">{def.label}</span>
        </button>
        <span className="ml-auto flex flex-wrap gap-1.5 text-[11px]">
          {chips.map(c => (
            <button
              key={c.key}
              type="button"
              onClick={() => selecionar(c.key, c.n)}
              disabled={!c.n}
              aria-pressed={foco === c.key}
              className={cn(
                "rounded-full px-2 py-0.5 transition",
                c.base,
                c.n ? "hover:opacity-80 cursor-pointer" : "opacity-50 cursor-default",
                foco === c.key && c.ativo,
              )}
            >
              {c.n} {c.label}
            </button>
          ))}
        </span>
      </div>
      {open && (
        <div className="px-4 pb-4 space-y-3 text-sm">
          {total === 0 && <p className="text-xs text-muted-foreground">Sem paralelo nesta perspectiva.</p>}
          {foco && (
            <button
              type="button"
              onClick={() => setFoco(null)}
              className="text-[11px] text-muted-foreground underline underline-offset-2"
            >
              Ver tudo
            </button>
          )}
          {mostra("alinhado") && lente.alinhado.length > 0 && (
            <Bloco titulo="Onde ele confirma o grupo" cor="text-emerald-600 dark:text-emerald-400">
              {lente.alinhado.map((i: any, k: number) => (
                <li key={k}>
                  {i.texto} <span className="text-xs text-muted-foreground">({i.peso}/{i.total} fontes)</span>
                </li>
              ))}
            </Bloco>
          )}
          {mostra("cegos") && lente.foraDaCurva.length > 0 && (
            <Bloco titulo="Consenso do grupo ausente na fala dele" cor="text-muted-foreground">
              {lente.foraDaCurva.map((i: any, k: number) => (
                <li key={k}>
                  {i.texto} <span className="text-xs text-muted-foreground">({i.peso}/{i.total} fontes)</span>
                </li>
              ))}
            </Bloco>
          )}
          {mostra("divergencias") && lente.divergencias.length > 0 && (
            <Bloco titulo="Onde ele diverge" cor="text-amber-600 dark:text-amber-400">
              {lente.divergencias.map((d: any, k: number) => (
                <li key={k}>
                  <span className="font-medium">{d.tema}:</span> {d.posicaoRep}
                  {d.outras.length > 0 && (
                    <span className="text-xs text-muted-foreground">
                      {" "}
                      · outros: {d.outras.map((o: any) => `${o.fonte} — ${o.posicao}`).join("; ")}
                    </span>
                  )}
                </li>
              ))}
            </Bloco>
          )}
          {mostra("unicos") && lente.unicos.length > 0 && (
            <Bloco titulo="Leituras exclusivas da região dele" cor="text-muted-foreground">
              {lente.unicos.map((u: any, k: number) => (
                <li key={k}>{u.texto}</li>
              ))}
            </Bloco>
          )}
        </div>
      )}
    </div>
  );
}

function Bloco({ titulo, cor, children }: { titulo: string; cor: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className={cn("text-xs font-semibold", cor)}>{titulo}</p>
      <ul className="list-disc pl-5 space-y-1">{children}</ul>
    </div>
  );
}

void LENTES;
