import { MapaProduct } from "../types";
import { EquivalenceLevel } from "../../price-comparativos-core";

export interface RawMapaRow {
  familia: string;
  /** Marca base da família (Newline, Studio, ...). Genérico por família. */
  base_brand?: string;
  base_descricao?: string;
  /** Campos técnicos da família (label -> valor original). */
  tecnicos?: Record<string, string>;
  status_texto?: string;
  base_produto: string;
  base_codigo: string;
  base_preco: number | null;
  concorrente_marca: string;
  concorrente_modelo: string;
  concorrente_codigo?: string;
  concorrente_preco: number | null;
  classificacao: string;
  nicho?: number;
  largura?: number;
  altura?: number;
  notas?: string;
  dimensao_newline?: string;
  nicho_newline?: number | string;
  dimensao_concorrente?: string;
  fonte?: string;
}

/**
 * Mapeia a classificação textual da planilha para o enum EquivalenceLevel
 * e preserva o detalhamento técnico original.
 */
export function mapClassificacao(text: string): { nivel: EquivalenceLevel; detalhe?: string } {
  const original = (text || "").trim();
  const t = original.toLowerCase();
  const detalhe = original || undefined;

  const nivel = ((): EquivalenceLevel => {
    if (t === "equivalente direto" || t === "direto") return "direto";
    if (t === "equivalente aproximado") return "aproximado";
    if (t === "aproximado forte" || t === "aproximado") return "aproximado";
    if (t === "alternativa" || t === "alternativo" || t === "alternativa estrutural") return "alternativo";
    if (t === "incompativel" || t === "incompatível") return "incompativel";

    if (t.includes("direto")) return "direto";
    if (t.includes("forte")) return "aproximado";
    if (t.includes("aproximado")) return "aproximado";
    if (t.includes("estrutural")) return "alternativo";
    if (t.includes("alternativ")) return "alternativo";
    if (t.includes("incompativel") || t.includes("incompatível")) return "incompativel";
    return "alternativo";
  })();

  // Detalhamento só é relevante quando difere do rótulo principal
  const rotuloPrincipal: Record<EquivalenceLevel, string> = {
    direto: "equivalente direto",
    aproximado: "equivalente aproximado",
    alternativo: "alternativo",
    incompativel: "incompatível tecnicamente",
    insuficiente: "dados insuficientes",
  };

  void rotuloPrincipal;
  // Preservamos sempre o texto original da planilha; o enum é apenas um índice interno.
  return { nivel, detalhe };
}

function cleanText(v: unknown): string | undefined {
  if (v === undefined || v === null) return undefined;
  const s = String(v).trim();
  return s.length ? s : undefined;
}

function toNumber(v: unknown): number | undefined {
  if (v === undefined || v === null || v === "") return undefined;
  const n = Number(String(v).replace(/[^\d.,-]/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Processa linhas brutas da planilha Excel para o formato MapaProduct
 */
export function processRawMapaRows(rows: RawMapaRow[]): { anchors: MapaProduct[], competitors: MapaProduct[] } {
  const anchorsMap = new Map<string, MapaProduct>();
  const competitors: MapaProduct[] = [];

  rows.forEach((row) => {
    // 1. Criar ou obter Produto Âncora (Newline)
    const anchorId = `anchor-${row.base_codigo}`.replace(/\s+/g, '-').toLowerCase();
    const dimNewline = cleanText(row.dimensao_newline);
    const nichoNewline = toNumber(row.nicho_newline) ?? row.nicho;

    if (!anchorsMap.has(anchorId)) {
      anchorsMap.set(anchorId, {
        id: anchorId,
        marca: row.base_brand || "Newline",
        sku: row.base_codigo,
        referencia: row.base_produto,
        nome: row.base_produto,
        descricao: cleanText(row.base_descricao),
        specs: {},
        tecnicos: row.tecnicos,
        preco_base: row.base_preco,
        preco_normalizado: row.base_preco,
        price_availability: row.base_preco !== null ? "informado" : "nao_informado",
        is_base: true,
        status: "validado",
        dimensao_texto: dimNewline,
        nicho_mm: nichoNewline,
        fonte: cleanText(row.fonte),
        dimensoes: { nicho: nichoNewline },
      });
    } else {
      const existing = anchorsMap.get(anchorId)!;
      existing.dimensao_texto = existing.dimensao_texto ?? dimNewline;
      existing.nicho_mm = existing.nicho_mm ?? nichoNewline;
      existing.fonte = existing.fonte ?? cleanText(row.fonte);
    }

    // 2. Criar Concorrente
    // Chave lógica: Família + Produto Base Newline + Código Newline + Marca Concorrente + Modelo Concorrente
    const logicalKey = `${row.familia}-${row.base_produto}-${row.base_codigo}-${row.concorrente_marca}-${row.concorrente_modelo}`.toLowerCase().replace(/\s+/g, '-');
    const compId = `comp-${logicalKey}`;

    // Regra especial: Usina Bob 30865 = R$ 39,60/m
    let precoNormalizado = row.concorrente_preco;
    if (row.concorrente_marca?.toLowerCase().includes("usina") && row.concorrente_modelo?.toLowerCase().includes("bob")) {
      precoNormalizado = 39.60;
    }

    const { nivel, detalhe } = mapClassificacao(row.classificacao);

    competitors.push({
      id: compId,
      marca: row.concorrente_marca,
      sku: row.concorrente_codigo || null,
      referencia: row.concorrente_modelo,
      nome: row.concorrente_modelo,
      specs: {},
      preco_base: row.concorrente_preco,
      preco_normalizado: precoNormalizado,
      price_availability: precoNormalizado !== null ? "informado" : "nao_informado",
      is_base: false,
      base_product_id: anchorId,
      classificacao_tecnica: nivel,
      detalhamento_tecnico: detalhe,
      // Novas comparações entram sempre como "Em análise".
      // Somente ação manual autorizada pode alterar para validado/incompatível.
      status: "em_analise",
      classificacao_texto: cleanText(row.classificacao),
      tecnicos: row.tecnicos,
      notas: cleanText(row.notas) ?? "",
      fonte: cleanText(row.fonte),
      dimensao_texto: cleanText(row.dimensao_concorrente),
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
