import React, { useState, useEffect } from "react";
import type { TreinamentoItem, TipoTreinamento, MembroEquipe } from "@/lib/estrutura-rep/types";
import {
  TIPO_TREINAMENTO_LABEL,
  TIPO_TREINAMENTO_COLOR,
} from "@/lib/estrutura-rep/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  GraduationCap,
  Calendar,
  Clock,
  MapPin,
  Building,
  Loader2,
  UserCheck,
  Sparkles,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { RepClientSelect } from "./RepClientSelect";

interface TreinamentoEditorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  treinamento?: TreinamentoItem | null;
  representativeId?: string;
  repNome?: string;
  equipe?: MembroEquipe[];
  structureClients?: Array<{ nome: string; cidade?: string | null; estado?: string | null }>;
  onSave: (item: TreinamentoItem) => Promise<void> | void;
}

export function TreinamentoEditorModal({
  open,
  onOpenChange,
  treinamento,
  representativeId,
  repNome,
  equipe = [],
  structureClients,
  onSave,
}: TreinamentoEditorModalProps) {
  const [tipo, setTipo] = useState<TipoTreinamento>("mini_palestra");
  const [clienteNome, setClienteNome] = useState("");
  const [ministrante, setMinistrante] = useState("");
  const [data, setData] = useState("");
  const [horario, setHorario] = useState("09:00");
  const [local, setLocal] = useState("");
  const [status, setStatus] = useState<"planejado" | "realizado">("planejado");
  const [observacoes, setObservacoes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      if (treinamento) {
        setTipo(treinamento.tipo || "mini_palestra");
        setClienteNome(treinamento.cliente_nome || "");
        setMinistrante(treinamento.ministrante || repNome || "");
        setData(treinamento.data || new Date().toISOString().split("T")[0]);
        setHorario(treinamento.horario || "09:00");
        setLocal(treinamento.local || "");
        setStatus(treinamento.status || "planejado");
        setObservacoes(treinamento.observacoes || "");
      } else {
        setTipo("mini_palestra");
        setClienteNome("");
        setMinistrante(repNome ? `${repNome} (Rep Titular)` : "");
        // Data padrão: amanhã
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        setData(tomorrow.toISOString().split("T")[0]);
        setHorario("09:00");
        setLocal("Showroom da Loja");
        setStatus("planejado");
        setObservacoes("");
      }
    }
  }, [open, treinamento, repNome]);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!clienteNome.trim()) {
      toast.error("Informe o nome do cliente que receberá o treinamento.");
      return;
    }

    if (!ministrante.trim()) {
      toast.error("Especifique quem irá ministrar a ação.");
      return;
    }

    if (!data) {
      toast.error("Selecione a data do treinamento.");
      return;
    }

    setSaving(true);
    try {
      const item: TreinamentoItem = {
        id: treinamento?.id || `train-${Date.now()}`,
        tipo,
        cliente_nome: clienteNome.trim(),
        ministrante: ministrante.trim(),
        data,
        horario: horario.trim() || undefined,
        local: local.trim() || undefined,
        status,
        observacoes: observacoes.trim() || undefined,
      };

      await onSave(item);
      toast.success(
        treinamento ? "Treinamento atualizado com sucesso!" : "Treinamento agendado com sucesso!"
      );
      onOpenChange(false);
    } catch (err: any) {

      toast.error(err?.message || "Falha ao salvar agendamento");
    } finally {
      setSaving(false);
    }
  };

  // Sugestões rápidas de ministrantes da ação
  const ministranteSugestoes = [
    repNome ? `${repNome} (Rep Titular)` : null,
    ...equipe.map((m) => `${m.nome} (${m.cargo})`),
    "Consultor Técnico de Fábrica",
    "Arquiteto Convidado",
  ].filter(Boolean) as string[];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 overflow-hidden">
        <DialogHeader className="p-5 pb-3 border-b bg-muted/20">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <GraduationCap className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold">
                {treinamento ? "Editar Treinamento Agendado" : "Agendar Novo Treinamento"}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Informe o cliente, o tipo de capacitação, data e quem irá ministrar
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[85vh] overflow-y-auto">
          {/* Tipo de Treinamento */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Tipo de Treinamento *</Label>
            <Select value={tipo} onValueChange={(v) => setTipo(v as TipoTreinamento)}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Selecione o tipo..." />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(TIPO_TREINAMENTO_LABEL).map(([val, label]) => (
                  <SelectItem key={val} value={val} className="text-xs">
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Nome do Cliente com Seletor e Busca da Carteira do Rep */}
          <div className="space-y-1.5">
            <Label htmlFor="train-client-name" className="text-xs font-semibold flex items-center justify-between">
              <span>Cliente / Loja *</span>
              <span className="text-[10px] text-muted-foreground font-normal">
                Pesquise na lista de clientes do rep
              </span>
            </Label>
            <RepClientSelect
              id="train-client-name"
              value={clienteNome}
              onChange={setClienteNome}
              onSelectClient={(c) => {
                setClienteNome(c.nome);
                if ((!local || local === "Showroom da Loja") && c.cidade) {
                  setLocal(`Showroom da Loja (${c.cidade})`);
                }
              }}
              representativeId={representativeId}
              repNome={repNome}
              structureClients={structureClients}
              placeholder="Buscar cliente na carteira do rep..."
              required
            />
          </div>

          {/* Quem irá ministrar a ação */}
          <div className="space-y-1.5">
            <Label htmlFor="train-ministrante" className="text-xs font-semibold flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <UserCheck className="h-3.5 w-3.5 text-primary" />
                <span>Quem irá ministrar a ação *</span>
              </span>
              <span className="text-[10px] text-muted-foreground font-normal">
                Rep, membro da equipe ou parceiro
              </span>
            </Label>
            <div className="relative">
              <Input
                id="train-ministrante"
                value={ministrante}
                onChange={(e) => setMinistrante(e.target.value)}
                placeholder="Ex: Felipe Bogarim (Rep Titular), Consultor Técnico, etc."
                className="h-9 text-xs"
                required
              />
            </div>

            {/* Sugestões Rápidas de Ministrante */}
            {ministranteSugestoes.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1">
                {ministranteSugestoes.map((sugestao) => (
                  <button
                    key={sugestao}
                    type="button"
                    onClick={() => setMinistrante(sugestao)}
                    className={`text-[10px] px-2 py-0.5 rounded-md border transition cursor-pointer ${
                      ministrante === sugestao
                        ? "bg-primary text-primary-foreground font-bold border-primary shadow-2xs"
                        : "bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground border-border/80"
                    }`}
                  >
                    {sugestao}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Data e Horário */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="train-date" className="text-xs font-semibold">
                Data *
              </Label>
              <div className="relative">
                <Calendar className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="train-date"
                  type="date"
                  value={data}
                  onChange={(e) => setData(e.target.value)}
                  className="pl-9 h-9 text-xs"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="train-time" className="text-xs font-semibold">
                Horário
              </Label>
              <div className="relative">
                <Clock className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="train-time"
                  type="time"
                  value={horario}
                  onChange={(e) => setHorario(e.target.value)}
                  className="pl-9 h-9 text-xs"
                />
              </div>
            </div>
          </div>

          {/* Local */}
          <div className="space-y-1.5">
            <Label htmlFor="train-location" className="text-xs font-semibold">
              Local / Formato
            </Label>
            <div className="relative">
              <MapPin className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="train-location"
                value={local}
                onChange={(e) => setLocal(e.target.value)}
                placeholder="Ex: Showroom da Loja / Sala Técnica"
                className="pl-9 h-9 text-xs"
              />
            </div>
          </div>

          {/* Status da Ação: Planejado vs Realizado */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Status da Ação</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setStatus("planejado")}
                className={`flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg border text-xs font-semibold transition-all ${
                  status === "planejado"
                    ? "bg-blue-500/15 border-blue-500/50 text-blue-700 dark:text-blue-300 shadow-2xs"
                    : "bg-muted/40 border-border/80 text-muted-foreground hover:bg-muted"
                }`}
              >
                <Clock className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                <span>Planejado</span>
              </button>
              <button
                type="button"
                onClick={() => setStatus("realizado")}
                className={`flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg border text-xs font-semibold transition-all ${
                  status === "realizado"
                    ? "bg-emerald-500/15 border-emerald-500/50 text-emerald-700 dark:text-emerald-300 shadow-2xs"
                    : "bg-muted/40 border-border/80 text-muted-foreground hover:bg-muted"
                }`}
              >
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Realizado</span>
              </button>
            </div>
          </div>

          {/* Observações */}
          <div className="space-y-1.5">
            <Label htmlFor="train-obs" className="text-xs font-semibold">
              Observações / Foco do Treinamento
            </Label>
            <Textarea
              id="train-obs"
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Ex: Foco no lançamento da linha óptica e diferenciais Newline"
              rows={2}
              className="text-xs resize-none"
            />
          </div>

          <DialogFooter className="pt-2 border-t">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-xs"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={saving}
              className="text-xs font-semibold gap-1.5"
            >
              {saving ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Salvando...
                </>
              ) : treinamento ? (
                "Atualizar Agendamento"
              ) : (
                "Agendar Treinamento"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
