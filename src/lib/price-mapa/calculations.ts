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
    // If Newline (46.20) and Comp (107.10), diff is ((46.20 - 107.10) / 107.10) * 100 = -56.8%
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
