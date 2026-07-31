import * as X from "xlsx-js-style";
import { readFileSync } from "fs";
import { statusFromHex } from "./src/lib/performance-farol";
const load = (p: string) => { const b = readFileSync(p); return X.read(b.buffer.slice(b.byteOffset, b.byteOffset+b.byteLength), { type: "array", cellStyles: true }); };

for (const f of ["/mnt/user-uploads/BI_DESEMPENHO_ISABELA_1_SEMESTRE_2026_CORRIGIDO_1.xlsx", "/mnt/user-uploads/file-15"]) {
  const wb = load(f);
  const ws = wb.Sheets["Performance"] ?? wb.Sheets[wb.SheetNames[0]];
  console.log("###", f.split("/").pop(), "| sheets:", wb.SheetNames);
  for (const a of ["D2","E2","F2","G2","H2"]) console.log(" ", a, JSON.stringify(ws[a]));
}
// distribuição de cores no arquivo do Fabio via caminho flatten
const wb = load("/mnt/user-uploads/file-15");
const ws = wb.Sheets["Performance"];
const cnt: Record<string, number> = {}; const byText: Record<string,Record<string,number>> = {};
const range = X.utils.decode_range(ws["!ref"]);
for (let r = 1; r <= range.e.r; r++) for (let c = 3; c <= 10; c++) {
  const cell = ws[X.utils.encode_cell({r, c})]; if (!cell) continue;
  const s: any = cell.s ?? {};
  const hex = s?.fgColor?.rgb ?? s?.fill?.fgColor?.rgb ?? "(nenhuma)";
  cnt[hex] = (cnt[hex]||0)+1;
  const t = String(cell.v);
  (byText[t] ||= {})[hex] = ((byText[t]||{})[hex]||0)+1;
}
console.log("contagem por cor (flatten):", cnt);
console.log("texto x cor:", byText);
for (const h of Object.keys(cnt)) if (h!=="(nenhuma)") console.log("statusFromHex", h, "->", statusFromHex(h));
