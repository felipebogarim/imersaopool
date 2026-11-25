// Formulário de solicitação de apoio (materiais para eventos, ação de trade, PDV, amostras).
// Abre a partir dos atalhos "Ações úteis", de um card de ação sugerida ou da aba Solicitações.

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Plus, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { TRADE_ACTION_TYPES } from "@/lib/agenda-trade-types";
import {
  SOLICITACAO_TIPOS,
  SOLICITACAO_TIPO_INFO,
  limparItens,
  validarSolicitacao,
  type SolicitacaoTipo,
} from "@/lib/rep-solicitacoes";
import { repCreateSolicitacao } from "@/lib/rep-solicitacoes.functions";
import { REP_SOLICITACOES_KEY } from "./use-rep-solicitacoes";
import { SOLICITACAO_ICON } from "./RepAcoesUteis";

export type SolicitacaoPreset = {
  tipo: SolicitacaoTipo;
  cliente?: string | null;
  cardId?: string | null;
  titulo?: string;
  /** Rótulo da ação sugerida vinculada (exibido no topo). */
  acaoVinculada?: string | null;
};

type ItemDraft = { item: string; quantidade: string };

export function RepSolicitacaoDialog({
  preset,
  clientes,
  onClose,
  onCreated,
}: {
  preset: SolicitacaoPreset | null;
  clientes: string[];
  onClose: () => void;
  onCreated?: () => void;
}) {
  const qc = useQueryClient();
  const createFn = useServerFn(repCreateSolicitacao);
  const [tipo, setTipo] = useState<SolicitacaoTipo>("material_evento");
  const [titulo, setTitulo] = useState("");
  const [cliente, setCliente] = useState("");
  const [acaoTradeTipo, setAcaoTradeTipo] = useState("");
  const [dataEvento, setDataEvento] = useState("");
  const [dataNecessaria, setDataNecessaria] = useState("");
  const [local, setLocal] = useState("");
  const [publico, setPublico] = useState("");
  const [descricao, setDescricao] = useState("");
  const [itens, setItens] = useState<ItemDraft[]>([{ item: "", quantidade: "1" }]);

  useEffect(() => {
    if (!preset) return;
    setTipo(preset.tipo);
    setTitulo(preset.titulo ?? "");
    setCliente(preset.cliente ?? "");
    setAcaoTradeTipo("");
    setDataEvento("");
    setDataNecessaria("");
    setLocal("");
    setPublico("");
    setDescricao("");
    setItens([{ item: "", quantidade: "1" }]);
  }, [preset]);

  const info = SOLICITACAO_TIPO_INFO[tipo];
  const comEvento = tipo === "material_evento" || tipo === "acao_trade";
  const itensLimpos = limparItens(itens);
  const erro = validarSolicitacao({
    tipo,
    titulo,
    itens: itensLimpos,
    acao_trade_tipo: acaoTradeTipo || null,
    data_evento: dataEvento || null,
    data_necessaria: dataNecessaria || null,
  });

  const mut = useMutation({
    mutationFn: () =>
      createFn({
        data: {
          tipo,
          titulo: titulo.trim(),
          cliente: cliente.trim() || null,
          cardId: preset?.cardId ?? null,
          acaoTradeTipo: acaoTradeTipo || null,
          dataEvento: dataEvento || null,
          dataNecessaria: dataNecessaria || null,
          local: local.trim() || null,
          publicoEstimado: publico ? Math.max(0, Math.floor(Number(publico))) : null,
          itens: itensLimpos,
          descricao: descricao.trim() || null,
        },
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: REP_SOLICITACOES_KEY });
      void qc.invalidateQueries({ queryKey: ["rep-portal"] });
      toast.success("Solicitação enviada para a gestão.", {
        description: "Acompanhe a resposta na aba Solicitações.",
      });
      onClose();
      onCreated?.();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addSugestao = (s: string) =>
    setItens((prev) => {
      if (prev.some((i) => i.item.trim().toLowerCase() === s.toLowerCase())) return prev;
      const vazio = prev.findIndex((i) => !i.item.trim());
      if (vazio >= 0) return prev.map((i, k) => (k === vazio ? { ...i, item: s } : i));
      return [...prev, { item: s, quantidade: "1" }];
    });

  return (
    <Dialog open={!!preset} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova solicitação de apoio</DialogTitle>
          <DialogDescription>
            A gestão recebe o pedido e responde por aqui. Você acompanha o andamento na aba{" "}
            <strong>Solicitações</strong>.
          </DialogDescription>
        </DialogHeader>

        {preset?.acaoVinculada && (
          <p className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs">
            Vinculada à ação sugerida: <strong>{preset.acaoVinculada}</strong>
          </p>
        )}

        {/* Tipo */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {SOLICITACAO_TIPOS.map((t) => {
            const Icon = SOLICITACAO_ICON[t];
            return (
              <button
                key={t}
                type="button"
                onClick={() => setTipo(t)}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-lg border p-2.5 text-center text-[11px] font-semibold transition-colors",
                  tipo === t
                    ? "border-primary bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted",
                )}
              >
                <Icon className="h-4 w-4" />
                {SOLICITACAO_TIPO_INFO[t].label}
              </button>
            );
          })}
        </div>
        <p className="-mt-1 text-xs text-muted-foreground">{info.descricao}</p>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1 sm:col-span-2">
            <Label className="text-xs">Título do pedido *</Label>
            <Input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex.: Café com arquitetos na loja"
              maxLength={200}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Cliente</Label>
            <Input
              value={cliente}
              onChange={(e) => setCliente(e.target.value)}
              list="rep-solicitacao-clientes"
              placeholder="Opcional"
            />
            <datalist id="rep-solicitacao-clientes">
              {clientes.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
          {tipo === "acao_trade" ? (
            <div className="space-y-1">
              <Label className="text-xs">Tipo de ação *</Label>
              <Select value={acaoTradeTipo} onValueChange={setAcaoTradeTipo}>
                <SelectTrigger>
                  <SelectValue placeholder="Escolha" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {TRADE_ACTION_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="space-y-1">
              <Label className="text-xs">Precisa receber até</Label>
              <Input
                type="date"
                value={dataNecessaria}
                onChange={(e) => setDataNecessaria(e.target.value)}
              />
            </div>
          )}
          {comEvento && (
            <>
              <div className="space-y-1">
                <Label className="text-xs">Data do evento/ação *</Label>
                <Input
                  type="date"
                  value={dataEvento}
                  onChange={(e) => setDataEvento(e.target.value)}
                />
              </div>
              {tipo === "acao_trade" ? (
                <div className="space-y-1">
                  <Label className="text-xs">Materiais até</Label>
                  <Input
                    type="date"
                    value={dataNecessaria}
                    onChange={(e) => setDataNecessaria(e.target.value)}
                  />
                </div>
              ) : (
                <div className="space-y-1">
                  <Label className="text-xs">Público estimado</Label>
                  <Input
                    inputMode="numeric"
                    value={publico}
                    onChange={(e) => setPublico(e.target.value.replace(/\D/g, ""))}
                    placeholder="Nº de pessoas"
                  />
                </div>
              )}
              <div className="space-y-1">
                <Label className="text-xs">Local</Label>
                <Input
                  value={local}
                  onChange={(e) => setLocal(e.target.value)}
                  placeholder="Cidade / endereço"
                />
              </div>
              {tipo === "acao_trade" && (
                <div className="space-y-1">
                  <Label className="text-xs">Público estimado</Label>
                  <Input
                    inputMode="numeric"
                    value={publico}
                    onChange={(e) => setPublico(e.target.value.replace(/\D/g, ""))}
                    placeholder="Nº de pessoas"
                  />
                </div>
              )}
            </>
          )}
        </div>

        {/* Itens */}
        <div className="space-y-2">
          <Label className="text-xs">
            Itens e quantidades{tipo === "acao_trade" ? " (opcional)" : " *"}
          </Label>
          {info.sugestoesItens.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {info.sugestoesItens.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => addSugestao(s)}
                  className="rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  + {s}
                </button>
              ))}
            </div>
          )}
          {itens.map((it, k) => (
            <div key={k} className="flex items-center gap-2">
              <Input
                value={it.item}
                onChange={(e) =>
                  setItens((p) => p.map((x, j) => (j === k ? { ...x, item: e.target.value } : x)))
                }
                placeholder="Item"
                className="flex-1"
              />
              <Input
                inputMode="numeric"
                value={it.quantidade}
                onChange={(e) =>
                  setItens((p) =>
                    p.map((x, j) =>
                      j === k ? { ...x, quantidade: e.target.value.replace(/\D/g, "") } : x,
                    ),
                  )
                }
                className="w-20 text-right"
                aria-label="Quantidade"
              />
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={() => setItens((p) => (p.length > 1 ? p.filter((_, j) => j !== k) : p))}
                aria-label="Remover item"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setItens((p) => [...p, { item: "", quantidade: "1" }])}
            disabled={itens.length >= 30}
          >
            <Plus className="mr-1 h-3.5 w-3.5" /> Adicionar item
          </Button>
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Detalhes</Label>
          <Textarea
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Objetivo, contexto do cliente, endereço de entrega…"
            className="min-h-[80px]"
          />
        </div>

        <DialogFooter className="items-center gap-2">
          {erro && <span className="mr-auto text-xs text-muted-foreground">{erro}</span>}
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => mut.mutate()} disabled={!!erro || mut.isPending}>
            {mut.isPending ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-1.5 h-4 w-4" />
            )}
            Enviar solicitação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
