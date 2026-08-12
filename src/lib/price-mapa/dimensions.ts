import { MapaProduct } from "./types";

/** Deriva texto de dimensão a partir dos campos numéricos quando o texto não veio da planilha. */
export function derivarDimensaoTexto(p: Partial<MapaProduct>): string {
  if (p.dimensao_texto) return p.dimensao_texto;
  const d = p.dimensoes;
  if (!d) return "";
  const partes = [d.largura, d.altura].filter((v) => typeof v === "number" && v > 0) as number[];
  if (partes.length === 0) return "";
  if (p.is_base) return `1000 x ${partes.join(" x ")} mm`;
  return `${partes.join(" x ")} mm`;
}

export function nichoMm(p: Partial<MapaProduct>): number | undefined {
  return p.nicho_mm ?? p.dimensoes?.nicho;
}

/** Preenche campos derivados sem alterar preços, ids ou quantidade de registros. */
export function enriquecerProdutos<T extends MapaProduct>(items: T[]): T[] {
  return items.map((item) => ({
    ...item,
    dimensao_texto: derivarDimensaoTexto(item),
    nicho_mm: nichoMm(item),
    notas: item.notas ?? "",
  }));
}
