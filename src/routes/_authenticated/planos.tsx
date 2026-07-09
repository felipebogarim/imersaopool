import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Trash2, Calendar, GripVertical, ListChecks } from "lucide-react";
import { EmptyState, LoadingRows } from "@/components/EmptyState";
import { toast } from "sonner";


export const Route = createFileRoute("/_authenticated/planos")({
  head: () => ({ meta: [{ title: "Planos de ação — PoolFlux" }] }),
  component: PlanosPage,
});

type Status = "pendente" | "em_andamento" | "concluida" | "cancelada";
type Prioridade = "alta" | "media" | "baixa";

const COLUNAS: { key: Status; label: string; tone: string }[] = [
  { key: "pendente", label: "Pendente", tone: "bg-muted" },
  { key: "em_andamento", label: "Em andamento", tone: "bg-blue-500/10" },
  { key: "concluida", label: "Concluída", tone: "bg-emerald-500/10" },
  { key: "cancelada", label: "Cancelada", tone: "bg-destructive/10" },
];

const PRIORIDADE_VARIANT: Record<Prioridade, "destructive" | "default" | "secondary"> = {
  alta: "destructive", media: "default", baixa: "secondary",
};

function PlanosPage() {
  const qc = useQueryClient();
  const [filtro, setFiltro] = useState<"todas" | Prioridade>("todas");
  const [busca, setBusca] = useState("");
  const [responsavel, setResponsavel] = useState<string>("todos");
  const [prazoFiltro, setPrazoFiltro] = useState<"todos" | "atrasadas" | "semana" | "sem_prazo">("todos");
  const [openNovo, setOpenNovo] = useState(false);

  const { data: acoes = [], isLoading } = useQuery({
    queryKey: ["action-plans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("action_plans")
        .select("id, acao, prioridade, status, prazo, observacoes, responsavel, created_at, perspectiva_origem_id, diagnostico_id, immersion_id")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const responsaveis = useMemo(() => {
    const set = new Set<string>();
    acoes.forEach((a) => { if (a.responsavel) set.add(a.responsavel); });
    return Array.from(set).sort();
  }, [acoes]);

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const now = new Date();
    const weekEnd = new Date(); weekEnd.setDate(now.getDate() + 7);
    return acoes.filter((a) => {
      if (filtro !== "todas" && a.prioridade !== filtro) return false;
      if (responsavel !== "todos" && (a.responsavel ?? "") !== responsavel) return false;
      if (prazoFiltro === "sem_prazo" && a.prazo) return false;
      if (prazoFiltro === "atrasadas" && (!a.prazo || new Date(a.prazo) >= now || a.status === "concluida")) return false;
      if (prazoFiltro === "semana" && (!a.prazo || new Date(a.prazo) > weekEnd || new Date(a.prazo) < now)) return false;
      if (q) {
        const hay = `${a.acao ?? ""} ${a.observacoes ?? ""} ${a.responsavel ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [acoes, filtro, responsavel, prazoFiltro, busca]);

  async function moveStatus(id: string, status: Status) {
    const patch: any = { status };
    if (status === "concluida") patch.resolvido_em = new Date().toISOString();
    else patch.resolvido_em = null;
    const { error } = await supabase.from("action_plans").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["action-plans"] });
  }

  async function remove(id: string) {
    if (!confirm("Excluir esta ação?")) return;
    const { error } = await supabase.from("action_plans").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Ação removida");
    qc.invalidateQueries({ queryKey: ["action-plans"] });
  }

  const filtrosAtivos = filtro !== "todas" || responsavel !== "todos" || prazoFiltro !== "todos" || busca.trim() !== "";

  return (
    <div>
      <PageHeader
        title="Planos de ação"
        subtitle="Kanban de ações derivadas das compilações e perspectivas."
        actions={
          <Dialog open={openNovo} onOpenChange={setOpenNovo}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus className="h-4 w-4" /> Nova ação</Button>
            </DialogTrigger>
            <NovaAcaoDialog onDone={() => { setOpenNovo(false); qc.invalidateQueries({ queryKey: ["action-plans"] }); }} />
          </Dialog>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2 px-4 sm:px-8">
        <Input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por ação, observação ou responsável…"
          className="h-9 w-full sm:w-72"
        />
        <Select value={filtro} onValueChange={(v) => setFiltro(v as any)}>
          <SelectTrigger className="h-9 w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas prioridades</SelectItem>
            <SelectItem value="alta">Alta</SelectItem>
            <SelectItem value="media">Média</SelectItem>
            <SelectItem value="baixa">Baixa</SelectItem>
          </SelectContent>
        </Select>
        <Select value={responsavel} onValueChange={setResponsavel}>
          <SelectTrigger className="h-9 w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos responsáveis</SelectItem>
            {responsaveis.map((r) => (
              <SelectItem key={r} value={r}>{r}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={prazoFiltro} onValueChange={(v) => setPrazoFiltro(v as any)}>
          <SelectTrigger className="h-9 w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Qualquer prazo</SelectItem>
            <SelectItem value="atrasadas">Atrasadas</SelectItem>
            <SelectItem value="semana">Próx. 7 dias</SelectItem>
            <SelectItem value="sem_prazo">Sem prazo</SelectItem>
          </SelectContent>
        </Select>
        {filtrosAtivos && (
          <Button variant="ghost" size="sm" onClick={() => { setFiltro("todas"); setResponsavel("todos"); setPrazoFiltro("todos"); setBusca(""); }}>
            Limpar filtros
          </Button>
        )}
      </div>


      {isLoading ? (
        <div className="p-4 sm:p-8"><LoadingRows rows={5} /></div>
      ) : acoes.length === 0 ? (
        <div className="p-4 sm:p-8">
          <EmptyState
            icon={ListChecks}
            title="Nenhuma ação criada"
            description='Clique em "Nova ação" para começar seu kanban de execução.'
          />
        </div>
      ) : (

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {COLUNAS.map((col) => {
            const items = filtradas.filter((a) => a.status === col.key);
            return (
              <div key={col.key} className="rounded-lg border bg-card">
                <div className={`flex items-center justify-between rounded-t-lg px-3 py-2 ${col.tone}`}>
                  <div className="text-sm font-medium">{col.label}</div>
                  <Badge variant="outline">{items.length}</Badge>
                </div>
                <ul className="max-h-[70vh] space-y-2 overflow-auto p-2">
                  {items.length === 0 && (
                    <li className="p-3 text-xs text-muted-foreground">Sem ações.</li>
                  )}
                  {items.map((a) => (
                    <li key={a.id} className="group rounded border bg-background p-3 text-sm shadow-sm">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <div className="font-medium leading-snug">{a.acao}</div>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <Badge variant={PRIORIDADE_VARIANT[a.prioridade as Prioridade]}>{a.prioridade}</Badge>
                            {a.prazo && (
                              <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{new Date(a.prazo).toLocaleDateString("pt-BR")}</span>
                            )}
                          </div>
                          {a.observacoes && <p className="mt-2 text-xs text-muted-foreground">{a.observacoes}</p>}
                        </div>
                        <button onClick={() => remove(a.id)} className="opacity-0 transition-opacity group-hover:opacity-100" aria-label="Excluir">
                          <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                        </button>
                      </div>
                      <div className="mt-3 flex items-center gap-2">
                        <GripVertical className="h-3 w-3 text-muted-foreground" />
                        <Select value={a.status} onValueChange={(v) => moveStatus(a.id, v as Status)}>
                          <SelectTrigger className="h-7 flex-1 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {COLUNAS.map((c) => (
                              <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function NovaAcaoDialog({ onDone }: { onDone: () => void }) {
  const [acao, setAcao] = useState("");
  const [prioridade, setPrioridade] = useState<Prioridade>("media");
  const [prazo, setPrazo] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!acao.trim()) return toast.error("Descreva a ação");
    setSaving(true);
    const { error } = await supabase.from("action_plans").insert({
      acao: acao.trim(),
      prioridade,
      status: "pendente",
      prazo: prazo || null,
      observacoes: observacoes.trim() || null,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Ação criada");
    setAcao(""); setPrazo(""); setObservacoes(""); setPrioridade("media");
    onDone();
  }

  return (
    <DialogContent>
      <DialogHeader><DialogTitle>Nova ação</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Ação</label>
          <Input value={acao} onChange={(e) => setAcao(e.target.value)} placeholder="Ex: Revisar política de preço da linha X" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Prioridade</label>
            <Select value={prioridade} onValueChange={(v) => setPrioridade(v as Prioridade)}>
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
  );
}
