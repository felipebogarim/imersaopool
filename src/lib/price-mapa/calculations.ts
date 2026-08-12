import { MapaProduct, MapaCalculatedItem, BrandAdjustment } from "./types";

export function calculateMapaItem(
  comp: MapaProduct,
  baseProducts: MapaProduct[],
  adjustments: BrandAdjustment[]
): MapaCalculatedItem {
  const base = baseProducts.find(p => p.id === comp.base_product_id);
  const brandAdj = adjustments.find(a => a.brand === comp.marca);
  
  const preco_simulado = comp.preco_normalizado !== null 
    ? comp.preco_normalizado * (1 + (brandAdj?.adjustmentPct ?? 0) / 100)
    : null;

  let diff_absoluta = null;
  let diff_percentual = null;
  let farol: "verde" | "amarelo" | "vermelho" | "cinza" = "cinza";

  if (base && base.preco_normalizado !== null && preco_simulado !== null && preco_simulado > 0) {
    diff_absoluta = base.preco_normalizado - preco_simulado;
    // Formula: ((Preço Newline - Preço Concorrente) / Preço Concorrente) * 100
    diff_percentual = ((base.preco_normalizado - preco_simulado) / preco_simulado) * 100;

    // RULE 14: 
    // VERDE: Preço Newline < preço concorrente (Newline está mais barata)
    // AMARELO: Preço Newline é igual ou até 10% superior ao concorrente
    // VERMELHO: Preço Newline é mais de 10% superior ao concorrente
    if (base.preco_normalizado < preco_simulado) {
      farol = "verde";
    } else if (diff_percentual <= 10) {
      farol = "amarelo";
    } else {
      farol = "vermelho";
    }
  }

  return {
    ...comp,
    preco_simulado,
    diff_absoluta,
    diff_percentual,
    farol
  };
}

export function calculateTechnicalProximity(a: MapaProduct, b: MapaProduct): number {
  if (!a.dimensoes || !b.dimensoes) return 0;
  
  let score = 100;
  const weights = { nicho: 40, largura: 30, altura: 30 };
  
  if (a.dimensoes.nicho !== b.dimensoes.nicho) {
    const diff = Math.abs((a.dimensoes.nicho || 0) - (b.dimensoes.nicho || 0));
    score -= Math.min(weights.nicho, diff * 5);
  }
  
  if (a.dimensoes.largura !== b.dimensoes.largura) {
    const diff = Math.abs((a.dimensoes.largura || 0) - (b.dimensoes.largura || 0));
    score -= Math.min(weights.largura, diff * 5);
  }
  
  if (a.dimensoes.altura !== b.dimensoes.altura) {
    const diff = Math.abs((a.dimensoes.altura || 0) - (b.dimensoes.altura || 0));
    score -= Math.min(weights.altura, diff * 5);
  }
  
  return Math.max(0, Math.round(score));
}
