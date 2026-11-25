// Atalhos "Ações úteis" do portal: abrem o formulário de solicitação já no tipo certo.
import { Gift, Megaphone, PackageOpen, Store, ArrowRight, Inbox } from "lucide-react";
import {
  SOLICITACAO_TIPOS,
  SOLICITACAO_TIPO_INFO,
  type SolicitacaoTipo,
} from "@/lib/rep-solicitacoes";

export const SOLICITACAO_ICON: Record<SolicitacaoTipo, typeof Gift> = {
  material_evento: PackageOpen,
  acao_trade: Megaphone,
  material_pdv: Store,
  amostras: Gift,
};

export function RepAcoesUteis({
  onSolicitar,
  onVerSolicitacoes,
  emAberto,
}: {
  onSolicitar: (tipo: SolicitacaoTipo) => void;
  /** Sem handler, o link "Minhas solicitações" não aparece (já está na aba). */
  onVerSolicitacoes?: () => void;
  emAberto: number;
}) {
  return (
    <section className="rounded-xl border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-foreground">Ações úteis</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Peça apoio da marca para movimentar a sua carteira. A gestão responde por aqui mesmo.
          </p>
        </div>
        {onVerSolicitacoes && (
          <button
            type="button"
            onClick={onVerSolicitacoes}
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold text-primary hover:bg-primary/5"
          >
            <Inbox className="h-3.5 w-3.5" />
            Minhas solicitações{emAberto > 0 ? ` (${emAberto} em aberto)` : ""}
            <ArrowRight className="h-3 w-3" />
          </button>
        )}
      </div>
      <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        {SOLICITACAO_TIPOS.map((t) => {
          const Icon = SOLICITACAO_ICON[t];
          const info = SOLICITACAO_TIPO_INFO[t];
          return (
            <button
              key={t}
              type="button"
              onClick={() => onSolicitar(t)}
              className="group flex items-start gap-3 rounded-lg border bg-muted/20 p-3 text-left transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:bg-primary/5 hover:shadow-sm"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="h-4.5 w-4.5" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-foreground">{info.label}</span>
                <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">
                  {info.descricao}
                </span>
                <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-primary opacity-80 group-hover:opacity-100">
                  Solicitar <ArrowRight className="h-3 w-3" />
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
