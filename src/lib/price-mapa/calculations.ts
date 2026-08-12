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

  if (base && base.preco_normalizado !== null && preco_simulado !== null) {
    diff_absoluta = base.preco_normalizado - preco_simulado;
    // Formula: ((Preço Newline - Preço Concorrente) / Preço Concorrente) * 100
    diff_percentual = ((base.preco_normalizado - preco_simulado) / preco_simulado) * 100;

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
