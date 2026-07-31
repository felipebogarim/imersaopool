import * as XLSXStyle from "xlsx-js-style";
import * as XLSXPlain from "xlsx";
import { readFileSync } from "fs";
import { parseWorkbook } from "./src/lib/performance-parser";
import { statusFromFaixa, statusFromHex } from "./src/lib/performance-farol";

const buf = readFileSync("/mnt/user-uploads/file-15");
const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;

const wbA = XLSXStyle.read(ab, { type: "array", cellStyles: true });
console.log("A (xlsx-js-style, cellStyles:true) E2 =", JSON.stringify(wbA.Sheets["Performance"]["E2"]));
const wbA2 = XLSXStyle.read(ab, { type: "array" });
console.log("A2 (sem cellStyles) E2 =", JSON.stringify(wbA2.Sheets["Performance"]["E2"]));
const wbP = XLSXPlain.read(ab, { type: "array", cellStyles: true });
console.log("C (xlsx puro) E2 =", JSON.stringify(wbP.Sheets["Performance"]["E2"]));
console.log("faixa>100:", statusFromFaixa(">100"), "hex 9FC7E8:", statusFromHex("9FC7E8"), "hex FF9FC7E8:", statusFromHex("FF9FC7E8"));

void (async () => {
  const p = await parseWorkbook(ab);
  console.log("rows", p.rows.length, "conflitos", p.conflitos.length, "familias", p.familias);
  console.log(p.conflitos.slice(0, 3));
  const cores = new Map<string, number>();
  for (const r of p.rows) for (const c of Object.values(r.metas_cores)) cores.set(c, (cores.get(c) || 0) + 1);
  console.log("cores extraídas:", [...cores]);
  const motivos = new Map<string, number>();
  for (const c of p.conflitos) motivos.set(c.motivo, (motivos.get(c.motivo) || 0) + 1);
  console.log("motivos:", [...motivos]);
})();
