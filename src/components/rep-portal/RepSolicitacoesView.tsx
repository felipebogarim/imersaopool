// Aba "Solicitações" do portal: pedidos de apoio do representante e a resposta da gestão.
import { useState } from "react";
import { CalendarDays, Inbox, MapPin, MessageSquare, Plus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatPrazo } from "@/lib/action-tracking";
import {
  SOLICITACAO_STATUS_CLASS,
  SOLICITACAO_STATUS_LABEL,
  SOLICITACAO_TIPO_INFO,
  solicitacaoEmAberto,
  type Solicitacao,
  type SolicitacaoTipo,
} from "@/lib/rep-solicitacoes";
import { RepAcoesUteis, SOLICITACAO_ICON } from "./RepAcoesUteis";
import { useRepSolicitacoes } from "./use-rep-solicitacoes";

export function RepSolicitacoesView({
  onSolicitar,
}: {
  onSolicitar: (tipo: SolicitacaoTipo) => void;
}) {
  const { data, isLoading, error } = useRepSolicitacoes();
  const [filtro, setFiltro] = useState<"abertas" | "todas">("todas");
  const items = data?.available ? data.items : [];
  const emAberto = items.filter((s) => solicitacaoEmAberto(s.status)).length;
  const lista = filtro === "abertas" ? items.filter((s) => solicitacaoEmAberto(s.status)) : items;

  return (
    <div className="space-y-6">
      <RepAcoesUteis onSolicitar={onSolicitar} emAberto={emAberto} />

      <section className="rounded-xl border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Inbox className="h-4 w-4 text-primary" />
            <h2 className="text-base font-bold">Minhas solicitações</h2>
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              variant={filtro === "todas" ? "default" : "outline"}
              className="h-8 text-xs"
              onClick={() => setFiltro("todas")}
            >
              Todas ({items.length})
            </Button>
            <Button
              size="sm"
              variant={filtro === "abertas" ? "default" : "outline"}
              className="h-8 text-xs"
              onClick={() => setFiltro("abertas")}
            >
              Em aberto ({emAberto})
            </Button>
          </div>
        </div>

        <div className="mt-4">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : error ? (
            <p className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
              {error instanceof Error ? error.message : "Não foi possível carregar."}
            </p>
          ) : data && !data.available ? (
            <p className="text-sm text-muted-foreground">
              As solicitações estarão disponíveis em breve.
            </p>
          ) : lista.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <p className="text-sm text-muted-foreground">Nenhuma solicitação por aqui.</p>
              <Button size="sm" onClick={() => onSolicitar("material_evento")}>
                <Plus className="mr-1 h-4 w-4" /> Nova solicitação
              </Button>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {lista.map((s) => (
                <SolicitacaoCard key={s.id} s={s} />
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function SolicitacaoCard({ s }: { s: Solicitacao }) {
  const Icon = SOLICITACAO_ICON[s.tipo];
  return (
    <div className="flex flex-col rounded-lg border bg-background p-4">
      <div className="flex items-start justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
          <Icon className="h-3.5 w-3.5 text-primary" />
          {SOLICITACAO_TIPO_INFO[s.tipo].label}
          {s.acao_trade_tipo ? ` · ${s.acao_trade_tipo}` : ""}
        </span>
        <span
          className={cn(
            "rounded-full border px-2 py-0.5 text-[10px] font-bold",
            SOLICITACAO_STATUS_CLASS[s.status],
          )}
        >
          {SOLICITACAO_STATUS_LABEL[s.status]}
        </span>
      </div>
      <p className="mt-1.5 text-sm font-semibold">{s.titulo}</p>
      {s.cliente && <p className="text-xs text-muted-foreground">{s.cliente}</p>}
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
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
      </div>
      {s.itens.length > 0 && (
        <ul className="mt-2 space-y-0.5 text-xs">
          {s.itens.map((i, k) => (
            <li key={k} className="flex justify-between gap-2 border-b border-dashed py-0.5">
              <span>{i.item}</span>
              <span className="tabular-nums text-muted-foreground">{i.quantidade}×</span>
            </li>
          ))}
        </ul>
      )}
      {s.resposta && (
        <p className="mt-3 flex items-start gap-1.5 rounded-md bg-muted/60 px-2.5 py-1.5 text-xs">
          <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
          <span>
            <strong>Gestão:</strong> {s.resposta}
          </span>
        </p>
      )}
      <p className="mt-auto pt-2 text-[10px] text-muted-foreground">
        Enviada em {new Date(s.created_at).toLocaleDateString("pt-BR")}
        {s.respondido_em &&
          ` · respondida em ${new Date(s.respondido_em).toLocaleDateString("pt-BR")}`}
      </p>
    </div>
  );
}
