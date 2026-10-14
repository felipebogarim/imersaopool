// Definições de tipos do módulo Estrutura Rep (Imersões -> Estrutura Rep)

export type ModeloEscritorio =
  | "escritorio_fisico"
  | "home_office"
  | "hibrido"
  | "sem_escritorio";

export const MODELO_ESCRITORIO_LABEL: Record<ModeloEscritorio, string> = {
  escritorio_fisico: "Escritório Físico",
  home_office: "Home Office",
  hibrido: "Estrutura Híbrida",
  sem_escritorio: "Sem Escritório Próprio",
};

export const MODELO_ESCRITORIO_DESC: Record<ModeloEscritorio, string> = {
  escritorio_fisico: "Sede própria ou alugada dedicada para a operação comercial",
  home_office: "Operação conduzida a partir de estrutura residencial estruturada",
  hibrido: "Combinação de ponto físico de apoio com equipe remota",
  sem_escritorio: "Atuação 100% em trânsito e campo sem base física fixa",
};

export type ModeloAtuacao = "individual" | "equipe";

export const MODELO_ATUACAO_LABEL: Record<ModeloAtuacao, string> = {
  individual: "Atuação Individual",
  equipe: "Estrutura com Equipe",
};

export type ModeloNegocioRepresentada =
  | "industria"
  | "fabricante"
  | "importador"
  | "distribuidor"
  | "outro";

export const MODELO_NEGOCIO_LABEL: Record<ModeloNegocioRepresentada, string> = {
  industria: "Indústria",
  fabricante: "Fabricante",
  importador: "Importador",
  distribuidor: "Distribuidor",
  outro: "Outro",
};

export const CANAIS_COMERCIAIS = [
  { id: "varejo", label: "Varejo" },
  { id: "atacado", label: "Atacado" },
  { id: "distribuidores", label: "Distribuidores" },
  { id: "projetos", label: "Projetos / Especificadores" },
  { id: "venda_direta", label: "Venda Direta" },
] as const;

export interface RepresentadaItem {
  id: string;
  nome: string;
  logo_url?: string;
  segmento: string;
  modelo_negocio: ModeloNegocioRepresentada;
  canais: string[];
  abrangencia?: string;
}

export interface RecursosOperacionais {
  estrutura_administrativa: boolean;
  atendimento_comercial: boolean;
  suporte_clientes: boolean;
  apoio_tecnico: boolean;
  gestao_pedidos: boolean;
  pos_venda: boolean;
  observacoes?: string;
}

export const RECURSOS_CONFIG: Array<{
  key: keyof Omit<RecursosOperacionais, "observacoes">;
  label: string;
  descricao: string;
  iconName: string;
}> = [
  {
    key: "estrutura_administrativa",
    label: "Estrutura Administrativa",
    descricao: "Controle financeiro, fiscal e rotinas internas",
    iconName: "Building2",
  },
  {
    key: "atendimento_comercial",
    label: "Atendimento Comercial",
    descricao: "Contato ativo e receptivo direto com clientes",
    iconName: "PhoneCall",
  },
  {
    key: "suporte_clientes",
    label: "Suporte aos Clientes",
    descricao: "Esclarecimento de dúvidas, cotações e catálogo",
    iconName: "HelpCircle",
  },
  {
    key: "apoio_tecnico",
    label: "Apoio Técnico",
    descricao: "Especificação técnica, projetos e compatibilização",
    iconName: "Wrench",
  },
  {
    key: "gestao_pedidos",
    label: "Gestão de Pedidos",
    descricao: "Digitação, faturamento e acompanhamento de fábrica",
    iconName: "FileCheck",
  },
  {
    key: "pos_venda",
    label: "Pós-Venda",
    descricao: "Garantias, trocas, devoluções e relacionamento",
    iconName: "ShieldCheck",
  },
];

export type VinculoEquipe = "clt" | "pj" | "socio" | "parceiro" | "outro";

export const VINCULO_LABEL: Record<VinculoEquipe, string> = {
  clt: "CLT",
  pj: "PJ / Prestador",
  socio: "Sócio",
  parceiro: "Parceiro",
  outro: "Outro",
};

export type ModalidadeTrabalho = "presencial" | "remoto" | "hibrido";

export const MODALIDADE_LABEL: Record<ModalidadeTrabalho, string> = {
  presencial: "Presencial",
  remoto: "Remoto",
  hibrido: "Híbrido",
};

export type NivelHierarquico = "titular" | "lideranca" | "operacao" | "apoio";

export const NIVEL_LABEL: Record<NivelHierarquico, string> = {
  titular: "Representante Titular",
  lideranca: "Liderança Comercial",
  operacao: "Operação / Backoffice",
  apoio: "Apoio / Atendimento",
};

export interface MembroEquipe {
  id: string;
  nome: string;
  cargo: string;
  responsabilidades: string[];
  vinculo: VinculoEquipe;
  modalidade: ModalidadeTrabalho;
  nivel: NivelHierarquico;
}

export interface DetalheMunicipal {
  tipo: "todos" | "parcial" | "capital" | "interior";
  descricao?: string;
  municipios?: string[];
}

export type TipoTreinamento =
  | "mini_palestra"
  | "papo_mesa_a_mesa"
  | "rep_vendedores_arquitetos"
  | "trade_nl"
  | "outro";

export const TIPO_TREINAMENTO_LABEL: Record<TipoTreinamento, string> = {
  mini_palestra: "Mini palestra rep para vendedores",
  papo_mesa_a_mesa: "Papo rep: mesa a mesa",
  rep_vendedores_arquitetos: "Rep para vendedores e arquitetos convidados",
  trade_nl: "Trade NL",
  outro: "Outro",
};

export const TIPO_TREINAMENTO_SHORT_LABEL: Record<TipoTreinamento, string> = {
  mini_palestra: "Mini Palestra",
  papo_mesa_a_mesa: "Papo Mesa a Mesa",
  rep_vendedores_arquitetos: "Vendedores & Arquit.",
  trade_nl: "Trade NL",
  outro: "Outro",
};

export const TIPO_TREINAMENTO_COLOR: Record<
  TipoTreinamento,
  { bg: string; text: string; border: string; dot: string }
> = {
  mini_palestra: {
    bg: "bg-blue-500/10 dark:bg-blue-500/20",
    text: "text-blue-700 dark:text-blue-300",
    border: "border-blue-500/30",
    dot: "bg-blue-500",
  },
  papo_mesa_a_mesa: {
    bg: "bg-amber-500/10 dark:bg-amber-500/20",
    text: "text-amber-700 dark:text-amber-300",
    border: "border-amber-500/30",
    dot: "bg-amber-500",
  },
  rep_vendedores_arquitetos: {
    bg: "bg-purple-500/10 dark:bg-purple-500/20",
    text: "text-purple-700 dark:text-purple-300",
    border: "border-purple-500/30",
    dot: "bg-purple-500",
  },
  trade_nl: {
    bg: "bg-teal-500/10 dark:bg-teal-500/20",
    text: "text-teal-700 dark:text-teal-300",
    border: "border-teal-500/30",
    dot: "bg-teal-500",
  },
  outro: {
    bg: "bg-slate-500/10 dark:bg-slate-500/20",
    text: "text-slate-700 dark:text-slate-300",
    border: "border-slate-500/30",
    dot: "bg-slate-400",
  },
};

export interface TreinamentoItem {
  id: string;
  tipo: TipoTreinamento;
  cliente_nome: string;
  data: string; // formato YYYY-MM-DD
  horario?: string; // ex: "09:00"
  local?: string; // ex: "Showroom Loja" ou "Online"
  observacoes?: string;
}

export interface ClienteFrequenciaItem {
  id: string;
  posicao?: number; // 1 a 10
  cliente_nome: string;
  cidade?: string;
  uf?: string;
  frequencia_dias: number; // ex: 40 (dias para retornar)
  observacoes?: string;
}

export interface RepStructure {
  representative_id: string;
  nome_representante?: string;
  empresa_representacao?: string;
  cidade_base?: string;
  estado_base?: string;
  regiao_principal?: string;
  modelo_atuacao: ModeloAtuacao;
  estados_atendidos: string[];
  detalhes_municipais: Record<string, DetalheMunicipal>;
  marcas_representadas: RepresentadaItem[];
  modelo_escritorio: ModeloEscritorio;
  recursos_operacionais: RecursosOperacionais;
  equipe: MembroEquipe[];
  observacoes_gerais?: string;
  treinamentos?: TreinamentoItem[];
  frequencia_visitas?: ClienteFrequenciaItem[];
  updated_at?: string;
}

