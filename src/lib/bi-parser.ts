import * as XLSX from "xlsx";

export type FamiliaAgg = {
  categoria: string;
  familia: string;
  participacao: number | null; // % da meta da categoria
  atingimento: number | null; // % realizado/meta
  farol?: string | null;
};

export type BIData = {
  geral: number | null;
  maior_categoria: { label: string | null; participacao: number | null };
  maior_grupo_farol: { label: string | null; participacao: number | null };
  categorias: Array<{ categoria: string; participacao: number | null; atingimento: number | null }>;
  farol: Array<{ grupo: string; participacao: number | null }>;
  piores_familias: Array<{
    categoria: string;
    posicao: number | null;
    familia_pior_atingimento: string | null;
    atingimento_pior: number | null;
    familia_maior_participacao: string | null;
    participacao_maior: number | null;
    atingimento_maior: number | null;
  }>;
  /** Novo padrão (aba "Base BI"): base determinística por categoria × família. */
  familias?: FamiliaAgg[];
  /** Origem do cálculo: "base_bi" (novo) ou "layout_bi" (legado). */
  fonte?: "base_bi" | "layout_bi";
};

const num = (v: any): number | null => {
  if (v == null || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  let s = String(v).trim();
  if (!s) return null;
  const isPct = s.includes("%");
  s = s.replace(/%/g, "").replace(/R\$\s*/gi, "").replace(/\s/g, "");
  // pt-BR: 1.234,56 -> 1234.56 ; en: 1,234.56 -> 1234.56
  if (s.includes(",") && s.includes(".")) {
    s = s.lastIndexOf(",") > s.lastIndexOf(".") ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  } else if (s.includes(",")) {
    s = s.replace(",", ".");
  }
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return isPct ? n : n;
};
const str = (v: any): string | null => (v == null || v === "" ? null : String(v).trim());

/** Normaliza texto: minúsculo, sem acentos, sem pontuação redundante. */
const norm = (v: any): string =>
  String(v ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9%]+/g, " ")
    .trim();

/** Converte razão/percentual preservando decimais pequenos (nunca arredonda para zero). */
const toPct = (v: number | null): number | null => {
  if (v == null || Number.isNaN(v)) return null;
  return Math.abs(v) <= 1.5 ? v * 100 : v;
};

// ---------------------------------------------------------------------------
// Novo padrão: aba "Base BI"
// ---------------------------------------------------------------------------

const COL_SYNONYMS: Record<string, string[]> = {
  categoria: ["categoria", "categoria cliente", "cat", "classificacao", "grupo cliente"],
  familia: ["familia", "familia produto", "familia de produto", "familia de produtos", "linha", "produto"],
  meta: ["meta", "meta r%", "meta r", "meta valor", "meta rs", "valor meta", "meta periodo", "meta total"],
  realizado: [
    "realizado",
    "realizado r",
    "venda",
    "vendas",
    "faturado",
    "faturamento",
    "vendido",
    "valor realizado",
    "realizado valor",
  ],
  atingimento: ["atingimento", "atingimento %", "atingimento meta", "ating", "% atingimento", "perc atingimento"],
  coeficiente: ["coeficiente", "coef", "fator", "fator farol"],
  indice: ["indice ponderado", "indice", "index ponderado"],
  participacao: ["participacao", "participacao %", "% participacao", "share", "part"],
  farol: ["farol", "faixa", "faixa %", "status", "grupo farol", "grupo do farol"],
  cliente: ["cliente", "razao social", "razao", "nome cliente"],

};

function matchColumn(header: string): string | null {
  const h = norm(header);
  if (!h) return null;
  for (const [key, syns] of Object.entries(COL_SYNONYMS)) {
    for (const s of syns) {
      const sn = norm(s);
      if (h === sn || h.startsWith(sn + " ") || h === sn + " %" || h.replace(/ /g, "") === sn.replace(/ /g, "")) {
        return key;
      }
    }
  }
  // fallback: contém a palavra-chave principal
  for (const [key, syns] of Object.entries(COL_SYNONYMS)) {
    if (syns.some((s) => h.includes(norm(s)) && norm(s).length >= 4)) return key;
  }
  return null;
}

const FAROL_FAIXAS: Array<{ label: string; test: (p: number) => boolean }> = [
  { label: "Sem compra", test: (p) => p === 0 },
  { label: "Abaixo da meta", test: (p) => p > 0 && p < 50 },
  { label: "Pode melhorar", test: (p) => p >= 50 && p < 70 },
  { label: "Próximo", test: (p) => p >= 70 && p < 90 },
  { label: "Ótimo", test: (p) => p >= 90 && p <= 100 },
  { label: "Excelente", test: (p) => p > 100 },
];
const FAROL_LABELS = FAROL_FAIXAS.map((f) => f.label);

const farolFromPct = (p: number | null): string | null => {
  if (p == null || Number.isNaN(p)) return null;
  return FAROL_FAIXAS.find((f) => f.test(p))?.label ?? null;
};

/** Coeficiente gerencial (ponto médio da faixa) a partir do rótulo do farol, em %. */
const coefFromFarol = (raw: string): number | null => {
  const r = norm(raw);
  if (r.includes("sem")) return 0;
  if (r.includes("abaixo")) return 25;
  if (r.includes("melhorar")) return 60;
  if (r.includes("proximo")) return 80;
  if (r.includes("otimo")) return 95;
  if (r.includes("excelente")) return 110;
  return null;
};

const normalizeFarolLabel = (raw: string | null, pct: number | null): string | null => {

  if (!raw) return farolFromPct(pct);
  const r = norm(raw);
  const direct = FAROL_LABELS.find((l) => norm(l) === r || r.includes(norm(l)));
  if (direct) return direct;
  if (r.includes("sem")) return "Sem compra";
  if (r.includes("abaixo") || r.startsWith("50")) return "Abaixo da meta";
  if (r.includes("melhorar")) return "Pode melhorar";
  if (r.includes("proximo")) return "Próximo";
  if (r.includes("otimo")) return "Ótimo";
  if (r.includes("excelente")) return "Excelente";
  return farolFromPct(pct);
};

function findBaseSheet(wb: XLSX.WorkBook): string | null {
  const target = wb.SheetNames.find((n) => norm(n) === "base bi" || norm(n).startsWith("base bi"));
  if (target) return target;
  return wb.SheetNames.find((n) => norm(n).includes("base") && norm(n).includes("bi")) ?? null;
}

function parseBaseBI(ws: XLSX.WorkSheet): BIData {
  const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false, defval: null });

  // Localiza a linha de cabeçalho (a que reconhece mais colunas conhecidas).
  let headerRow = -1;
  let headerMap: Record<string, number> = {};
  let best = 0;
  for (let r = 0; r < Math.min(rows.length, 30); r++) {
    const map: Record<string, number> = {};
    (rows[r] ?? []).forEach((cell, idx) => {
      const key = matchColumn(String(cell ?? ""));
      if (key && map[key] == null) map[key] = idx;
    });
    const score = Object.keys(map).length;
    if (score > best) {
      best = score;
      headerRow = r;
      headerMap = map;
    }
  }

  const missing: string[] = [];
  if (headerMap.categoria == null) missing.push('"Categoria"');
  if (headerMap.familia == null) missing.push('"Família"');
  const hasMeta = headerMap.meta != null;
  const hasAting = headerMap.atingimento != null;
  const hasReal = headerMap.realizado != null;
  const hasCoef = headerMap.coeficiente != null;
  const hasIndice = headerMap.indice != null;
  const hasFarol = headerMap.farol != null;
  if (!hasMeta && headerMap.participacao == null) missing.push('"Meta" (ou "Participação")');
  if (!hasAting && !(hasMeta && hasReal) && !hasCoef && !(hasIndice && hasMeta) && !hasFarol)
    missing.push('"Atingimento" (ou "Meta" + "Realizado", ou "Coeficiente"/"Índice ponderado", ou "Grupo do farol")');

  if (missing.length) {
    throw new Error(
      `Aba "Base BI": coluna(s) obrigatória(s) ausente(s): ${missing.join(
        ", ",
      )}. Colunas reconhecidas: ${Object.keys(headerMap).join(", ") || "nenhuma"}.`,
    );
  }

  type Agg = { meta: number; realizado: number; atingSum: number; atingWeight: number };
  const key = (c: string, f: string) => `${c}\u0000${f}`;
  const cells = new Map<string, Agg & { categoria: string; familia: string; farol: string | null }>();
  const farolMeta = new Map<string, number>();
  let anyRow = false;

  for (let r = headerRow + 1; r < rows.length; r++) {
    const row = rows[r] ?? [];
    const categoria = str(row[headerMap.categoria]);
    const familia = str(row[headerMap.familia]);
    if (!categoria || !familia) continue;
    if (norm(categoria).startsWith("total")) continue;

    const meta = hasMeta ? num(row[headerMap.meta]) ?? 0 : 0;
    const realizado = hasReal ? num(row[headerMap.realizado]) ?? 0 : 0;
    const coef = hasCoef ? num(row[headerMap.coeficiente]) : null;
    const indice = hasIndice ? num(row[headerMap.indice]) : null;
    const farolRaw = hasFarol ? str(row[headerMap.farol]) : null;
    let ating = hasAting ? toPct(num(row[headerMap.atingimento])) : null;
    if (ating == null && hasReal && meta > 0) ating = (realizado / meta) * 100;
    if (ating == null && coef != null) ating = coef * 100;
    if (ating == null && indice != null && meta > 0) ating = (indice / meta) * 100;
    // O farol importado é apenas um rótulo visual; nunca é convertido em percentual.
    const farolLabel = normalizeFarolLabel(farolRaw, ating);

    anyRow = true;
    const k = key(categoria, familia);
    const cur =
      cells.get(k) ??
      { categoria, familia, meta: 0, realizado: 0, atingSum: 0, atingWeight: 0, farol: farolLabel };
    cur.meta += meta;
    cur.realizado += realizado;
    if (ating != null) {
      const w = meta > 0 ? meta : 1;
      cur.atingSum += ating * w;
      cur.atingWeight += w;
    }
    cur.farol = cur.farol ?? farolLabel;
    cells.set(k, cur);

    if (farolLabel) {
      const w = meta > 0 ? meta : 1;
      const contrib = ating != null ? (w * ating) / 100 : w;
      farolMeta.set(farolLabel, (farolMeta.get(farolLabel) ?? 0) + contrib);
    }
  }

  if (!anyRow) throw new Error('Aba "Base BI" sem linhas válidas (Categoria + Família).');

  const list = [...cells.values()].map((c) => {
    const atingimento =
      c.atingWeight > 0 ? c.atingSum / c.atingWeight : c.meta > 0 ? (c.realizado / c.meta) * 100 : null;
    // Índice ponderado = meta × atingimento (base da participação ponderada).
    const indice = atingimento != null ? (c.meta > 0 ? c.meta : 1) * (atingimento / 100) : c.meta;
    return { ...c, atingimento, indice };
  });

  const indiceTotal = list.reduce((s, c) => s + c.indice, 0);
  const catNames = [...new Set(list.map((c) => c.categoria))];

  const categorias = catNames.map((cat) => {
    const items = list.filter((c) => c.categoria === cat);
    const indiceCat = items.reduce((s, c) => s + c.indice, 0);
    const num_ = items.reduce((s, c) => s + (c.atingimento ?? 0) * (c.meta > 0 ? c.meta : 1), 0);
    const den = items.reduce((s, c) => s + (c.atingimento != null ? (c.meta > 0 ? c.meta : 1) : 0), 0);
    return {
      categoria: cat,
      participacao: indiceTotal > 0 ? (indiceCat / indiceTotal) * 100 : null,
      atingimento: den > 0 ? num_ / den : null,
    };
  });

  const familias: FamiliaAgg[] = list.map((c) => {
    const indiceCat = list.filter((x) => x.categoria === c.categoria).reduce((s, x) => s + x.indice, 0);
    return {
      categoria: c.categoria,
      familia: c.familia,
      participacao: indiceCat > 0 ? (c.indice / indiceCat) * 100 : null,
      atingimento: c.atingimento,
      farol: farolFromPct(c.atingimento) ?? c.farol ?? null,
    };
  });

  const farolTotal = [...farolMeta.values()].reduce((s, v) => s + v, 0);
  const farol = FAROL_LABELS.map((label) => ({
    grupo: label,
    participacao: farolTotal > 0 ? ((farolMeta.get(label) ?? 0) / farolTotal) * 100 : 0,
  }));



  // Três menores (pior atingimento) e três maiores (maior participação) por categoria.
  const piores_familias: BIData["piores_familias"] = [];
  for (const cat of catNames) {
    const items = familias.filter((f) => f.categoria === cat);
    const piores = [...items]
      .filter((f) => f.atingimento != null)
      .sort((a, b) => (a.atingimento as number) - (b.atingimento as number));
    const maiores = [...items]
      .filter((f) => f.participacao != null)
      .sort((a, b) => (b.participacao as number) - (a.participacao as number));
    for (let i = 0; i < 3; i++) {
      const p = piores[i];
      const m = maiores[i];
      if (!p && !m) break;
      piores_familias.push({
        categoria: cat,
        posicao: i + 1,
        familia_pior_atingimento: p?.familia ?? null,
        atingimento_pior: p?.atingimento ?? null,
        familia_maior_participacao: m?.familia ?? null,
        participacao_maior: m?.participacao ?? null,
        atingimento_maior: m?.atingimento ?? null,
      });
    }
  }

  const geralNum = list.reduce((s, c) => s + (c.atingimento ?? 0) * (c.meta > 0 ? c.meta : 1), 0);
  const geralDen = list.reduce((s, c) => s + (c.atingimento != null ? (c.meta > 0 ? c.meta : 1) : 0), 0);
  
  // Atingimento geral ponderado canônico (Matriz Financeira)
  // Nota: BI de representante usa média ponderada por meta financeira real da aba Matriz.
  const geral = geralDen > 0 ? geralNum / geralDen : null;

  const maiorCat = [...categorias].sort((a, b) => (b.participacao ?? 0) - (a.participacao ?? 0))[0] ?? null;
  const maiorFarol = [...farol].sort((a, b) => (b.participacao ?? 0) - (a.participacao ?? 0))[0] ?? null;

  return {
    geral: geralDen > 0 ? geralNum / geralDen : null,
    maior_categoria: { label: maiorCat?.categoria ?? null, participacao: maiorCat?.participacao ?? null },
    maior_grupo_farol: { label: maiorFarol?.grupo ?? null, participacao: maiorFarol?.participacao ?? null },
    categorias,
    farol,
    piores_familias,
    familias,
    fonte: "base_bi",
  };
}

// ---------------------------------------------------------------------------
// Padrão legado: aba "BI" desenhada por blocos rotulados
// ---------------------------------------------------------------------------

function parseLayoutBI(ws: XLSX.WorkSheet): BIData {
  const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: true, defval: null });

  const findRow = (needle: string) =>
    rows.findIndex((r) => (r ?? []).some((c) => typeof c === "string" && c.toUpperCase().includes(needle)));

  const iGeral = findRow("ATINGIMENTO PONDERADO GERAL");
  const iCats = findRow("PARTICIPAÇÃO DAS CATEGORIAS");
  const iFarol = findRow("DISTRIBUIÇÃO DOS GRUPOS DO FAROL");
  const iPiores = findRow("TRÊS PIORES FAMÍLIAS");

  const data: BIData = {
    geral: null,
    maior_categoria: { label: null, participacao: null },
    maior_grupo_farol: { label: null, participacao: null },
    categorias: [],
    farol: [],
    piores_familias: [],
    fonte: "layout_bi",
  };

  if (iGeral >= 0 && rows[iGeral + 1]) {
    const r = rows[iGeral + 1];
    data.geral = num(r[0]);
    data.maior_categoria = { label: str(r[4]), participacao: num(r[7]) };
    data.maior_grupo_farol = { label: str(r[9]), participacao: num(r[12]) };
  }

  if (iCats >= 0) {
    for (let i = iCats + 2; i < rows.length; i++) {
      const r = rows[i] ?? [];
      const cat = str(r[0]);
      if (!cat || cat.toUpperCase().includes("DISTRIBUIÇÃO") || cat.toUpperCase().includes("TRÊS")) break;
      data.categorias.push({ categoria: cat, participacao: num(r[1]), atingimento: num(r[2]) });
    }
  }

  if (iFarol >= 0) {
    for (let i = iFarol + 2; i < rows.length; i++) {
      const r = rows[i] ?? [];
      const g = str(r[0]);
      if (!g || g.toUpperCase().includes("TRÊS") || g.toUpperCase().includes("PIORES")) break;
      data.farol.push({ grupo: g, participacao: num(r[1]) });
    }
  }

  if (iPiores >= 0) {
    for (let i = iPiores + 2; i < rows.length; i++) {
      const r = rows[i] ?? [];
      const cat = str(r[0]);
      if (!cat) break;
      data.piores_familias.push({
        categoria: cat,
        posicao: num(r[1]),
        familia_pior_atingimento: str(r[2]),
        atingimento_pior: num(r[3]),
        familia_maior_participacao: str(r[5]),
        participacao_maior: num(r[6]),
        atingimento_maior: num(r[7]),
      });
    }
  }

  const vazio =
    data.geral == null && !data.categorias.length && !data.farol.length && !data.piores_familias.length;
  if (vazio) {
    throw new Error(
      'Formato de planilha de BI não reconhecido. Inclua uma aba "Base BI" (Categoria, Família, Meta, Realizado ou Atingimento) ou use o layout antigo da aba "BI".',
    );
  }

  return data;
}

export function parseBIWorkbook(buf: ArrayBuffer): BIData {
  const wb = XLSX.read(buf, { type: "array" });

  // 1) Fonte principal e determinística: aba "Base BI".
  const baseName = findBaseSheet(wb);
  if (baseName && wb.Sheets[baseName]) {
    return parseBaseBI(wb.Sheets[baseName]);
  }

  // 2) Fallback (arquivos antigos): aba "BI" com blocos rotulados.
  const sheetName = wb.SheetNames.find((n) => n.toUpperCase().includes("BI")) ?? wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  if (!ws) throw new Error("Planilha BI não encontrada.");
  return parseLayoutBI(ws);
}
