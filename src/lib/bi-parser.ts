import * as XLSX from "xlsx";

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
};

const num = (v: any): number | null => {
  if (v == null || v === "") return null;
  if (typeof v === "number") return v;
  const s = String(v).replace("%", "").replace(",", ".").trim();
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};
const str = (v: any): string | null => (v == null || v === "" ? null : String(v).trim());

export function parseBIWorkbook(buf: ArrayBuffer): BIData {
  const wb = XLSX.read(buf, { type: "array" });
  const sheetName = wb.SheetNames.find((n) => n.toUpperCase().includes("BI")) ?? wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  if (!ws) throw new Error("Planilha BI não encontrada.");
  const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: true, defval: null });

  // Localiza seções por rótulo (robusto a pequenas mudanças de posição)
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

  return data;
}
