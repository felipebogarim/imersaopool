import React, { useState, useEffect } from "react";
import type { ClienteFrequenciaItem, MembroEquipe } from "@/lib/estrutura-rep/types";
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
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  RotateCcw,
  Building,
  MapPin,
  Loader2,
  Calendar,
  UserCheck,
  Users,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { RepClientSelect } from "./RepClientSelect";

export interface SaveFrequenciaOptions {
  // Se salvar item individual do Top 10:
  item?: ClienteFrequenciaItem;
  // Se aplicar aos 10 clientes do Top 10 de uma vez:
  aplicarTodosTop10?: boolean;
  frequenciaTodosDias?: number;
  // Frequência de retorno para os demais clientes da carteira:
  frequenciaDemaisClientes?: number;
}

interface ClienteFrequenciaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cliente?: ClienteFrequenciaItem | null;
  posicaoSugerida?: number;
  representativeId?: string;
  repNome?: string;
  equipe?: MembroEquipe[];
  structureClients?: Array<{ nome: string; cidade?: string | null; estado?: string | null }>;
  currentFrequenciaDemais?: number;
  initialBatchMode?: boolean;
  onSave: (payload: SaveFrequenciaOptions) => Promise<void> | void;
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
  representativeId,
  repNome,
  equipe = [],
  structureClients,
  currentFrequenciaDemais = 60,
  initialBatchMode = false,
  onSave,
}: ClienteFrequenciaModalProps) {
  const [marcarTodos, setMarcarTodos] = useState<boolean>(initialBatchMode);
  const [posicao, setPosicao] = useState<number>(posicaoSugerida);
  const [clienteNome, setClienteNome] = useState("");
  const [cidade, setCidade] = useState("");
  const [uf, setUf] = useState("BA");
  const [frequenciaDias, setFrequenciaDias] = useState<number>(40);
  const [frequenciaDemais, setFrequenciaDemais] = useState<number>(currentFrequenciaDemais || 60);
  const [responsavel, setResponsavel] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setMarcarTodos(initialBatchMode);
      setFrequenciaDemais(currentFrequenciaDemais || 60);

      if (cliente) {
        setPosicao(cliente.posicao || posicaoSugerida);
        setClienteNome(cliente.cliente_nome || "");
        setCidade(cliente.cidade || "");
        setUf(cliente.uf || "BA");
        setFrequenciaDias(cliente.frequencia_dias || 40);
        setResponsavel(cliente.responsavel || "");
        setObservacoes(cliente.observacoes || "");
      } else {
        setPosicao(posicaoSugerida);
        setClienteNome("");
        setCidade("");
        setUf("BA");
        setFrequenciaDias(40);
        setResponsavel(repNome ? `${repNome} (Rep Titular)` : "");
        setObservacoes("");
      }
    }
  }, [open, cliente, posicaoSugerida, repNome, currentFrequenciaDemais, initialBatchMode]);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!frequenciaDias || frequenciaDias < 1) {
      toast.error("Informe um número válido de dias para a frequência do Top 10.");
      return;
    }

    if (!frequenciaDemais || frequenciaDemais < 1) {
      toast.error("Informe um número válido de dias para os demais clientes.");
      return;
    }

    if (!marcarTodos && !clienteNome.trim()) {
      toast.error("Informe o nome do cliente.");
      return;
    }

    setSaving(true);
    try {
      if (marcarTodos) {
        // Aplicação em lote para todos os 10 clientes do ranking
        await onSave({
          aplicarTodosTop10: true,
          frequenciaTodosDias: Number(frequenciaDias),
          frequenciaDemaisClientes: Number(frequenciaDemais),
        });
        toast.success(
          `Frequência de ${frequenciaDias} dias aplicada aos 10 clientes do Top 10 e ${frequenciaDemais} dias para os demais clientes!`
        );
      } else {
        // Atualização individual de um cliente específico
        const item: ClienteFrequenciaItem = {
          id: cliente?.id || `freq-${Date.now()}`,
          posicao: Number(posicao) || 1,
          cliente_nome: clienteNome.trim(),
          cidade: cidade.trim() || undefined,
          uf: uf || undefined,
          frequencia_dias: Number(frequenciaDias),
          responsavel: responsavel.trim() || undefined,
          observacoes: observacoes.trim() || undefined,
        };

        await onSave({
          item,
          frequenciaDemaisClientes: Number(frequenciaDemais),
        });
        toast.success(
          cliente
            ? "Frequência atualizada com sucesso!"
            : "Cliente adicionado ao Top 10 com sucesso!"
        );
      }

      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.message || "Falha ao salvar dados de frequência");
    } finally {
      setSaving(false);
    }
  };

  const responsavelSugestoes = [
    repNome ? `${repNome} (Rep Titular)` : null,
    ...equipe.map((m) => `${m.nome} (${m.cargo})`),
  ].filter(Boolean) as string[];

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
                {marcarTodos
                  ? "Definir Frequência do Top 10 em Lote"
                  : cliente
                  ? "Editar Frequência de Visita"
                  : "Cadastrar Cliente no Top 10"}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                {marcarTodos
                  ? "Defina uma frequência única para todos os 10 clientes e para os demais clientes"
                  : "Defina o ciclo de retorno presencial individual e para os demais clientes"}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[85vh] overflow-y-auto">
          {/* Alternador de Modo: Individual vs Marcar Todos os 10 de uma vez */}
          <div className="flex items-center justify-between p-3 rounded-xl border bg-muted/30 hover:bg-muted/40 transition-colors">
            <div className="space-y-0.5 pr-2">
              <Label htmlFor="toggle-marcar-todos" className="text-xs font-bold cursor-pointer flex items-center gap-1.5">
                <Users className="h-4 w-4 text-primary" />
                <span>Marcar todos os 10 clientes de uma vez</span>
              </Label>
              <p className="text-[11px] text-muted-foreground">
                Aplica a mesma frequência de retorno para todos os 10 clientes do ranking
              </p>
            </div>
            <Switch
              id="toggle-marcar-todos"
              checked={marcarTodos}
              onCheckedChange={setMarcarTodos}
            />
          </div>

          {/* MODO 1: Marcar Todos os 10 de uma vez */}
          {marcarTodos ? (
            <div className="space-y-2.5 p-3.5 rounded-xl border border-primary/30 bg-primary/5">
              <div className="flex items-center justify-between">
                <Label htmlFor="freq-days-all" className="text-xs font-bold text-primary flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4" />
                  <span>Frequência Única para os 10 Clientes (dias) *</span>
                </Label>
                <Badge variant="secondary" className="text-[10px] font-bold bg-primary/20 text-primary border-primary/30">
                  Top 10 em Lote
                </Badge>
              </div>

              <div className="relative">
                <Calendar className="absolute left-2.5 top-2.5 h-4 w-4 text-primary" />
                <Input
                  id="freq-days-all"
                  type="number"
                  min={1}
                  max={365}
                  value={frequenciaDias}
                  onChange={(e) => setFrequenciaDias(Number(e.target.value))}
                  placeholder="Ex: 30"
                  className="pl-9 h-9 text-xs font-bold bg-background"
                  required
                />
              </div>

              <span className="text-[11px] text-muted-foreground block">
                Todas as 10 posições do ranking receberão retorno a cada <strong>{frequenciaDias || 30} dias</strong>.
              </span>

              {/* Atalhos rápidos para o Top 10 */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[10px] text-muted-foreground mr-1">Atalhos rápidos:</span>
                {[15, 20, 30, 40, 45, 60].map((dias) => (
                  <button
                    key={dias}
                    type="button"
                    onClick={() => setFrequenciaDias(dias)}
                    className={`text-[10px] px-2.5 py-0.5 rounded-md border transition cursor-pointer font-medium ${
                      frequenciaDias === dias
                        ? "bg-primary text-primary-foreground font-bold border-primary shadow-2xs"
                        : "bg-background hover:bg-muted text-muted-foreground hover:text-foreground border-border"
                    }`}
                  >
                    {dias} dias
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* MODO 2: Individual (1 a 10) */
            <>
              {/* Posição no Ranking (1 a 10) e Frequência Individual */}
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

              {/* Nome do Cliente com Seletor e Busca da Carteira */}
              <div className="space-y-1.5">
                <Label htmlFor="client-freq-name" className="text-xs font-semibold flex items-center justify-between">
                  <span>Nome do Cliente *</span>
                  <span className="text-[10px] text-muted-foreground font-normal">
                    Pesquise na carteira de clientes do rep
                  </span>
                </Label>
                <RepClientSelect
                  id="client-freq-name"
                  value={clienteNome}
                  onChange={setClienteNome}
                  onSelectClient={(c) => {
                    setClienteNome(c.nome);
                    if (c.cidade) setCidade(c.cidade);
                    if (c.estado) setUf(c.estado.toUpperCase());
                  }}
                  representativeId={representativeId}
                  repNome={repNome}
                  structureClients={structureClients}
                  placeholder="Buscar cliente na carteira do rep..."
                  required
                />
              </div>

              {/* Quem irá ministrar a ação / Responsável pela visita */}
              <div className="space-y-1.5">
                <Label htmlFor="client-freq-resp" className="text-xs font-semibold flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <UserCheck className="h-3.5 w-3.5 text-primary" />
                    <span>Quem irá ministrar / realizar a ação (Responsável)</span>
                  </span>
                  <span className="text-[10px] text-muted-foreground font-normal">
                    (opcional)
                  </span>
                </Label>
                <Input
                  id="client-freq-resp"
                  value={responsavel}
                  onChange={(e) => setResponsavel(e.target.value)}
                  placeholder="Ex: Felipe Bogarim (Rep Titular), Consultor Técnico, etc."
                  className="h-9 text-xs"
                />
                {responsavelSugestoes.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {responsavelSugestoes.map((sugestao) => (
                      <button
                        key={sugestao}
                        type="button"
                        onClick={() => setResponsavel(sugestao)}
                        className={`text-[10px] px-2 py-0.5 rounded-md border transition cursor-pointer ${
                          responsavel === sugestao
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
                <Label htmlFor="client-obs" className="text-xs font-semibold">
                  Observações Estratégicas
                </Label>
                <Textarea
                  id="client-obs"
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  placeholder="Ex: Cliente com maior volume de faturamento; foco em produtos Newline e Brilia."
                  rows={2}
                  className="text-xs resize-none"
                />
              </div>
            </>
          )}

          {/* Campo Fixo: Frequência de Visita aos Demais Clientes (Frequência Variável) */}
          <div className="pt-3 border-t space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="freq-demais" className="text-xs font-bold flex items-center gap-1.5">
                <Building className="h-4 w-4 text-primary" />
                <span>Frequência de Visita aos Demais Clientes *</span>
              </Label>
              <Badge variant="outline" className="text-[10px] bg-muted/50 font-semibold border-border">
                Demais Clientes (Fixo)
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Marcação única e fixa para todos os demais clientes da carteira fora do Top 10.
            </p>
            <div className="relative">
              <Calendar className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="freq-demais"
                type="number"
                min={1}
                max={365}
                value={frequenciaDemais}
                onChange={(e) => setFrequenciaDemais(Number(e.target.value))}
                placeholder="Ex: 60"
                className="pl-9 h-9 text-xs font-bold"
                required
              />
            </div>
            <span className="text-[10px] text-muted-foreground block">
              Retorno presencial para os demais clientes: a cada <strong>{frequenciaDemais || 60} dias</strong>.
            </span>

            {/* Atalhos rápidos para Demais Clientes */}
            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
              <span className="text-[10px] text-muted-foreground mr-1">Atalhos:</span>
              {[30, 45, 60, 90, 120].map((dias) => (
                <button
                  key={dias}
                  type="button"
                  onClick={() => setFrequenciaDemais(dias)}
                  className={`text-[10px] px-2 py-0.5 rounded-md border transition cursor-pointer font-medium ${
                    frequenciaDemais === dias
                      ? "bg-primary text-primary-foreground font-bold border-primary shadow-2xs"
                      : "bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground border-border/80"
                  }`}
                >
                  {dias} dias
                </button>
              ))}
            </div>
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
              ) : marcarTodos ? (
                "Aplicar aos 10 Clientes e Salvar"
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
