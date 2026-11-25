// Solicitações de apoio do representante (portal) — tipos, rótulos e validação compartilhados
// entre o portal do representante e a tela de gestão (Ações Reps).

export const SOLICITACAO_TIPOS = [
  "material_evento",
  "acao_trade",
  "material_pdv",
  "amostras",
] as const;
export type SolicitacaoTipo = (typeof SOLICITACAO_TIPOS)[number];

export const SOLICITACAO_TIPO_INFO: Record<
  SolicitacaoTipo,
  { label: string; descricao: string; sugestoesItens: string[] }
> = {
  material_evento: {
    label: "Materiais para evento",
    descricao: "Banners, catálogos, brindes e kits para feiras, cafés e eventos com clientes.",
    sugestoesItens: [
      "Banner / roll-up",
      "Catálogos",
      "Brindes",
      "Kit de produtos para demonstração",
    ],
  },
  acao_trade: {
    label: "Ação de Trade",
    descricao:
      "Treinamentos, workshops, lançamentos e eventos de relacionamento com apoio da marca.",
    sugestoesItens: [],
  },
  material_pdv: {
    label: "Material de PDV / Exposição",
    descricao: "Displays, expositores, sinalização e atualização de showroom no ponto de venda.",
    sugestoesItens: [
      "Display de balcão",
      "Expositor",
      "Sinalização / adesivos",
      "Troca de produtos",
    ],
  },
  amostras: {
    label: "Amostras e catálogos",
    descricao: "Amostras de produto e catálogos para especificação ou apresentação ao cliente.",
    sugestoesItens: ["Amostras de produto", "Catálogo geral", "Tabela técnica"],
  },
};

export const SOLICITACAO_STATUS = [
  "pendente",
  "em_analise",
  "aprovada",
  "recusada",
  "concluida",
] as const;
export type SolicitacaoStatus = (typeof SOLICITACAO_STATUS)[number];

export const SOLICITACAO_STATUS_LABEL: Record<SolicitacaoStatus, string> = {
  pendente: "Enviada",
  em_analise: "Em análise",
  aprovada: "Aprovada",
  recusada: "Recusada",
  concluida: "Concluída",
};

export const SOLICITACAO_STATUS_CLASS: Record<SolicitacaoStatus, string> = {
  pendente: "border-amber-300 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  em_analise: "border-sky-300 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  aprovada: "border-emerald-300 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  recusada: "border-rose-300 bg-rose-500/10 text-rose-700 dark:text-rose-300",
  concluida: "border-border bg-muted text-muted-foreground",
};

/** Ainda aguardando a equipe (conta no selo do menu do portal). */
export const solicitacaoEmAberto = (s: SolicitacaoStatus) => s === "pendente" || s === "em_analise";

export type SolicitacaoItem = { item: string; quantidade: number };

export type Solicitacao = {
  id: string;
  tipo: SolicitacaoTipo;
  titulo: string;
  cliente: string | null;
  card_id: string | null;
  acao_trade_tipo: string | null;
  data_evento: string | null;
  data_necessaria: string | null;
  local: string | null;
  publico_estimado: number | null;
  itens: SolicitacaoItem[];
  descricao: string | null;
  status: SolicitacaoStatus;
  resposta: string | null;
  respondido_em: string | null;
  created_at: string;
  /** Só na visão da gestão. */
  rep?: string;
};

/** Itens válidos (nome preenchido e quantidade ≥ 1), sem duplicar linhas vazias do formulário. */
export function limparItens(itens: ReadonlyArray<{ item: string; quantidade: number | string }>) {
  return itens
    .map((i) => ({ item: i.item.trim(), quantidade: Math.floor(Number(i.quantidade)) }))
    .filter((i) => i.item.length > 0 && Number.isFinite(i.quantidade) && i.quantidade >= 1);
}

/** Erro de validação do pedido (null = ok). */
export function validarSolicitacao(s: {
  tipo: SolicitacaoTipo;
  titulo: string;
  itens: SolicitacaoItem[];
  acao_trade_tipo?: string | null;
  data_evento?: string | null;
  data_necessaria?: string | null;
}): string | null {
  if (s.titulo.trim().length < 3) return "Dê um título ao pedido (mín. 3 caracteres).";
  if (s.tipo === "acao_trade" && !s.acao_trade_tipo) return "Escolha o tipo de ação de trade.";
  if ((s.tipo === "material_evento" || s.tipo === "acao_trade") && !s.data_evento)
    return "Informe a data do evento/ação.";
  if (s.tipo !== "acao_trade" && s.itens.length === 0)
    return "Inclua ao menos um item com quantidade.";
  if (s.data_evento && s.data_necessaria && s.data_necessaria > s.data_evento)
    return "Os materiais precisam chegar até a data do evento.";
  return null;
}
