import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, X, ExternalLink, Download, Lightbulb, ListPlus } from "lucide-react";
import { EmptyState, LoadingRows } from "@/components/EmptyState";

import { exportPerspectivasCsv } from "@/lib/export-compilation";

import { toast } from "sonner";
import { useMemo, useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";


export const Route = createFileRoute("/_authenticated/perspectivas")({
  head: () => ({ meta: [{ title: "Perspectivas — PoolFlux" }] }),
  component: PerspectivasPage,
});

const STATUS_TABS = [
  { value: "ia_sugerida", label: "Sugeridas pela IA" },
  { value: "em_revisao", label: "Em revisão" },
  { value: "aprovada", label: "Aprovadas" },
  { value: "descartada", label: "Descartadas" },
] as const;

const LENTES = [
  "percepcao_marca","mix","concorrencia","argumento","decisao",
  "familias","promo_comercial","oportunidade","ameaca","cuidado",
] as const;

type Escopo = "todos" | "cliente" | "familia" | "empresa" | "competidor";

function PerspectivasPage() {
  const [tab, setTab] = useState<(typeof STATUS_TABS)[number]["value"]>("ia_sugerida");
  const [escopoTipo, setEscopoTipo] = useState<Escopo>("todos");
  const [escopoRefId, setEscopoRefId] = useState<string>("todos");
  const [lente, setLente] = useState<string>("todas");
  const [acaoFor, setAcaoFor] = useState<any | null>(null);
  const qc = useQueryClient();


  const { data: clients = [] } = useQuery({
    queryKey: ["clients-min-persp"],
    queryFn: async () =>
      (await supabase.from("clients").select("id, nome_fantasia").order("nome_fantasia").limit(1000)).data ?? [],
  });
  const { data: familias = [] } = useQuery({
    queryKey: ["familias-min-persp"],
    queryFn: async () =>
      (await supabase.from("familias_produto").select("id, nome, nivel").order("nome").limit(1000)).data ?? [],
  });

  const { data = [], isLoading } = useQuery({
    queryKey: ["perspectivas", tab, escopoTipo, escopoRefId, lente],
    queryFn: async () => {
      let q = supabase
        .from("perspectivas")
        .select("id, lente, escopo_tipo, escopo_ref_id, conteudo, origem, status, created_at, sessao_id, sessao_capitulo_id, capitulo_id")
        .eq("status", tab)
        .order("created_at", { ascending: false })
        .limit(500);
      if (escopoTipo !== "todos") q = q.eq("escopo_tipo", escopoTipo as any);
      if (escopoRefId !== "todos" && escopoTipo !== "empresa" && escopoTipo !== "todos") {
        q = q.eq("escopo_ref_id", escopoRefId);
      }
      if (lente !== "todas") q = q.eq("lente", lente as any);
      return (await q).data ?? [];
    },
  });

  const grouped = useMemo(() => {
    const g: Record<string, any[]> = {};
    for (const p of data) {
      (g[p.lente] ??= []).push(p);
    }
    return g;
  }, [data]);

  async function updateStatus(id: string, status: "aprovada" | "descartada" | "em_revisao") {
    const { data: u } = await supabase.auth.getUser();
    const patch: any = { status };
    if (status === "aprovada") {
      patch.aprovada_por = u.user?.id;
      patch.aprovada_em = new Date().toISOString();
    }
    const { error } = await supabase.from("perspectivas").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Atualizado");
    qc.invalidateQueries({ queryKey: ["perspectivas"] });
  }

  const showRefFilter = escopoTipo === "cliente" || escopoTipo === "familia";

  return (
    <div>
      <PageHeader title="Perspectivas" subtitle="Revisão humana das leituras geradas a partir das sessões" />
      <div className="p-8 space-y-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="min-w-[160px]">
            <label className="mb-1 block text-xs text-muted-foreground">Escopo</label>
            <Select value={escopoTipo} onValueChange={(v) => { setEscopoTipo(v as Escopo); setEscopoRefId("todos"); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="cliente">Cliente</SelectItem>
                <SelectItem value="familia">Família</SelectItem>
                <SelectItem value="empresa">Empresa</SelectItem>
                <SelectItem value="competidor">Competidor</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {showRefFilter && (
            <div className="min-w-[220px]">
              <label className="mb-1 block text-xs text-muted-foreground">Referência</label>
              <Select value={escopoRefId} onValueChange={setEscopoRefId}>
                <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {(escopoTipo === "cliente" ? clients : familias).map((r: any) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.nome_fantasia ?? r.nome}{r.nivel ? ` (${r.nivel})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="min-w-[180px]">
            <label className="mb-1 block text-xs text-muted-foreground">Lente</label>
            <Select value={lente} onValueChange={setLente}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                {LENTES.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="ml-auto">
            <Button
              size="sm"
              variant="outline"
              className="gap-1"
              disabled={data.length === 0}
              onClick={() => exportPerspectivasCsv(data, `perspectivas-${tab}`)}
            >
              <Download className="h-4 w-4" /> Exportar CSV
            </Button>
          </div>
        </div>


        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <TabsList>
            {STATUS_TABS.map((s) => (
              <TabsTrigger key={s.value} value={s.value}>{s.label}</TabsTrigger>
            ))}
          </TabsList>

          {STATUS_TABS.map((s) => (
            <TabsContent key={s.value} value={s.value} className="mt-6">
              {isLoading ? (
                <LoadingRows rows={4} />
              ) : data.length === 0 ? (
                <EmptyState
                  icon={Lightbulb}
                  title="Nada aqui ainda"
                  description="Ajuste os filtros ou gere novas perspectivas a partir das sessões de entrevista."
                />
              ) : (

                <div className="space-y-6">
                  {Object.entries(grouped).map(([lenteKey, items]) => (
                    <section key={lenteKey}>
                      <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                        <Badge variant="outline">{lenteKey}</Badge>
                        <span className="text-muted-foreground text-xs">{items.length}</span>
                      </h3>
                      <div className="grid gap-3 md:grid-cols-2">
                        {items.map((p: any) => (
                          <article key={p.id} className="surface rounded-xl p-4">
                            <header className="flex items-center gap-2 mb-2 flex-wrap">
                              <Badge variant="secondary">{p.escopo_tipo}</Badge>
                              <span className="text-xs text-muted-foreground">{p.origem ?? "—"}</span>
                              <span className="text-xs text-muted-foreground ml-auto">
                                {new Date(p.created_at).toLocaleDateString("pt-BR")}
                              </span>
                            </header>
                            <div className="space-y-1.5">
                              {Object.entries(p.conteudo ?? {}).map(([k, v]) => (
                                <div key={k} className="text-sm">
                                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono">{k}</span>
                                  <p className="whitespace-pre-wrap">{String(v ?? "")}</p>
                                </div>
                              ))}
                            </div>
                            <div className="flex items-center gap-2 mt-3 pt-2 border-t border-border">
                              {p.sessao_id && (
                                <Button asChild size="sm" variant="ghost" className="h-7 px-2">
                                  <Link to="/entrevistas/$id/sessao" params={{ id: p.sessao_id }}>
                                    <ExternalLink className="h-3 w-3 mr-1" /> Sessão
                                  </Link>
                                </Button>
                              )}
                              {tab === "aprovada" && (
                                <Button size="sm" variant="outline" className="ml-auto" onClick={() => setAcaoFor(p)}>
                                  <ListPlus className="h-4 w-4 mr-1" /> Criar ação
                                </Button>
                              )}
                              {tab !== "aprovada" && tab !== "descartada" && (
                                <div className="flex gap-2 ml-auto">
                                  <Button size="sm" variant="outline" onClick={() => updateStatus(p.id, "descartada")}>
                                    <X className="h-4 w-4 mr-1" /> Descartar
                                  </Button>
                                  <Button size="sm" onClick={() => updateStatus(p.id, "aprovada")}>
                                    <Check className="h-4 w-4 mr-1" /> Aprovar
                                  </Button>
                                </div>
                              )}
                            </div>
                          </article>
                        ))}

                      </div>
                    </section>
                  ))}
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </div>
      <CriarAcaoDialog perspectiva={acaoFor} onClose={() => setAcaoFor(null)} />
    </div>
  );

}

function CriarAcaoDialog({ perspectiva, onClose }: { perspectiva: any | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [acao, setAcao] = useState("");
  const [prioridade, setPrioridade] = useState<"alta" | "media" | "baixa">("media");
  const [prazo, setPrazo] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [saving, setSaving] = useState(false);

  const open = !!perspectiva;

  useMemo(() => {
    if (!perspectiva) return;
    const first = Object.values(perspectiva.conteudo ?? {})[0];
    setAcao(first ? String(first).slice(0, 200) : "");
    setPrioridade(
      perspectiva.lente === "ameaca" ? "alta" :
      perspectiva.lente === "oportunidade" ? "media" : "baixa",
    );
    setPrazo("");
    setObservacoes(`Origem: perspectiva (${perspectiva.lente} / ${perspectiva.escopo_tipo})`);
  }, [perspectiva?.id]);

  async function save() {
    if (!perspectiva) return;
    if (!acao.trim()) return toast.error("Descreva a ação");
    setSaving(true);
    const { error } = await supabase.from("action_plans").insert({
      acao: acao.trim(),
      prioridade,
      status: "pendente",
      prazo: prazo || null,
      observacoes: observacoes.trim() || null,
      perspectiva_origem_id: perspectiva.id,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Ação criada");
    qc.invalidateQueries({ queryKey: ["action-plans"] });
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Criar ação a partir da perspectiva</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Ação</label>
            <Input value={acao} onChange={(e) => setAcao(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Prioridade</label>
              <Select value={prioridade} onValueChange={(v) => setPrioridade(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="alta">Alta</SelectItem>
                  <SelectItem value="media">Média</SelectItem>
                  <SelectItem value="baixa">Baixa</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Prazo</label>
              <Input type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Observações</label>
            <Textarea rows={3} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={save} disabled={saving}>{saving ? "Salvando..." : "Criar ação"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

