import * as XLSX from "xlsx";

export type MapaCelula = { familia: string; texto: string };
export type MapaRep = { nome: string; linhas: Record<string, Record<string, string>> };

export type MapaFamiliaPayload = {
  familias: string[];
  itens: string[];
  consolidado: { colunas: string[]; linhas: { familia: string; valores: Record<string, string> }[] };
  representantes: MapaRep[];
  fontes: { representante: string; data: string | null }[];
};

/** Ordem dos itens da matriz (linhas), replicando a planilha oficial. */
export const ITENS_PADRAO = [
  "O que funciona bem",
  "O que não funciona bem",
  "O que o concorrente tem de melhor",
  "Como é nosso preço",
  "Competidor principal",
  "Competidor 2",
  "Competidor 3",
];

/** Paleta oficial da planilha, replicada em tokens visuais. */
export function toneDoItem(item: string): "positivo" | "negativo" | "concorrente" | "preco" | "competidor" {
  const t = item.toLowerCase();
  if (t.includes("não funciona")) return "negativo";
  if (t.includes("funciona")) return "positivo";
  if (t.includes("concorrente tem")) return "concorrente";
  if (t.includes("preço")) return "preco";
  return "competidor";
}

export function toneDaColuna(coluna: string): ReturnType<typeof toneDoItem> {
  const c = coluna.toLowerCase();
  if (c.includes("não funciona")) return "negativo";
  if (c.includes("funciona")) return "positivo";
  if (c.includes("vantagem")) return "concorrente";
  if (c.includes("preço")) return "preco";
  return "competidor";
}

function grid(ws: XLSX.WorkSheet): string[][] {
  const rows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, blankrows: true, defval: "" });
  return rows.map(r => (r ?? []).map(c => (c === null || c === undefined ? "" : String(c).trim())));
}

export function parseMapaFamilia(buffer: ArrayBuffer, arquivo?: string): MapaFamiliaPayload {
  const wb = XLSX.read(buffer, { type: "array" });

  const nomeAba = (alvo: string) =>
    wb.SheetNames.find(n => n.toLowerCase().replace(/\s+/g, "") === alvo.toLowerCase().replace(/\s+/g, ""));

  // ---- Consolidado ----
  const abaCons = nomeAba("Consolidado");
  let colunas: string[] = [];
  const linhasCons: { familia: string; valores: Record<string, string> }[] = [];
  if (abaCons) {
    const g = grid(wb.Sheets[abaCons]);
    const head = g.findIndex(r => (r[0] ?? "").toUpperCase().startsWith("FAMÍLIA") || (r[0] ?? "").toUpperCase().startsWith("FAMILIA"));
    if (head >= 0) {
      colunas = g[head].slice(1).filter(Boolean);
      for (let i = head + 1; i < g.length; i++) {
        const familia = g[i][0];
        if (!familia) continue;
        const valores: Record<string, string> = {};
        colunas.forEach((c, j) => (valores[c] = g[i][j + 1] ?? ""));
        linhasCons.push({ familia, valores });
      }
    }
  }

  // ---- Matriz Geral (blocos por representante) ----
  const abaMatriz = nomeAba("Matriz Geral");
  const representantes: MapaRep[] = [];
  let familias: string[] = [];
  const itens: string[] = [];
  if (abaMatriz) {
    const g = grid(wb.Sheets[abaMatriz]);
    let atual: MapaRep | null = null;
    let cols: string[] = [];
    for (let i = 0; i < g.length; i++) {
      const row = g[i];
      const a = row[0] ?? "";
      if (!a) continue;
      const resto = row.slice(1).filter(Boolean);
      if (a.toUpperCase().startsWith("MATRIZ GERAL")) continue;
      if (a.toUpperCase() === "ITEM") {
        cols = row.slice(1).filter(Boolean);
        if (!familias.length) familias = cols;
        continue;
      }
      if (!resto.length) {
        // cabeçalho de bloco = nome do representante
        atual = { nome: a, linhas: {} };
        representantes.push(atual);
        cols = [];
        continue;
      }
      if (atual && cols.length) {
        if (!itens.includes(a)) itens.push(a);
        const valores: Record<string, string> = {};
        cols.forEach((c, j) => (valores[c] = row[j + 1] ?? ""));
        atual.linhas[a] = valores;
      }
    }
  }

  if (!familias.length) familias = linhasCons.map(l => l.familia);

  // ---- Fontes ----
  const abaFontes = nomeAba("Fontes");
  const fontes: { representante: string; data: string | null }[] = [];
  if (abaFontes) {
    const g = grid(wb.Sheets[abaFontes]);
    for (const r of g.slice(1)) {
      if (!r[0] || r[0].toUpperCase().startsWith("REFERÊNCIA") || r[0].toUpperCase() === "REPRESENTANTE") continue;
      if (!r[1]) continue;
      fontes.push({ representante: r[0], data: r[1] || null });
    }
  }

  const payload: MapaFamiliaPayload = {
    familias,
    itens: itens.length ? itens : ITENS_PADRAO,
    consolidado: { colunas, linhas: linhasCons },
    representantes,
    fontes,
  };

  if (!payload.consolidado.linhas.length && !payload.representantes.length) {
    throw new Error("Planilha sem as abas esperadas (Consolidado / Matriz Geral).");
  }
  void arquivo;
  return payload;
}
