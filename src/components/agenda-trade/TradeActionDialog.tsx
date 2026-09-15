import { useEffect, useMemo, useState } from "react";
import { Loader2, Paperclip, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { deleteAction, saveAction, uploadComprovante, comprovanteUrl } from "@/lib/agenda-trade-data";
import type {
  InvestmentDraft,
  TradeAction,
  TradeCategory,
  TradeCostCenter,
  TradeStatus,
  TradeTrip,
} from "@/lib/agenda-trade-types";
import { TRADE_ACTION_TYPES, TRADE_STATUS, brl, parseValor } from "@/lib/agenda-trade-types";
import type { AgendaUser } from "@/lib/agenda-types";
import type { KanbanClientRow } from "@/lib/kanban-clients";
import type { KanbanRepRow } from "@/lib/kanban-reps";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  action: TradeAction | null;
  initialDate: string;
  clients: KanbanClientRow[];
  users: AgendaUser[];
  reps: KanbanRepRow[];
  categories: TradeCategory[];
  costCenters: TradeCostCenter[];
  trips: TradeTrip[];
  onSaved: () => void;
};

const NONE = "__none__";

function clientLabel(client: KanbanClientRow) {
  return client.nome_fantasia || client.razao_social || "Cliente";
}

function emptyInvestment(date: string): InvestmentDraft {
  return {
    descricao: "",
    category_id: null,
    cost_center_id: null,
    data: date,
    valor_planejado: "",
    valor_realizado: "",
    status: "planejado",
    observacao: "",
    anexo_path: null,
    rateado: false,
    rateio_client_ids: [],
  };
}

export function TradeActionDialog({
  open,
  onOpenChange,
  action,
  initialDate,
  clients,
  users,
  reps,
  categories,
  costCenters,
  trips,
  onSaved,
}: Props) {
  const [clientIds, setClientIds] = useState<string[]>([]);
  const [clientSearch, setClientSearch] = useState("");
  const [tipo, setTipo] = useState<string>(TRADE_ACTION_TYPES[0]);
  const [tipoOutro, setTipoOutro] = useState("");
  const [descricao, setDescricao] = useState("");
  const [dataInicio, setDataInicio] = useState(initialDate);
  const [dataFim, setDataFim] = useState("");
  const [horario, setHorario] = useState("");
  const [cidade, setCidade] = useState("");
  const [status, setStatus] = useState<TradeStatus>("planejado");
  const [responsavel, setResponsavel] = useState<string | null>(null);
  const [representante, setRepresentante] = useState<string | null>(null);
  const [centroCusto, setCentroCusto] = useState<string | null>(null);
  const [tripId, setTripId] = useState<string | null>(null);
  const [investments, setInvestments] = useState<InvestmentDraft[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setClientSearch("");
    if (action) {
      setClientIds((action.clients ?? []).map((c) => c.client_id));
      setTipo(action.tipo_acao);
      setTipoOutro(action.tipo_acao_outro ?? "");
      setDescricao(action.descricao ?? "");
      setDataInicio(action.data_inicio);
      setDataFim(action.data_fim ?? "");
      setHorario(action.horario ?? "");
      setCidade(action.cidade ?? "");
      setStatus(action.status);
      setResponsavel(action.responsavel_id);
      setRepresentante(action.representative_id);
      setCentroCusto(action.cost_center_id);
      setTripId(action.trip_id);
      setInvestments(
        (action.investments ?? []).map((inv) => ({
          id: inv.id,
          descricao: inv.descricao,
          category_id: inv.category_id,
          cost_center_id: inv.cost_center_id,
          data: inv.data,
          valor_planejado: String(inv.valor_planejado ?? ""),
          valor_realizado: inv.valor_realizado === null || inv.valor_realizado === undefined ? "" : String(inv.valor_realizado),
          status: inv.status,
          observacao: inv.observacao ?? "",
          anexo_path: inv.anexo_path,
          rateado: inv.rateado,
          rateio_client_ids: (inv.allocations ?? []).map((a) => a.client_id),
        })),
      );
    } else {
      setClientIds([]);
      setTipo(TRADE_ACTION_TYPES[0]);
      setTipoOutro("");
      setDescricao("");
      setDataInicio(initialDate);
      setDataFim("");
      setHorario("");
      setCidade("");
      setStatus("planejado");
      setResponsavel(null);
      setRepresentante(null);
      setCentroCusto(null);
      setTripId(null);
      setInvestments([]);
    }
  }, [action, initialDate, open]);

  const filteredClients = useMemo(() => {
    const term = clientSearch.trim().toLowerCase();
    if (!term) return clients;
    return clients.filter((client) =>
      `${client.nome_fantasia ?? ""} ${client.razao_social ?? ""}`.toLowerCase().includes(term),
    );
  }, [clientSearch, clients]);

  const clientNameById = useMemo(() => new Map(clients.map((c) => [c.id, clientLabel(c)])), [clients]);

  const totals = useMemo(() => {
    return investments.reduce(
      (acc, inv) => {
        acc.planejado += parseValor(inv.valor_planejado);
        acc.realizado += parseValor(inv.valor_realizado);
        return acc;
      },
      { planejado: 0, realizado: 0 },
    );
  }, [investments]);

  function updateInvestment(index: number, patch: Partial<InvestmentDraft>) {
    setInvestments((list) => list.map((inv, i) => (i === index ? { ...inv, ...patch } : inv)));
  }

  async function handleUpload(index: number, file: File) {
    try {
      const path = await uploadComprovante(file);
      updateInvestment(index, { anexo_path: path });
      toast.success("Comprovante anexado.");
    } catch {
      toast.error("Não foi possível anexar o comprovante.");
    }
  }

  async function openComprovante(path: string) {
    const url = await comprovanteUrl(path);
    if (url) window.open(url, "_blank", "noopener");
    else toast.error("Não foi possível abrir o comprovante.");
  }

  async function handleSave() {
    if (clientIds.length === 0) {
      toast.error("Selecione pelo menos um cliente.");
      return;
    }
    if (tipo === "Outro" && !tipoOutro.trim()) {
      toast.error("Descreva o tipo de ação.");
      return;
    }
    if (!dataInicio) {
      toast.error("Informe a data inicial.");
      return;
    }
    setSaving(true);
    try {
      await saveAction({
        id: action?.id,
        trip_id: tripId,
        tipo_acao: tipo,
        tipo_acao_outro: tipo === "Outro" ? tipoOutro.trim() : null,
        descricao: descricao.trim() || null,
        data_inicio: dataInicio,
        data_fim: dataFim || null,
        horario: horario || null,
        cidade: cidade.trim() || null,
        status,
        responsavel_id: responsavel,
        representative_id: representante,
        cost_center_id: centroCusto,
        clientIds,
        investments: investments.filter((inv) => inv.descricao.trim()),
      });
      toast.success(action ? "Ação atualizada." : "Ação criada.");
      onSaved();
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar a ação.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!action) return;
    setSaving(true);
    try {
      await deleteAction(action.id);
      toast.success("Ação excluída.");
      onSaved();
      onOpenChange(false);
    } catch {
      toast.error("Não foi possível excluir a ação.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{action ? "Editar ação de trade" : "Nova ação de trade"}</DialogTitle>
          <DialogDescription>Cliente, tipo, data e investimentos da ação.</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-2">
            <Label>Clientes</Label>
            <Input
              placeholder="Buscar cliente…"
              value={clientSearch}
              onChange={(event) => setClientSearch(event.target.value)}
            />
            {clientIds.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {clientIds.map((id) => (
                  <Badge key={id} variant="secondary" className="gap-1">
                    {clientNameById.get(id) ?? "Cliente"}
                    <button type="button" onClick={() => setClientIds((ids) => ids.filter((v) => v !== id))}>
                      ×
                    </button>
                  </Badge>
                ))}
              </div>
            )}
            <ScrollArea className="h-40 rounded-md border">
              <div className="p-2">
                {filteredClients.map((client) => (
                  <label key={client.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent">
                    <Checkbox
                      checked={clientIds.includes(client.id)}
                      onCheckedChange={(checked) =>
                        setClientIds((ids) => (checked ? [...new Set([...ids, client.id])] : ids.filter((v) => v !== client.id)))
                      }
                    />
                    <span className="truncate">{clientLabel(client)}</span>
                  </label>
                ))}
                {filteredClients.length === 0 && <p className="p-2 text-sm text-muted-foreground">Nenhum cliente encontrado.</p>}
              </div>
            </ScrollArea>
            <p className="text-xs text-muted-foreground">
              Mostrando {filteredClients.length} de {clients.length} clientes
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Tipo de ação</Label>
              <Select value={tipo} onValueChange={setTipo}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent className="max-h-72">
                  {TRADE_ACTION_TYPES.map((item) => (
                    <SelectItem key={item} value={item}>{item}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {tipo === "Outro" && (
                <Input placeholder="Descreva o tipo de ação" value={tipoOutro} onChange={(e) => setTipoOutro(e.target.value)} />
              )}
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={(value) => setStatus(value as TradeStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TRADE_STATUS.map((item) => (
                    <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Data inicial</Label>
              <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Data final (opcional)</Label>
              <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Horário (opcional)</Label>
              <Input type="time" value={horario} onChange={(e) => setHorario(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Cidade</Label>
              <Input value={cidade} onChange={(e) => setCidade(e.target.value)} placeholder="Cidade da ação" />
            </div>
            <div className="space-y-2">
              <Label>Responsável</Label>
              <Select value={responsavel ?? NONE} onValueChange={(value) => setResponsavel(value === NONE ? null : value)}>
                <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value={NONE}>Sem responsável</SelectItem>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>{user.full_name || user.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Representante</Label>
              <Select value={representante ?? NONE} onValueChange={(value) => setRepresentante(value === NONE ? null : value)}>
                <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value={NONE}>Sem representante</SelectItem>
                  {reps.map((rep) => (
                    <SelectItem key={rep.id} value={rep.id}>{rep.nome ?? "Representante"}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Centro de custo</Label>
              <Select value={centroCusto ?? NONE} onValueChange={(value) => setCentroCusto(value === NONE ? null : value)}>
                <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value={NONE}>Sem centro de custo</SelectItem>
                  {costCenters.filter((cc) => cc.ativo).map((cc) => (
                    <SelectItem key={cc.id} value={cc.id}>{cc.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Viagem de trade</Label>
              <Select value={tripId ?? NONE} onValueChange={(value) => setTripId(value === NONE ? null : value)}>
                <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value={NONE}>Sem viagem</SelectItem>
                  {trips.map((trip) => (
                    <SelectItem key={trip.id} value={trip.id}>{trip.titulo}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Descrição da ação</Label>
            <Textarea rows={3} value={descricao} onChange={(e) => setDescricao(e.target.value)} />
          </div>

          <Separator />

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wide">Investimentos</h3>
                <p className="text-xs text-muted-foreground">
                  Planejado {brl(totals.planejado)} · Realizado {brl(totals.realizado)}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setInvestments((list) => [...list, emptyInvestment(dataInicio)])}
              >
                <Plus /> Adicionar investimento
              </Button>
            </div>

            {investments.map((inv, index) => {
              const category = categories.find((c) => c.id === inv.category_id);
              const rateavel = Boolean(category?.rateavel);
              const participantes = inv.rateado ? inv.rateio_client_ids.length : 0;
              return (
                <div key={index} className="space-y-3 rounded-lg border bg-muted/20 p-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label className="text-xs">Descrição</Label>
                      <Input value={inv.descricao} onChange={(e) => updateInvestment(index, { descricao: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Categoria</Label>
                      <Select
                        value={inv.category_id ?? NONE}
                        onValueChange={(value) =>
                          updateInvestment(index, {
                            category_id: value === NONE ? null : value,
                            rateado: value === NONE ? false : inv.rateado,
                          })
                        }
                      >
                        <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                        <SelectContent className="max-h-72">
                          <SelectItem value={NONE}>Sem categoria</SelectItem>
                          {categories.filter((c) => c.ativo).map((c) => (
                            <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Centro de custo</Label>
                      <Select
                        value={inv.cost_center_id ?? centroCusto ?? NONE}
                        onValueChange={(value) => updateInvestment(index, { cost_center_id: value === NONE ? null : value })}
                      >
                        <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                        <SelectContent className="max-h-72">
                          <SelectItem value={NONE}>Sem centro de custo</SelectItem>
                          {costCenters.filter((cc) => cc.ativo).map((cc) => (
                            <SelectItem key={cc.id} value={cc.id}>{cc.nome}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Data</Label>
                      <Input type="date" value={inv.data ?? ""} onChange={(e) => updateInvestment(index, { data: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Status</Label>
                      <Select value={inv.status} onValueChange={(value) => updateInvestment(index, { status: value })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="planejado">Planejado</SelectItem>
                          <SelectItem value="realizado">Realizado</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Valor planejado</Label>
                      <Input
                        inputMode="decimal"
                        placeholder="0,00"
                        value={inv.valor_planejado}
                        onChange={(e) => updateInvestment(index, { valor_planejado: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Valor realizado</Label>
                      <Input
                        inputMode="decimal"
                        placeholder="0,00"
                        value={inv.valor_realizado}
                        onChange={(e) => updateInvestment(index, { valor_realizado: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label className="text-xs">Observação</Label>
                      <Input value={inv.observacao} onChange={(e) => updateInvestment(index, { observacao: e.target.value })} />
                    </div>
                  </div>

                  {rateavel && (
                    <div className="space-y-2 rounded-md border border-dashed p-3">
                      <p className="text-xs font-medium">Esta despesa deve ser rateada entre outros clientes?</p>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant={inv.rateado ? "outline" : "default"}
                          onClick={() => updateInvestment(index, { rateado: false, rateio_client_ids: [] })}
                        >
                          Não
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant={inv.rateado ? "default" : "outline"}
                          onClick={() => updateInvestment(index, { rateado: true, rateio_client_ids: [...new Set([...inv.rateio_client_ids, ...clientIds])] })}
                        >
                          Sim
                        </Button>
                      </div>
                      {inv.rateado && (
                        <>
                          <ScrollArea className="h-32 rounded-md border bg-background">
                            <div className="p-2">
                              {(clientSearch ? filteredClients : clients.slice(0, 120)).map((client) => (
                                <label key={client.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-accent">
                                  <Checkbox
                                    checked={inv.rateio_client_ids.includes(client.id)}
                                    onCheckedChange={(checked) =>
                                      updateInvestment(index, {
                                        rateio_client_ids: checked
                                          ? [...new Set([...inv.rateio_client_ids, client.id])]
                                          : inv.rateio_client_ids.filter((id) => id !== client.id),
                                      })
                                    }
                                  />
                                  <span className="truncate">{clientLabel(client)}</span>
                                </label>
                              ))}
                            </div>
                          </ScrollArea>
                          <p className="text-xs text-muted-foreground">
                            Valor total {brl(parseValor(inv.valor_realizado) || parseValor(inv.valor_planejado))} ÷ {participantes || 1} cliente
                            {participantes === 1 ? "" : "s"} ={" "}
                            <strong>
                              {brl((parseValor(inv.valor_realizado) || parseValor(inv.valor_planejado)) / (participantes || 1))}
                            </strong>{" "}
                            por cliente. O consolidado da empresa continua contando o valor total uma única vez.
                          </p>
                        </>
                      )}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Button type="button" variant="outline" size="sm" asChild>
                        <label className="cursor-pointer">
                          <Paperclip /> Comprovante
                          <input
                            type="file"
                            className="hidden"
                            onChange={(event) => {
                              const file = event.target.files?.[0];
                              if (file) void handleUpload(index, file);
                              event.target.value = "";
                            }}
                          />
                        </label>
                      </Button>
                      {inv.anexo_path && (
                        <Button type="button" variant="link" size="sm" onClick={() => void openComprovante(inv.anexo_path!)}>
                          Ver comprovante
                        </Button>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      onClick={() => setInvestments((list) => list.filter((_, i) => i !== index))}
                    >
                      <Trash2 /> Remover
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          {action ? (
            <Button type="button" variant="ghost" className="text-destructive" onClick={handleDelete} disabled={saving}>
              <Trash2 /> Excluir
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button type="button" onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="animate-spin" />} Salvar
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
