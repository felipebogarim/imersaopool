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
  updated_at?: string;
}
