// Gestão: solicitações de apoio enviadas pelos representantes no portal (materiais para eventos,
// ações de trade, PDV, amostras). A equipe muda o status e responde; o rep vê no portal.

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { CalendarDays, ExternalLink, Inbox, Loader2, MapPin, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { formatPrazo } from "@/lib/action-tracking";
import {
  SOLICITACAO_STATUS,
  SOLICITACAO_STATUS_CLASS,
  SOLICITACAO_STATUS_LABEL,
  SOLICITACAO_TIPO_INFO,
  solicitacaoEmAberto,
  type Solicitacao,
  type SolicitacaoStatus,
} from "@/lib/rep-solicitacoes";
import { staffListSolicitacoes, staffResponderSolicitacao } from "@/lib/rep-solicitacoes.functions";

export const STAFF_SOLICITACOES_KEY = ["acoes-reps", "solicitacoes"] as const;

export function useStaffSolicitacoes() {
  const fn = useServerFn(staffListSolicitacoes);
  return useQuery({
    queryKey: STAFF_SOLICITACOES_KEY,
    queryFn: () => fn(),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
}

export function SolicitacoesRepsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { data, isLoading, error } = useStaffSolicitacoes();
  const [filtro, setFiltro] = useState<"abertas" | "todas">("abertas");
  const items = data?.available ? data.items : [];
  const lista = filtro === "abertas" ? items.filter((s) => solicitacaoEmAberto(s.status)) : items;
  const abertas = items.filter((s) => solicitacaoEmAberto(s.status)).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Inbox className="h-4 w-4" /> Solicitações dos representantes
          </DialogTitle>
          <DialogDescription>
            Pedidos de materiais para eventos, ações de trade, PDV e amostras feitos no Portal do
            Representante. O status e a resposta aparecem para o representante no portal.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-1.5">
          <Button
            size="sm"
            variant={filtro === "abertas" ? "default" : "outline"}
            className="h-8 text-xs"
            onClick={() => setFiltro("abertas")}
          >
            Em aberto ({abertas})
          </Button>
          <Button
            size="sm"
            variant={filtro === "todas" ? "default" : "outline"}
            className="h-8 text-xs"
            onClick={() => setFiltro("todas")}
          >
            Todas ({items.length})
          </Button>
          <Link
            to="/ferramentas/agenda-trade"
            className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            Abrir Agenda de Trade <ExternalLink className="h-3 w-3" />
          </Link>
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
          </div>
        ) : error ? (
          <p className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
            {error instanceof Error ? error.message : "Não foi possível carregar."}
          </p>
        ) : data && !data.available ? (
          <p className="rounded-md border border-amber-300 bg-amber-500/10 p-3 text-sm">
            Recurso indisponível: aplique a migration{" "}
            <code>20261125220000_rep_support_requests.sql</code> no banco.
          </p>
        ) : lista.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Nenhuma solicitação {filtro === "abertas" ? "em aberto" : "ainda"}.
          </p>
        ) : (
          <div className="space-y-3">
            {lista.map((s) => (
              <SolicitacaoItem key={s.id} s={s} />
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function SolicitacaoItem({ s }: { s: Solicitacao }) {
  const qc = useQueryClient();
  const respondFn = useServerFn(staffResponderSolicitacao);
  const [status, setStatus] = useState<SolicitacaoStatus>(
    s.status === "pendente" ? "em_analise" : s.status,
  );
  const [resposta, setResposta] = useState(s.resposta ?? "");
  const mut = useMutation({
    mutationFn: () => respondFn({ data: { id: s.id, status, resposta: resposta.trim() || null } }),
    onSuccess: () => {
      toast.success("Resposta registrada. O representante vê no portal.");
      void qc.invalidateQueries({ queryKey: STAFF_SOLICITACOES_KEY });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="rounded-lg border p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold text-muted-foreground">
            {SOLICITACAO_TIPO_INFO[s.tipo].label}
            {s.acao_trade_tipo ? ` · ${s.acao_trade_tipo}` : ""} · {s.rep ?? "Representante"}
          </p>
          <p className="text-sm font-semibold">{s.titulo}</p>
          {s.cliente && <p className="text-xs text-muted-foreground">{s.cliente}</p>}
        </div>
        <span
          className={cn(
            "rounded-full border px-2 py-0.5 text-[10px] font-bold",
            SOLICITACAO_STATUS_CLASS[s.status],
          )}
        >
          {SOLICITACAO_STATUS_LABEL[s.status]}
        </span>
      </div>
      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        {s.data_evento && (
          <span className="inline-flex items-center gap-1">
            <CalendarDays className="h-3 w-3" /> Evento {formatPrazo(s.data_evento)}
          </span>
        )}
        {s.data_necessaria && <span>Receber até {formatPrazo(s.data_necessaria)}</span>}
        {s.local && (
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-3 w-3" /> {s.local}
          </span>
        )}
        {s.publico_estimado != null && (
          <span className="inline-flex items-center gap-1">
            <Users className="h-3 w-3" /> {s.publico_estimado} pessoas
          </span>
        )}
        <span>Enviada em {new Date(s.created_at).toLocaleDateString("pt-BR")}</span>
      </div>
      {s.itens.length > 0 && (
        <p className="mt-1.5 text-xs">
          {s.itens.map((i) => `${i.quantidade}× ${i.item}`).join(" · ")}
        </p>
      )}
      {s.descricao && (
        <p className="mt-1.5 whitespace-pre-wrap text-xs text-muted-foreground">{s.descricao}</p>
      )}
      <div className="mt-2.5 flex flex-col gap-2 border-t pt-2.5 sm:flex-row sm:items-start">
        <Select value={status} onValueChange={(v) => setStatus(v as SolicitacaoStatus)}>
          <SelectTrigger className="h-9 sm:w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SOLICITACAO_STATUS.map((st) => (
              <SelectItem key={st} value={st}>
                {SOLICITACAO_STATUS_LABEL[st]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Textarea
          value={resposta}
          onChange={(e) => setResposta(e.target.value)}
          placeholder="Resposta para o representante (prazo de envio, ajustes, motivo…)"
          className="min-h-[38px] flex-1 text-xs"
        />
        <Button size="sm" onClick={() => mut.mutate()} disabled={mut.isPending}>
          {mut.isPending && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
          Responder
        </Button>
      </div>
    </div>
  );
}
