import React, { useState, useEffect } from "react";
import type { TreinamentoItem, TipoTreinamento } from "@/lib/estrutura-rep/types";
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
import { GraduationCap, Calendar, Clock, MapPin, Building, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface TreinamentoEditorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  treinamento?: TreinamentoItem | null;
  onSave: (item: TreinamentoItem) => Promise<void> | void;
}

export function TreinamentoEditorModal({
  open,
  onOpenChange,
  treinamento,
  onSave,
}: TreinamentoEditorModalProps) {
  const [tipo, setTipo] = useState<TipoTreinamento>("mini_palestra");
  const [clienteNome, setClienteNome] = useState("");
  const [data, setData] = useState("");
  const [horario, setHorario] = useState("09:00");
  const [local, setLocal] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      if (treinamento) {
        setTipo(treinamento.tipo || "mini_palestra");
        setClienteNome(treinamento.cliente_nome || "");
        setData(treinamento.data || new Date().toISOString().split("T")[0]);
        setHorario(treinamento.horario || "09:00");
        setLocal(treinamento.local || "");
        setObservacoes(treinamento.observacoes || "");
      } else {
        setTipo("mini_palestra");
        setClienteNome("");
        // Data padrão: amanhã
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        setData(tomorrow.toISOString().split("T")[0]);
        setHorario("09:00");
        setLocal("Showroom da Loja");
        setObservacoes("");
      }
    }
  }, [open, treinamento]);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!clienteNome.trim()) {
      toast.error("Informe o nome do cliente que receberá o treinamento.");
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
        data,
        horario: horario.trim() || undefined,
        local: local.trim() || undefined,
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
                Informe o cliente, o tipo de capacitação e a data prevista
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
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

          {/* Nome do Cliente */}
          <div className="space-y-1.5">
            <Label htmlFor="train-client-name" className="text-xs font-semibold">
              Nome do Cliente / Loja *
            </Label>
            <div className="relative">
              <Building className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="train-client-name"
                value={clienteNome}
                onChange={(e) => setClienteNome(e.target.value)}
                placeholder="Ex: Ilustre Iluminação & Design"
                className="pl-9 h-9 text-xs"
                required
              />
            </div>
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
