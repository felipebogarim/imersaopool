import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/EmptyState";
import { MarkdownView } from "@/components/MarkdownView";
import { BlocoExpansivel } from "@/components/visao-rep2/BlocoExpansivel";
import { extractFileText } from "@/lib/sintese-file-text";
import {
  FIELD_STORE_VISIT_CHAPTERS,
  parseFieldStoreVisit,
  serializeFieldStoreVisit,
  type FieldStoreVisitDoc,
} from "@/lib/field-store-visit";
import { ArrowLeft, Compass, FileDown, FileUp, Loader2, MapPin, CalendarDays, User, Building2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/visao-imersao")({
  head: () => ({
    meta: [
      { title: "Visão Imersão — PoolFlux" },
      {
        name: "description",
        content:
          "Visão Imersão: leitura visual e executiva dos relatórios finais de imersão em campo, capítulo a capítulo.",
      },
      { property: "og:title", content: "Visão Imersão — PoolFlux" },
      {
        property: "og:description",
        content: "Transforme o relatório de visita a loja em uma visão executiva navegável.",
      },
    ],
  }),
  component: VisaoImersaoPage,
});

type SessaoRow = {
  id: string;
  immersion_id: string | null;
  respostas: any;
  immersion: { id: string; titulo: string | null; data_visita: string | null; client: { nome_fantasia: string | null } | null } | null;
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
  const [avulso, setAvulso] = useState<{ doc: FieldStoreVisitDoc; arquivo: string } | null>(null);
  const [importando, setImportando] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: sessoes = [], isLoading } = useQuery({
    queryKey: ["vi-sessoes"],
    queryFn: async () => {
      const { data } = await supabase
        .from("interviews")
        .select("id, immersion_id, respostas, immersion:immersions(id, titulo, data_visita, client:clients(nome_fantasia))")
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
        .select("id, leitura_estrategica, sintese, capitulo:capitulos(ordem, titulo)")
        .eq("sessao_id", selected!.id);
      return ((data ?? []) as any[])
        .map(r => ({
          ordem: Number(r.capitulo?.ordem ?? 99),
          titulo: (r.sintese?.__chapter_titulo__ as string) || r.capitulo?.titulo || "Capítulo",
          markdown: String(r.leitura_estrategica ?? "").trim(),
        }))
        .filter(c => c.markdown.length > 0)
        .sort((a, b) => a.ordem - b.ordem);
    },
  });

  const fsv = selected?.respostas?.__field_store_visit__ ?? null;
  const meta: Record<string, string> = avulso?.doc.meta ?? fsv?.meta ?? {};
  const sumario: string = avulso
    ? (avulso.doc.chapters.find(c => c.ordem === 0)?.markdown ?? "")
    : (fsv?.sumario_markdown ?? "");

  const blocos = avulso
    ? avulso.doc.chapters
        .filter(c => c.ordem !== 0)
        .map(c => ({ ordem: c.ordem, titulo: c.titulo, markdown: c.markdown }))
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
    const doc: FieldStoreVisitDoc = avulso?.doc ?? {
      meta,
      chapters: [
        ...(sumario ? [{ ordem: 0, key: "sumario_executivo", titulo: FIELD_STORE_VISIT_CHAPTERS[0].titulo, markdown: sumario }] : []),
        ...blocos.map(b => ({
          ordem: b.ordem,
          key: FIELD_STORE_VISIT_CHAPTERS[b.ordem]?.key ?? `capitulo_${b.ordem}`,
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
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => { setAvulso(null); setSelectedId(s.id); }}
                      className="rounded-xl border bg-card p-5 text-left transition hover:border-primary/40"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-semibold">{m["titulo"] || s.immersion?.titulo || "Imersão"}</div>
                          <div className="text-sm text-muted-foreground">
                            {m["cliente"] || s.immersion?.client?.nome_fantasia || "—"}
                            {m["local"] ? ` • ${m["local"]}` : ""}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {(m["data_visita"] || s.immersion?.data_visita) && (
                            <span className="text-xs text-muted-foreground">
                              {fmtData(m["data_visita"] || s.immersion?.data_visita)}
                            </span>
                          )}
                          <Badge variant="outline">Visita a loja</Badge>
                        </div>
                      </div>
                    </button>
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

            {sumario ? (
              <BlocoExpansivel
                titulo="Sumário executivo"
                descricao="Leitura condensada da visita, verbatim do relatório final"
                contexto={contexto}
                defaultOpen
              >
                <MarkdownView markdown={sumario} />
              </BlocoExpansivel>
            ) : null}

            {loadingCaps && !avulso ? (
              <p className="text-sm text-muted-foreground">Carregando capítulos...</p>
            ) : blocos.length === 0 ? (
              <EmptyState
                icon={Compass}
                title="Sem capítulos preenchidos"
                description="Este relatório ainda não possui conteúdo nos capítulos da imersão."
              />
            ) : (
              <div className="space-y-4">
                {blocos.map(b => (
                  <BlocoExpansivel
                    key={`${b.ordem}-${b.titulo}`}
                    titulo={`${String(b.ordem).padStart(2, "0")} — ${b.titulo}`}
                    contexto={contexto}
                    defaultOpen={false}
                  >
                    <MarkdownView markdown={b.markdown} />
                  </BlocoExpansivel>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
