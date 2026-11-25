// Aba "Guia de Agenda" do portal: o representante monta a agenda de visitas (ex.: a semana) e o
// sistema gera o guia de cada cliente — resumo de performance, pontos de conversa, lembretes da
// imersão (quando houver) e a tela de metas, que pode ser compartilhada no WhatsApp.

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  CalendarDays,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  Clock,
  Loader2,
  Search,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  deslocarSemana,
  fmtData,
  hojeIso,
  ordenarVisitas,
  semanaDe,
  type VisitaAgenda,
} from "@/lib/rep-agenda";
import { repAgendaAdicionar, repAgendaRemover, repAgendaSemana } from "@/lib/rep-agenda.functions";
import { repListMetas } from "@/lib/performance-metas.functions";
import type { PortalAction } from "@/lib/rep-portal.server";
import { RepVisitaGuia } from "./RepVisitaGuia";

export function RepAgendaView({ actions }: { actions: PortalAction[] }) {
  const qc = useQueryClient();
  const semanaFn = useServerFn(repAgendaSemana);
  const removerFn = useServerFn(repAgendaRemover);
  const [ref, setRef] = useState(hojeIso());
  const semana = useMemo(() => semanaDe(ref), [ref]);
  const [addDia, setAddDia] = useState<string | null>(null);
  const [aberta, setAberta] = useState<string | null>(null);

  const key = ["rep-portal", "agenda", semana.inicio] as const;
  const { data, isLoading, error } = useQuery({
    queryKey: key,
    queryFn: () => semanaFn({ data: { inicio: semana.inicio, fim: semana.fim } }),
  });
  const visitas = useMemo(() => (data?.available ? ordenarVisitas(data.visitas) : []), [data]);

  const remover = useMutation({
    mutationFn: (id: string) => removerFn({ data: { id } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["rep-portal", "agenda"] });
      toast.info("Visita removida da agenda.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const hoje = hojeIso();
  const estaSemana = semanaDe(hoje).inicio === semana.inicio;

  return (
    <div className="space-y-6">
      <section className="rounded-xl border bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <CalendarDays className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">Guia de Agenda</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Monte sua agenda de visitas e receba, para cada cliente, o resumo de performance, os
                lembretes da imersão e a tela de metas para compartilhar no WhatsApp.
              </p>
            </div>
          </div>
          <Button size="sm" onClick={() => setAddDia(estaSemana ? hoje : semana.inicio)}>
            <CalendarPlus className="mr-1.5 h-4 w-4" /> Adicionar visita
          </Button>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 border-t pt-4">
          <Button
            size="icon"
            variant="outline"
            className="h-8 w-8"
            onClick={() => setRef(deslocarSemana(ref, -1))}
            aria-label="Semana anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[180px] text-center text-sm font-semibold tabular-nums">
            {fmtData(semana.inicio).slice(0, 5)} a {fmtData(semana.fim)}
          </span>
          <Button
            size="icon"
            variant="outline"
            className="h-8 w-8"
            onClick={() => setRef(deslocarSemana(ref, 1))}
            aria-label="Próxima semana"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          {!estaSemana && (
            <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setRef(hoje)}>
              Esta semana
            </Button>
          )}
          <span className="ml-auto text-xs text-muted-foreground">
            {visitas.length} visita(s) na semana
          </span>
        </div>
      </section>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando agenda…</p>
      ) : error ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
          {error instanceof Error ? error.message : "Não foi possível carregar a agenda."}
        </p>
      ) : data && !data.available ? (
        <p className="rounded-md border bg-background p-4 text-sm text-muted-foreground">
          O Guia de Agenda estará disponível em breve.
        </p>
      ) : (
        <div className="space-y-3">
          {semana.dias.map((d) => {
            const doDia = visitas.filter((v) => v.data === d.data);
            const fimDeSemana = d.label.startsWith("Sábado") || d.label.startsWith("Domingo");
            if (fimDeSemana && doDia.length === 0) return null;
            return (
              <div
                key={d.data}
                className={cn(
                  "rounded-xl border bg-card shadow-sm",
                  d.data === hoje && "border-primary/50 ring-1 ring-primary/20",
                )}
              >
                <div className="flex items-center justify-between border-b px-4 py-2.5">
                  <p className="text-sm font-semibold">
                    {d.label}
                    {d.data === hoje && (
                      <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                        Hoje
                      </span>
                    )}
                  </p>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs text-primary"
                    onClick={() => setAddDia(d.data)}
                  >
                    <CalendarPlus className="mr-1 h-3.5 w-3.5" /> Visita
                  </Button>
                </div>
                {doDia.length === 0 ? (
                  <p className="px-4 py-3 text-xs text-muted-foreground">Nenhuma visita.</p>
                ) : (
                  <ul className="divide-y">
                    {doDia.map((v) => (
                      <VisitaLinha
                        key={v.id}
                        v={v}
                        aberta={aberta === v.id}
                        onToggle={() => setAberta(aberta === v.id ? null : v.id)}
                        onRemover={() => {
                          if (confirm(`Remover a visita a ${v.cliente}?`)) remover.mutate(v.id);
                        }}
                        actions={actions}
                      />
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}

      <AdicionarVisitaDialog dia={addDia} onClose={() => setAddDia(null)} />
    </div>
  );
}

function VisitaLinha({
  v,
  aberta,
  onToggle,
  onRemover,
  actions,
}: {
  v: VisitaAgenda;
  aberta: boolean;
  onToggle: () => void;
  onRemover: () => void;
  actions: PortalAction[];
}) {
  return (
    <li>
      <div className="flex items-center gap-3 px-4 py-3">
        <span className="flex w-14 shrink-0 items-center gap-1 text-xs font-semibold tabular-nums text-muted-foreground">
          <Clock className="h-3 w-3" />
          {v.hora ?? "—"}
        </span>
        <button type="button" onClick={onToggle} className="min-w-0 flex-1 text-left">
          <p className="truncate text-sm font-semibold">{v.cliente}</p>
          {v.objetivo && <p className="truncate text-xs text-muted-foreground">{v.objetivo}</p>}
        </button>
        <Button
          size="sm"
          variant={aberta ? "default" : "outline"}
          className="h-8 text-xs"
          onClick={onToggle}
        >
          {aberta ? "Fechar guia" : "Ver guia da visita"}
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8 text-muted-foreground"
          onClick={onRemover}
          aria-label="Remover visita"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      {aberta && (
        <div className="border-t bg-muted/20 px-4 py-4">
          {v.rowId ? (
            <RepVisitaGuia visita={v} rowId={v.rowId} actions={actions} />
          ) : (
            <p className="text-xs text-muted-foreground">
              Este cliente não está mais na carteira de performance; o guia não pode ser gerado.
            </p>
          )}
        </div>
      )}
    </li>
  );
}

function AdicionarVisitaDialog({ dia, onClose }: { dia: string | null; onClose: () => void }) {
  const qc = useQueryClient();
  const listFn = useServerFn(repListMetas);
  const addFn = useServerFn(repAgendaAdicionar);
  const [data, setData] = useState("");
  const [hora, setHora] = useState("");
  const [objetivo, setObjetivo] = useState("");
  const [busca, setBusca] = useState("");
  const [sel, setSel] = useState<string[]>([]);
  const [lastDia, setLastDia] = useState<string | null>(null);
  if (dia !== lastDia) {
    setLastDia(dia);
    if (dia) {
      setData(dia);
      setHora("");
      setObjetivo("");
      setBusca("");
      setSel([]);
    }
  }

  const { data: carteira = [], isLoading } = useQuery({
    queryKey: ["rep-metas-lista"],
    queryFn: () => listFn(),
    enabled: !!dia,
  });
  const visiveis = useMemo(() => {
    const q = busca.trim().toLocaleLowerCase("pt-BR");
    return q ? carteira.filter((c) => c.cliente.toLocaleLowerCase("pt-BR").includes(q)) : carteira;
  }, [carteira, busca]);

  const mut = useMutation({
    mutationFn: () =>
      addFn({
        data: { rowIds: sel, data, hora: hora || null, objetivo: objetivo.trim() || null },
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["rep-portal", "agenda"] });
      toast.success(sel.length > 1 ? `${sel.length} visitas agendadas.` : "Visita agendada.");
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={!!dia} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Adicionar visita</DialogTitle>
          <DialogDescription>
            Escolha um ou mais clientes da sua carteira. O guia de cada visita é gerado
            automaticamente.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Data *</Label>
            <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Horário</Label>
            <Input type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Clientes *</Label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar cliente"
              className="pl-8"
            />
          </div>
          <div className="max-h-56 overflow-y-auto rounded-md border">
            {isLoading ? (
              <p className="p-3 text-xs text-muted-foreground">Carregando carteira…</p>
            ) : visiveis.length === 0 ? (
              <p className="p-3 text-xs text-muted-foreground">Nenhum cliente encontrado.</p>
            ) : (
              visiveis.map((c) => (
                <label
                  key={c.rowId}
                  className="flex cursor-pointer items-center gap-2 border-b px-3 py-2 text-sm last:border-b-0 hover:bg-muted/50"
                >
                  <Checkbox
                    checked={sel.includes(c.rowId)}
                    onCheckedChange={(v) =>
                      setSel((s) => (v ? [...s, c.rowId] : s.filter((x) => x !== c.rowId)))
                    }
                  />
                  <span className="min-w-0 flex-1 truncate">{c.cliente}</span>
                  {c.categoria && (
                    <span className="text-[10px] font-semibold text-muted-foreground">
                      {c.categoria}
                    </span>
                  )}
                </label>
              ))
            )}
          </div>
          {sel.length > 0 && (
            <p className="text-[11px] text-muted-foreground">{sel.length} selecionado(s)</p>
          )}
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Objetivo da visita</Label>
          <Textarea
            value={objetivo}
            onChange={(e) => setObjetivo(e.target.value)}
            placeholder="Ex.: apresentar lançamento, negociar reposição…"
            className="min-h-[64px]"
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={() => mut.mutate()}
            disabled={!data || sel.length === 0 || mut.isPending}
          >
            {mut.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            Agendar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
