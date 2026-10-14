import React, { useState, useEffect } from "react";
import type { ClienteFrequenciaItem } from "@/lib/estrutura-rep/types";
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
import { RotateCcw, Building, MapPin, Loader2, Calendar } from "lucide-react";
import { toast } from "sonner";

interface ClienteFrequenciaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cliente?: ClienteFrequenciaItem | null;
  posicaoSugerida?: number;
  onSave: (item: ClienteFrequenciaItem) => Promise<void> | void;
}

const UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA",
  "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN",
  "RS", "RO", "RR", "SC", "SP", "SE", "TO",
];

export function ClienteFrequenciaModal({
  open,
  onOpenChange,
  cliente,
  posicaoSugerida = 1,
  onSave,
}: ClienteFrequenciaModalProps) {
  const [posicao, setPosicao] = useState<number>(posicaoSugerida);
  const [clienteNome, setClienteNome] = useState("");
  const [cidade, setCidade] = useState("");
  const [uf, setUf] = useState("BA");
  const [frequenciaDias, setFrequenciaDias] = useState<number>(40);
  const [observacoes, setObservacoes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      if (cliente) {
        setPosicao(cliente.posicao || posicaoSugerida);
        setClienteNome(cliente.cliente_nome || "");
        setCidade(cliente.cidade || "");
        setUf(cliente.uf || "BA");
        setFrequenciaDias(cliente.frequencia_dias || 40);
        setObservacoes(cliente.observacoes || "");
      } else {
        setPosicao(posicaoSugerida);
        setClienteNome("");
        setCidade("");
        setUf("BA");
        setFrequenciaDias(40);
        setObservacoes("");
      }
    }
  }, [open, cliente, posicaoSugerida]);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!clienteNome.trim()) {
      toast.error("Informe o nome do cliente.");
      return;
    }

    if (!frequenciaDias || frequenciaDias < 1) {
      toast.error("Informe um número válido de dias para a frequência de visita.");
      return;
    }

    setSaving(true);
    try {
      const item: ClienteFrequenciaItem = {
        id: cliente?.id || `freq-${Date.now()}`,
        posicao: Number(posicao) || 1,
        cliente_nome: clienteNome.trim(),
        cidade: cidade.trim() || undefined,
        uf: uf || undefined,
        frequencia_dias: Number(frequenciaDias),
        observacoes: observacoes.trim() || undefined,
      };

      await onSave(item);
      toast.success(
        cliente ? "Frequência atualizada com sucesso!" : "Cliente adicionado ao Top 10 com sucesso!"
      );
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.message || "Falha ao salvar dados de frequência");
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
              <RotateCcw className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold">
                {cliente ? "Editar Frequência de Visita" : "Cadastrar Cliente no Top 10"}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Defina a média de dias que o representante demora para retornar neste cliente
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Posição no Ranking (1 a 10) */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5 col-span-1">
              <Label className="text-xs font-semibold">Posição</Label>
              <Select
                value={String(posicao)}
                onValueChange={(v) => setPosicao(Number(v))}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 10 }, (_, i) => i + 1).map((num) => (
                    <SelectItem key={num} value={String(num)} className="text-xs">
                      {num}º Lugar
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Ciclo / Frequência em Dias */}
            <div className="space-y-1.5 col-span-2">
              <Label htmlFor="freq-days" className="text-xs font-semibold">
                Frequência de Retorno (dias) *
              </Label>
              <div className="relative">
                <Calendar className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="freq-days"
                  type="number"
                  min={1}
                  max={365}
                  value={frequenciaDias}
                  onChange={(e) => setFrequenciaDias(Number(e.target.value))}
                  placeholder="Ex: 40"
                  className="pl-9 h-9 text-xs font-bold"
                  required
                />
              </div>
              <span className="text-[10px] text-muted-foreground block">
                Exemplo: a cada {frequenciaDias || 40} dias
              </span>
            </div>
          </div>

          {/* Nome do Cliente */}
          <div className="space-y-1.5">
            <Label htmlFor="client-freq-name" className="text-xs font-semibold">
              Nome do Cliente *
            </Label>
            <div className="relative">
              <Building className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="client-freq-name"
                value={clienteNome}
                onChange={(e) => setClienteNome(e.target.value)}
                placeholder="Ex: Ilustre Iluminação"
                className="pl-9 h-9 text-xs"
                required
              />
            </div>
          </div>

          {/* Cidade e UF */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5 col-span-2">
              <Label htmlFor="client-city" className="text-xs font-semibold">
                Cidade
              </Label>
              <div className="relative">
                <MapPin className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="client-city"
                  value={cidade}
                  onChange={(e) => setCidade(e.target.value)}
                  placeholder="Ex: Salvador"
                  className="pl-9 h-9 text-xs"
                />
              </div>
            </div>

            <div className="space-y-1.5 col-span-1">
              <Label className="text-xs font-semibold">UF</Label>
              <Select value={uf} onValueChange={setUf}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="UF" />
                </SelectTrigger>
                <SelectContent className="max-h-48">
                  {UFS.map((u) => (
                    <SelectItem key={u} value={u} className="text-xs">
                      {u}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Observações */}
          <div className="space-y-1.5">
            <Label htmlFor="client-freq-obs" className="text-xs font-semibold">
              Observações
            </Label>
            <Textarea
              id="client-freq-obs"
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Ex: Visita alinhada com compras e especificadores"
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
              ) : cliente ? (
                "Atualizar Frequência"
              ) : (
                "Salvar no Top 10"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
