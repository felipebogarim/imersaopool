import * as XLSX from "xlsx";

// BI do cliente: mesma estrutura do BI do representante, porém a seção
// "PARTICIPAÇÃO DAS CATEGORIAS" é substituída por "PARTICIPAÇÃO DAS FAMÍLIAS"
// (o cliente pertence a apenas uma categoria).
export type ClientBIData = {
  geral: number | null;
  categoria: string | null;
  maior_familia: { label: string | null; participacao: number | null };
  maior_grupo_farol: { label: string | null; participacao: number | null };
  familias: Array<{ familia: string; participacao: number | null; atingimento: number | null }>;
  farol: Array<{ grupo: string; participacao: number | null }>;
  piores_familias: Array<{
    posicao: number | null;
    familia_pior_atingimento: string | null;
    atingimento_pior: number | null;
    familia_maior_participacao: string | null;
    participacao_maior: number | null;
    atingimento_maior: number | null;
  }>;
};

const num = (v: any): number | null => {
  if (v == null || v === "") return null;
  if (typeof v === "number") return v;
  const s = String(v).replace("%", "").replace(",", ".").trim();
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};
const str = (v: any): string | null => (v == null || v === "" ? null : String(v).trim());

export function parseClientBIWorkbook(buf: ArrayBuffer): ClientBIData {
  const wb = XLSX.read(buf, { type: "array" });
  const sheetName = wb.SheetNames.find((n) => n.toUpperCase().includes("BI")) ?? wb.SheetNames[0];
  return parseClientBISheet(wb.Sheets[sheetName]);
}

function parseClientBISheet(ws: any): ClientBIData {
  if (!ws) throw new Error("Planilha BI não encontrada.");
  const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: true, defval: null });

  const findRow = (needle: string) =>
    rows.findIndex((r) => (r ?? []).some((c) => typeof c === "string" && c.toUpperCase().includes(needle)));

  const iGeral = findRow("ATINGIMENTO PONDERADO GERAL");
  const iFams = findRow("PARTICIPAÇÃO DAS FAMÍLIAS");
  const iFarol = findRow("DISTRIBUIÇÃO DOS GRUPOS DO FAROL");
  const iPiores = findRow("TRÊS PIORES FAMÍLIAS");

  const data: ClientBIData = {
    geral: null,
    categoria: null,
    maior_familia: { label: null, participacao: null },
    maior_grupo_farol: { label: null, participacao: null },
    familias: [],
    farol: [],
    piores_familias: [],
  };

  if (iGeral >= 0 && rows[iGeral + 1]) {
    const r = rows[iGeral + 1];
    data.geral = num(r[0]);
    // categoria única do cliente pode estar em coluna próxima ao "maior participação"
    data.categoria = str(r[2]) ?? str(r[3]);
    data.maior_familia = { label: str(r[4]), participacao: num(r[7]) };
    data.maior_grupo_farol = { label: str(r[9]), participacao: num(r[12]) };
  }

  if (iFams >= 0) {
    for (let i = iFams + 2; i < rows.length; i++) {
      const r = rows[i] ?? [];
      const fam = str(r[0]);
      if (!fam || fam.toUpperCase().includes("DISTRIBUIÇÃO") || fam.toUpperCase().includes("TRÊS")) break;
      data.familias.push({ familia: fam, participacao: num(r[1]), atingimento: num(r[2]) });
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
      const pos = num(r[0]);
      const fam = str(r[1]);
      if (pos == null && !fam) break;
      data.piores_familias.push({
        posicao: pos ?? i - iPiores - 1,
        familia_pior_atingimento: fam,
        atingimento_pior: num(r[2]),
        familia_maior_participacao: str(r[4]),
        participacao_maior: num(r[5]),
        atingimento_maior: num(r[6]),
      });
    }
  }

  return data;
}

// Segunda planilha: resultado por família (base do gráfico de barras).
export type ClientFamiliasData = {
  itens: Array<{
    familia: string;
    meta: number | null;
    realizado: number | null;
    atingimento: number | null; // 0..>1 (fração) ou 0..>100 (%)
  }>;
};

export function parseClientFamiliasWorkbook(buf: ArrayBuffer): ClientFamiliasData {
  const wb = XLSX.read(buf, { type: "array" });
  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  if (!ws) throw new Error("Planilha de famílias não encontrada.");
  const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false, defval: null });

  // Descobre a linha de cabeçalho procurando colunas conhecidas.
  let headerIdx = -1;
  for (let i = 0; i < Math.min(rows.length, 12); i++) {
    const cells = (rows[i] ?? []).map((c) => String(c ?? "").toUpperCase());
    if (cells.some((c) => c.includes("FAMÍLIA") || c.includes("FAMILIA"))) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx < 0) headerIdx = 0;

  const header = (rows[headerIdx] ?? []).map((c) => String(c ?? "").toUpperCase().trim());
  const idxFam = header.findIndex((h) => h.includes("FAMÍLIA") || h.includes("FAMILIA"));
  const idxMeta = header.findIndex((h) => h.includes("META"));
  const idxReal = header.findIndex((h) => h.includes("REAL") || h.includes("FATUR"));
  const idxAtg = header.findIndex((h) => h.includes("ATING") || h === "%");

  const itens: ClientFamiliasData["itens"] = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i] ?? [];
    const fam = str(r[idxFam >= 0 ? idxFam : 0]);
    if (!fam) continue;
    const up = fam.toUpperCase();
    if (up.startsWith("TOTAL") || up.startsWith("SOMA")) continue;
    itens.push({
      familia: fam,
      meta: idxMeta >= 0 ? num(r[idxMeta]) : null,
      realizado: idxReal >= 0 ? num(r[idxReal]) : null,
      atingimento: idxAtg >= 0 ? num(r[idxAtg]) : null,
    });
  }
  return { itens };
}

// ============= Batch: uma planilha com dados de todos os clientes =============

const HAS_BI_MARKERS = (ws: any): boolean => {
  const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: true, defval: null });
  return rows.some((r) =>
    (r ?? []).some(
      (c) =>
        typeof c === "string" &&
        (c.toUpperCase().includes("ATINGIMENTO PONDERADO GERAL") ||
          c.toUpperCase().includes("PARTICIPAÇÃO DAS FAMÍLIAS")),
    ),
  );
};

/**
 * Planilha BI multi-cliente: cada aba do workbook representa UM cliente.
 * O nome da aba é usado como razão social (limitada a 31 chars pelo Excel;
 * o parser também procura por um rótulo "CLIENTE:" / "RAZÃO SOCIAL:" dentro
 * da aba e, se encontrar, prioriza esse valor).
 */
export function parseClientBIWorkbookBatch(
  buf: ArrayBuffer,
): Array<{ razao_social: string; data: ClientBIData }> {
  const wb = XLSX.read(buf, { type: "array" });
  const out: Array<{ razao_social: string; data: ClientBIData }> = [];
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    if (!ws) continue;
    if (!HAS_BI_MARKERS(ws)) continue; // ignora abas de índice/instruções
    const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: true, defval: null });
    let razao: string | null = null;
    for (const r of rows.slice(0, 12)) {
      for (let i = 0; i < (r?.length ?? 0); i++) {
        const c = r[i];
        if (typeof c !== "string") continue;
        const up = c.toUpperCase();
        if (up.includes("RAZÃO SOCIAL") || up.includes("CLIENTE:") || up === "CLIENTE") {
          const v = r[i + 1];
          if (typeof v === "string" && v.trim()) {
            razao = v.trim();
            break;
          }
        }
      }
      if (razao) break;
    }
    const data = parseClientBISheet(ws);
    out.push({ razao_social: (razao ?? name).trim(), data });
  }
  if (!out.length) throw new Error("Nenhuma aba de BI reconhecida no arquivo.");
  return out;
}

/**
 * Planilha de resultado por família multi-cliente:
 * Estratégia 1: workbook com várias abas — cada aba é um cliente.
 * Estratégia 2: uma única aba com coluna CLIENTE/RAZÃO SOCIAL — agrupa por cliente.
 */
export function parseClientFamiliasWorkbookBatch(
  buf: ArrayBuffer,
): Array<{ razao_social: string; data: ClientFamiliasData }> {
  const wb = XLSX.read(buf, { type: "array" });

  // Estratégia 1: múltiplas abas com dados por cliente
  if (wb.SheetNames.length > 1) {
    const out: Array<{ razao_social: string; data: ClientFamiliasData }> = [];
    for (const name of wb.SheetNames) {
      const ws = wb.Sheets[name];
      if (!ws) continue;
      try {
        const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false, defval: null });
        const hasFam = rows.some((r) =>
          (r ?? []).some(
            (c) =>
              typeof c === "string" && (c.toUpperCase().includes("FAMÍLIA") || c.toUpperCase().includes("FAMILIA")),
          ),
        );
        if (!hasFam) continue;
        // reaproveita o parser single-sheet re-serializando
        const single = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(single, ws, "S");
        const bufSingle = XLSX.write(single, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
        const data = parseClientFamiliasWorkbook(bufSingle);
        if (data.itens.length) out.push({ razao_social: name.trim(), data });
      } catch {
        /* aba sem formato válido é ignorada */
      }
    }
    if (out.length) return out;
  }

  // Estratégia 2: uma única aba com coluna cliente
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) throw new Error("Planilha vazia.");
  const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false, defval: null });

  let headerIdx = -1;
  for (let i = 0; i < Math.min(rows.length, 12); i++) {
    const cells = (rows[i] ?? []).map((c) => String(c ?? "").toUpperCase());
    if (
      cells.some((c) => c.includes("FAMÍLIA") || c.includes("FAMILIA")) &&
      cells.some((c) => c.includes("CLIENTE") || c.includes("RAZÃO"))
    ) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx < 0) throw new Error("Cabeçalho com colunas CLIENTE e FAMÍLIA não encontrado.");

  const header = (rows[headerIdx] ?? []).map((c) => String(c ?? "").toUpperCase().trim());
  const idxCli = header.findIndex((h) => h.includes("CLIENTE") || h.includes("RAZÃO"));
  const idxFam = header.findIndex((h) => h.includes("FAMÍLIA") || h.includes("FAMILIA"));
  const idxMeta = header.findIndex((h) => h.includes("META"));
  const idxReal = header.findIndex((h) => h.includes("REAL") || h.includes("FATUR"));
  const idxAtg = header.findIndex((h) => h.includes("ATING") || h === "%");

  const map = new Map<string, ClientFamiliasData>();
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i] ?? [];
    const cli = str(r[idxCli]);
    const fam = str(r[idxFam]);
    if (!cli || !fam) continue;
    const up = fam.toUpperCase();
    if (up.startsWith("TOTAL") || up.startsWith("SOMA")) continue;
    if (!map.has(cli)) map.set(cli, { itens: [] });
    map.get(cli)!.itens.push({
      familia: fam,
      meta: idxMeta >= 0 ? num(r[idxMeta]) : null,
      realizado: idxReal >= 0 ? num(r[idxReal]) : null,
      atingimento: idxAtg >= 0 ? num(r[idxAtg]) : null,
    });
  }
  return Array.from(map.entries()).map(([razao_social, data]) => ({ razao_social, data }));
}
