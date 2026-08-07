import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/EmptyState";
import { MarkdownView } from "@/components/MarkdownView";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { extractFileText } from "@/lib/sintese-file-text";
import { ExecutiveBriefV2 } from "@/components/visao-rep2/ExecutiveBriefV2";
import { LeituraIntegradaV2 } from "@/components/visao-rep2/LeituraIntegradaV2";
import { PerformanceFamiliasV2 } from "@/components/visao-rep2/PerformanceFamiliasV2";
import { adapterImmersionToExecutive } from "@/lib/visao-imersao-adapter";
import type { PerfResumo } from "@/lib/visao-rep";
import { 
  FIELD_STORE_VISIT_CHAPTERS_V1,
  FIELD_IMMERSION_CHAPTERS_V2,
  parseFieldStoreVisit,
  serializeFieldStoreVisit,
  type FieldImmersionDoc,
  type FieldImmersionChapter,
} from "@/lib/field-store-visit";
import { ArrowLeft, Compass, FileDown, FileUp, Loader2, MapPin, CalendarDays, User, Building2, MoreVertical, Trash2, MessageSquare, Mail } from "lucide-react";

export const Route = createFileRoute("/_authenticated/visao-imersao")({
  head: () => ({
    meta: [
      { title: "Visão Imersão | PoolFlux" },
      {
        name: "description",
        content: "Relatórios executivos de imersão em campo com síntese estratégica e teia de posicionamento.",
      },
      { property: "og:title", content: "Visão Imersão | PoolFlux" },
      { property: "og:description", content: "Relatórios executivos de imersão em campo com síntese estratégica e teia de posicionamento." },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "Visão Imersão | PoolFlux" },
      { name: "twitter:description", content: "Relatórios executivos de imersão em campo com síntese estratégica e teia de posicionamento." },
    ],
  }),
  component: VisaoImersaoPage,
});

type SessaoRow = {
  id: string;
  immersion_id: string | null;
  respostas: any;
  immersion: { 
    id: string; 
    titulo: string | null; 
    data_visita: string | null; 
    client_id: string | null;
    client: { 
      id: string;
      nome_fantasia: string | null;
      razao_social: string | null;
    } | null;
  } | null;
};

const fmtData = (v?: string | null) => {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? v : d.toLocaleDateString("pt-BR");
};

function MetaChip({ icon: Icon, label }: { icon: any; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border bg-background px-3 py-1 text-xs text-muted-foreground">
      <Icon className="h-3.5 w-3.5" aria-hidden /> {label}
    </span>
  );
}

function VisaoImersaoPage() {
  const [selectedId, setSelectedId] = useState<string>("");
  const [busca, setBusca] = useState("");
  const [avulso, setAvulso] = useState<{ doc: FieldImmersionDoc; arquivo: string } | null>(null);
  const [importando, setImportando] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const { data: sessoes = [], isLoading } = useQuery({
    queryKey: ["vi-sessoes"],
    queryFn: async () => {
      const { data } = await supabase
        .from("interviews")
        .select(`
          id, 
          immersion_id, 
          respostas, 
          immersion:immersions(
            id, 
            titulo, 
            data_visita, 
            client_id,
            client:clients(id, nome_fantasia, razao_social)
          )
        `)
        .not("immersion_id", "is", null)
        .order("created_at", { ascending: false });
      return ((data ?? []) as unknown as SessaoRow[]).filter(s => !!s.respostas?.__field_store_visit__);
    },
  });

  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return sessoes;
    return sessoes.filter(s =>
      `${s.immersion?.titulo ?? ""} ${s.immersion?.client?.nome_fantasia ?? ""}`.toLowerCase().includes(q),
    );
  }, [sessoes, busca]);

  const selected = useMemo(() => sessoes.find(s => s.id === selectedId) ?? null, [sessoes, selectedId]);

  // Capítulos salvos da sessão selecionada (verbatim, sem IA).
  const { data: capitulos = [], isLoading: loadingCaps } = useQuery({
    queryKey: ["vi-capitulos", selected?.id],
    enabled: !!selected?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("sessao_capitulos")
        .select("id, leitura_estrategica, sintese, capitulo:capitulos(ordem, codigo, titulo)")
        .eq("sessao_id", selected!.id);
      return ((data ?? []) as any[])
        .map(r => ({
          ordem: Number(r.capitulo?.ordem ?? 99),
          codigo: r.capitulo?.codigo || (r.sintese?.__chapter_codigo__ as string) || `C${r.capitulo?.ordem ?? 99}`,
          key: (r.sintese?.__chapter_key__ as string) || `capitulo_${r.capitulo?.ordem ?? 99}`,
          titulo: (r.sintese?.__chapter_titulo__ as string) || r.capitulo?.titulo || "Capítulo",
          markdown: String(r.leitura_estrategica ?? "").trim(),
        }))
        .filter(c => c.markdown.length > 0)
        .sort((a, b) => a.ordem - b.ordem);
    },
  });

  // Busca dados comerciais do cliente vinculado para o Gauge e Performance
  const { data: perfData } = useQuery({
    queryKey: ["vi-perf", selected?.immersion?.client_id],
    enabled: !!selected?.immersion?.client_id,
    queryFn: async () => {
      const clientId = selected!.immersion!.client_id!;
      const { data, error } = await (supabase as any)
        .from("client_bi")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (error || !data) return null;
      
      const res = (data as any).respostas;
      const bi = res?.__client_bi__;
      if (!bi) return null;
      
      return {
        geralPct: bi.geral,
        periodoLabel: bi.periodo || "Período Ativo",
        familias: (bi.familias || []).map((f: any) => ({
          familia: f.familia,
          pct: f.atingimento,
          vendas: f.vendas,
          meta: f.meta,
          status: f.status
        })),
        criticas: (bi.familias || [])
          .filter((f: any) => f.status === "Sem compra" || (f.atingimento < 50))
          .map((f: any) => ({ familia: f.familia })),
        farol: [],
        estimado: false,
        mediaGrupoPct: 0,
        diffPp: 0,
        posicao: 0,
        totalReps: 0,
        clientes: 0
      } as any;
    }
  });

  const fsv = selected?.respostas?.__field_store_visit__ ?? null;
  const meta: Record<string, string> = avulso?.doc.meta ?? fsv?.meta ?? {};
  
  // No V2, o sumário executivo pode ser o C0 (se vier de legado) ou o C1?
  // Na visão imersão, vamos manter o sumário executivo separado se existir.
  const sumario: string = avulso
    ? (avulso.doc.chapters.find(c => c.ordem === 0 || c.codigo === "C0")?.markdown ?? "")
    : (fsv?.sumario_markdown ?? "");

  const blocos = avulso
    ? avulso.doc.chapters.filter(c => c.ordem !== 0 && c.codigo !== "C0")
    : capitulos;

  const contexto = avulso ? `vi:avulso` : `vi:${selected?.id ?? "none"}`;

  async function onFile(file: File) {
    setImportando(true);
    try {
      const text = await extractFileText(file);
      const { doc, errors } = parseFieldStoreVisit(text);
      if (!doc) {
        toast.error(errors[0] ?? "Documento fora do padrão de relatório de imersão.");
        return;
      }
      setSelectedId("");
      setAvulso({ doc, arquivo: file.name });
      toast.success(`Relatório reconhecido: ${doc.chapters.length} capítulos.`);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao ler o arquivo.");
    } finally {
      setImportando(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function exportarMarkdown() {
    const doc: FieldImmersionDoc = avulso?.doc ?? {
      meta,
      chapters: [
        ...(sumario ? [{ ordem: 0, codigo: "C0", key: "sumario_executivo", titulo: "Sumário executivo", markdown: sumario }] : []),
        ...blocos.map((b: any) => ({
          ordem: b.ordem,
          codigo: b.codigo,
          key: b.key,
          titulo: b.titulo,
          markdown: b.markdown,
        })),
      ],
    };
    const blob = new Blob([serializeFieldStoreVisit(doc)], { type: "text/markdown;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `visao-imersao-${(meta["cliente"] ?? "relatorio").toLowerCase().replace(/[^a-z0-9]+/g, "-")}.md`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const aberta = !!selected || !!avulso;

  const handleExcluir = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Tem certeza que deseja excluir esta visão de imersão?")) return;

    const { error } = await supabase.from("interviews").delete().eq("id", id);
    if (error) {
      toast.error("Erro ao excluir: " + error.message);
      return;
    }

    toast.success("Visão excluída com sucesso");
    queryClient.invalidateQueries({ queryKey: ["vi-sessoes"] });
  };

  const handleCompartilharWhats = (s: SessaoRow, e: React.MouseEvent) => {
    e.stopPropagation();
    const titulo = s.immersion?.titulo || "Imersão";
    const cliente = s.immersion?.client?.nome_fantasia || "";
    const texto = `Confira a Visão Imersão de ${titulo}${cliente ? ` - ${cliente}` : ""}: ${window.location.origin}/visao-imersao?id=${s.id}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, "_blank");
  };

  const handleCompartilharEmail = (s: SessaoRow, e: React.MouseEvent) => {
    e.stopPropagation();
    const titulo = s.immersion?.titulo || "Imersão";
    const subject = `Visão Imersão: ${titulo}`;
    const body = `Confira o relatório de visão imersão acessando o link: ${window.location.origin}/visao-imersao?id=${s.id}`;
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  return (
    <div>
      <PageHeader
        title="Visão Imersão"
        subtitle="Leitura executiva e visual dos relatórios finais de imersão em campo"
        actions={
          aberta ? (
            <>
              <Button variant="outline" onClick={exportarMarkdown}>
                <FileDown className="mr-1 h-4 w-4" /> Exportar markdown
              </Button>
              <Button variant="ghost" onClick={() => { setSelectedId(""); setAvulso(null); }}>
                <ArrowLeft className="mr-1 h-4 w-4" /> Voltar à lista
              </Button>
            </>
          ) : (
            <Button onClick={() => fileRef.current?.click()} disabled={importando}>
              {importando ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <FileUp className="mr-1 h-4 w-4" />}
              Carregar relatório
            </Button>
          )
        }
      />
      <input
        ref={fileRef}
        type="file"
        accept=".md,.markdown,.txt,.pdf,.docx"
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) void onFile(f); }}
      />

      <div className="space-y-5 p-4 sm:p-8">
        {!aberta ? (
          <>
            <Input
              value={busca}
              onChange={e => setBusca(e.target.value)}
              placeholder="Buscar por imersão ou cliente..."
              className="max-w-md"
            />
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Carregando imersões...</p>
            ) : lista.length === 0 ? (
              <EmptyState
                icon={Compass}
                title="Nenhum relatório de imersão disponível"
                description="Importe o relatório final em uma imersão em campo, ou carregue um arquivo no padrão de visita a loja para visualizar aqui."
                action={
                  <Button onClick={() => fileRef.current?.click()}>
                    <FileUp className="mr-1 h-4 w-4" /> Carregar relatório
                  </Button>
                }
              />
            ) : (
              <div className="grid gap-3">
                {lista.map(s => {
                  const m = s.respostas?.__field_store_visit__?.meta ?? {};
                  return (
                    <div
                      key={s.id}
                      onClick={() => { setAvulso(null); setSelectedId(s.id); }}
                      className="group relative flex w-full items-center justify-between rounded-xl border bg-card p-5 text-left transition hover:border-primary/40 cursor-pointer"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold">{m["titulo"] || s.immersion?.titulo || "Imersão"}</div>
                        <div className="text-sm text-muted-foreground">
                          {m["cliente"] || s.immersion?.client?.nome_fantasia || "—"}
                          {m["local"] ? ` • ${m["local"]}` : ""}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex flex-col items-end gap-1">
                          {(m["data_visita"] || s.immersion?.data_visita) && (
                            <span className="text-xs text-muted-foreground">
                              {fmtData(m["data_visita"] || s.immersion?.data_visita)}
                            </span>
                          )}
                          <Badge variant="outline">Visita a loja</Badge>
                        </div>
                        
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={(e) => handleCompartilharWhats(s, e)}>
                              <MessageSquare className="mr-2 h-4 w-4" /> Compartilhar por Whats
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={(e) => handleCompartilharEmail(s, e)}>
                              <Mail className="mr-2 h-4 w-4" /> Compartilhar por Email
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              className="text-destructive focus:text-destructive"
                              onClick={(e) => handleExcluir(s.id, e)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" /> Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          <>
            <section className="rounded-xl border bg-card p-5 sm:p-6">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Relatório de imersão em campo
              </div>
              <h2 className="mt-1 text-lg font-bold tracking-tight">
                {meta["titulo"] || selected?.immersion?.titulo || avulso?.arquivo || "Visão da imersão"}
              </h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {(meta["cliente"] || selected?.immersion?.client?.nome_fantasia) && (
                  <MetaChip icon={Building2} label={meta["cliente"] || selected!.immersion!.client!.nome_fantasia!} />
                )}
                {(meta["data_visita"] || selected?.immersion?.data_visita) && (
                  <MetaChip icon={CalendarDays} label={fmtData(meta["data_visita"] || selected?.immersion?.data_visita)!} />
                )}
                {meta["local"] && <MetaChip icon={MapPin} label={meta["local"]} />}
                {meta["representante"] && <MetaChip icon={User} label={meta["representante"]} />}
                {meta["consultor"] && <MetaChip icon={User} label={meta["consultor"]} />}
              </div>
            </section>

            {(() => {
              const doc: FieldImmersionDoc = avulso?.doc ?? {
                meta,
                chapters: blocos.map((b: any) => ({
                  ordem: b.ordem,
                  codigo: b.codigo,
                  key: b.key,
                  titulo: b.titulo,
                  markdown: b.markdown,
                })),
              };
              
              const visao = adapterImmersionToExecutive(doc);

              return (
                <div className="space-y-8">
                  <ExecutiveBriefV2
                    brief={{
                      sintese: visao.executive_brief?.presidential_synthesis || "",
                      contexto: {
                        marcas: [],
                        regiaoModelo: visao.representative_context.additional_context || ""
                      },
                      clientes: [],
                      temas: [],
                      conclusoes: [],
                      decisoes: [],
                      validacoes: [],
                      perspectivas: []
                    } as any}
                    nome={meta["cliente"] || selected?.immersion?.client?.nome_fantasia || "Imersão"}
                    regiao={meta["local"] || ""}
                    mode="imersao"
                    contexto={contexto}
                    perspectivas={undefined}
                    visao={visao}
                    perf={perfData}
                  />
                  
                  {perfData && (
                    <PerformanceFamiliasV2 perf={perfData} contexto={contexto} />
                  )}
                  
                  <LeituraIntegradaV2 visao={visao} />
                  
                  {perfData && (
                    <PerformanceFamiliasV2 perf={perfData} />
                  )}

                  <section className="mt-12 space-y-4">
                    <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      Áreas de aprofundamento
                    </h3>
                    <Accordion type="single" collapsible className="w-full space-y-2">
                      <AccordionItem value="origem" className="rounded-xl border bg-card px-4">
                        <AccordionTrigger className="text-sm font-medium hover:no-underline">
                          Relatório de origem · visão executiva
                        </AccordionTrigger>
                        <AccordionContent className="pt-2 pb-4">
                          <MarkdownView markdown={doc.chapters.find(c => c.codigo === "C1")?.markdown ?? "Sem conteúdo."} />
                        </AccordionContent>
                      </AccordionItem>

                      <AccordionItem value="completo" className="rounded-xl border bg-card px-4">
                        <AccordionTrigger className="text-sm font-medium hover:no-underline">
                          Relatório completo por capítulos
                        </AccordionTrigger>
                        <AccordionContent className="space-y-6 pt-4 pb-6">
                          {doc.chapters.map(cap => (
                            <div key={cap.codigo} className="space-y-2 border-l-2 border-primary/20 pl-4">
                              <h4 className="text-sm font-bold">{cap.codigo} · {cap.titulo}</h4>
                              <MarkdownView markdown={cap.markdown} />
                            </div>
                          ))}
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                  </section>
                </div>
              );
            })()}
          </>
        )}
      </div>
    </div>
  );
}
