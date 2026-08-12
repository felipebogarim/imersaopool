import { MapaProduct, MapaCalculatedItem, BrandAdjustment } from "../types";
import { EquivalenceLevel, EquivalenceStatus } from "../../price-comparativos-core";

export interface RawMapaRow {
  familia: string;
  base_produto: string;
  base_codigo: string;
  base_preco: number;
  concorrente_marca: string;
  concorrente_modelo: string;
  concorrente_codigo?: string;
  concorrente_preco: number;
  classificacao: string;
  nicho?: number;
  largura?: number;
  altura?: number;
  notas?: string;
}

/**
 * Mapeia a classificação textual da planilha para o enum EquivalenceLevel
 */
function mapClassificacao(text: string): EquivalenceLevel {
  const t = text.toLowerCase();
  if (t.includes("direto")) return "direto";
  if (t.includes("forte")) return "aproximado"; // Aproximado forte
  if (t.includes("aproximado")) return "aproximado";
  if (t.includes("alternativa")) return "alternativa";
  if (t.includes("incompatível")) return "incompativel";
  return "alternativa"; // Default
}

/**
 * Processa linhas brutas da planilha Excel para o formato MapaProduct
 */
export function processRawMapaRows(rows: RawMapaRow[]): { anchors: MapaProduct[], competitors: MapaProduct[] } {
  const anchorsMap = new Map<string, MapaProduct>();
  const competitors: MapaProduct[] = [];

  rows.forEach((row, index) => {
    // 1. Criar ou obter Produto Âncora (Newline)
    const anchorId = `anchor-${row.base_codigo}`;
    if (!anchorsMap.has(anchorId)) {
      anchorsMap.set(anchorId, {
        id: anchorId,
        marca: "Newline",
        sku: row.base_codigo,
        referencia: row.base_produto,
        nome: row.base_produto,
        specs: {},
        preco_base: row.base_preco,
        preco_normalizado: row.base_preco,
        price_availability: "informado",
        is_base: true,
        status: "validado"
      });
    }

    // 2. Criar Concorrente
    // Importante: Cada linha é uma comparação independente. 
    // A ID deve ser única para cada comparação.
    const compId = `comp-${index}-${row.concorrente_marca}-${row.concorrente_modelo}`.replace(/\s+/g, '-').toLowerCase();
    
    // Regra especial: Usina Bob 30865 = R$ 39,60/m
    let precoNormalizado = row.concorrente_preco;
    if (row.concorrente_marca.toLowerCase().includes("usina") && row.concorrente_modelo.toLowerCase().includes("bob")) {
      precoNormalizado = 39.60;
    }

    competitors.push({
      id: compId,
      marca: row.concorrente_marca,
      sku: row.concorrente_codigo || null,
      referencia: row.concorrente_modelo,
      nome: row.concorrente_modelo,
      specs: {},
      preco_base: row.concorrente_preco,
      preco_normalizado: precoNormalizado,
      price_availability: "informado",
      is_base: false,
      base_product_id: anchorId,
      classificacao_tecnica: mapClassificacao(row.classificacao),
      status: "validado",
      notas: row.notas,
      dimensoes: {
        nicho: row.nicho,
        largura: row.largura,
        altura: row.altura
      }
    });
  });

  return {
    anchors: Array.from(anchorsMap.values()),
    competitors
  };
}
