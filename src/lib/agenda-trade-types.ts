export type TradeView = "month" | "week" | "list";

export type TradeStatus = "planejado" | "confirmado" | "realizado" | "cancelado";

export const TRADE_STATUS: { value: TradeStatus; label: string; dot: string; badge: string }[] = [
  { value: "planejado", label: "Planejado", dot: "bg-muted-foreground", badge: "border-muted-foreground/40 text-muted-foreground" },
  { value: "confirmado", label: "Confirmado", dot: "bg-primary", badge: "border-primary/40 text-primary" },
  { value: "realizado", label: "Realizado", dot: "bg-success", badge: "border-success/40 text-success" },
  { value: "cancelado", label: "Cancelado", dot: "bg-destructive", badge: "border-destructive/40 text-destructive" },
];

export function statusMeta(status: string) {
  return TRADE_STATUS.find((item) => item.value === status) ?? TRADE_STATUS[0];
}

export const TRADE_ACTION_TYPES = [
  "Treinamento de vendedores",
  "Treinamento técnico de produto",
  "Treinamento comercial de produto",
  "Treinamento para arquitetos",
  "Treinamento para especificadores",
  "Treinamento conjunto vendedores + arquitetos",
  "Workshop técnico",
  "Workshop comercial",
  "Coffee break com profissionais",
  "Café com arquitetos",
  "Evento para especificadores",
  "Evento com instaladores",
  "Evento com eletricistas",
  "Evento de relacionamento",
  "Lançamento de produto",
  "Apresentação de novos produtos",
  "Apresentação de catálogo",
  "Visita comercial ao cliente",
  "Visita à loja",
  "Visita ao escritório de arquitetura",
  "Visita a escritório de engenharia",
  "Visita a construtora",
  "Visita a incorporadora",
  "Visita a obra",
  "Acompanhamento de especificação",
  "Acompanhamento de projeto",
  "Ação de merchandising",
  "Implantação de exposição",
  "Montagem de showroom",
  "Atualização de showroom",
  "Troca de produtos em exposição",
  "Material de PDV",
  "Campanha de incentivo",
  "Campanha promocional",
  "Convenção de vendas",
  "Feira",
  "Exposição",
  "Evento regional",
  "Viagem comercial",
  "Prospecção de clientes",
  "Relacionamento com profissionais",
  "Outro",
] as const;

/** Grupos usados nos indicadores do painel. */
export const TIPOS_VIAGEM = ["Viagem comercial"];
export const TIPOS_EVENTO = TRADE_ACTION_TYPES.filter((t) => t.toLowerCase().startsWith("evento") || t === "Feira" || t === "Exposição" || t === "Convenção de vendas");
export const TIPOS_TREINAMENTO = TRADE_ACTION_TYPES.filter((t) => t.toLowerCase().startsWith("treinamento") || t.toLowerCase().startsWith("workshop"));

export type TradeCostCenter = { id: string; nome: string; descricao: string | null; ativo: boolean };
export type TradeCategory = { id: string; nome: string; rateavel: boolean; ativo: boolean };

export type TradeTrip = {
  id: string;
  titulo: string;
  cidade: string | null;
  data_inicio: string;
  data_fim: string | null;
  responsavel_id: string | null;
  observacoes: string | null;
};

export type TradeAllocation = {
  id: string;
  investment_id: string;
  client_id: string;
  valor_planejado: number;
  valor_realizado: number | null;
};

export type TradeInvestment = {
  id: string;
  action_id: string | null;
  trip_id: string | null;
  descricao: string;
  category_id: string | null;
  cost_center_id: string | null;
  data: string | null;
  valor_planejado: number;
  valor_realizado: number | null;
  status: string;
  observacao: string | null;
  anexo_path: string | null;
  rateado: boolean;
  allocations?: TradeAllocation[];
};

export type TradeAction = {
  id: string;
  trip_id: string | null;
  tipo_acao: string;
  tipo_acao_outro: string | null;
  descricao: string | null;
  data_inicio: string;
  data_fim: string | null;
  horario: string | null;
  cidade: string | null;
  status: TradeStatus;
  responsavel_id: string | null;
  representative_id: string | null;
  cost_center_id: string | null;
  clients?: { client_id: string }[];
  investments?: TradeInvestment[];
};

export type InvestmentDraft = {
  id?: string;
  descricao: string;
  category_id: string | null;
  cost_center_id: string | null;
  data: string | null;
  valor_planejado: string;
  valor_realizado: string;
  status: string;
  observacao: string;
  anexo_path: string | null;
  rateado: boolean;
  rateio_client_ids: string[];
};

export function tipoLabel(action: Pick<TradeAction, "tipo_acao" | "tipo_acao_outro">) {
  return action.tipo_acao === "Outro" && action.tipo_acao_outro ? action.tipo_acao_outro : action.tipo_acao;
}

export const brl = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number.isFinite(value) ? value : 0);

export function parseValor(input: string): number {
  if (!input) return 0;
  const normalized = input.replace(/\s|R\$/g, "").replace(/\./g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}
