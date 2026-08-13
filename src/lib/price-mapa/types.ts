import { EquivalenceLevel, EquivalenceStatus, SpecValue, Confidence, PriceAvailability } from "../price-comparativos-core";

export type PriceTable = "Black Brasil" | "Black SP";

export type BrandAdjustment = {
  brand: string;
  adjustmentPct: number; // e.g. -5 for 5% discount
};

export type PricingScenario = {
  id: string;
  name: string;
  description?: string;
  adjustments: BrandAdjustment[];
  created_at: string;
  created_by?: string;
};

export type MapaProduct = {
  id: string;
  marca: string;
  sku: string | null;
  referencia: string | null;
  nome: string;
  descricao?: string;
  specs: Record<string, SpecValue>;
  preco_base: number | null;
  preco_normalizado: number | null;
  price_availability: PriceAvailability;
  is_base: boolean;
  base_product_id?: string; // Link to Newline anchor if this is a competitor
  classificacao_tecnica?: EquivalenceLevel;
  /** Texto original da classificação vindo da planilha (nunca sobrescrito). */
  classificacao_texto?: string;
  /** Campos técnicos específicos da família (label -> valor original). */
  tecnicos?: Record<string, string>;
  detalhamento_tecnico?: string;
  proximidade_tecnica?: number; // 0-100
  status: EquivalenceStatus;
  fonte?: string;
  data_fonte?: string;
  notas?: string;
  dimensao_texto?: string;
  nicho_mm?: number;
  dimensoes?: {
    nicho?: number;
    largura?: number;
    altura?: number;
    diametro?: number;
  };
};

export type MapaCalculatedItem = MapaProduct & {
  preco_simulado: number | null;
  diff_absoluta: number | null;
  diff_percentual: number | null;
  farol: "verde" | "amarelo" | "vermelho" | "cinza";
};

export const FAMILIAS_MAPA = [
  "Perfis",
  "Fitas e Fontes",
  "Lâmpadas",
  "Luminárias Técnicas",
  "Luminárias Decorativas",
  "Jardim",
  "Sistemas Lineares"
];
