import * as XLSXStyle from "xlsx-js-style";
import * as XLSXPlain from "xlsx";
import { readFileSync } from "fs";
import { parseWorkbook } from "./src/lib/performance-parser";
import { statusFromFaixa, statusFromHex } from "./src/lib/performance-farol";

const buf = readFileSync("/mnt/user-uploads/file-15");
const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);

for (const [name, lib, opts] of [
  ["A: cellStyles:true (projeto)", XLSXStyle, { type: "array", cellStyles: true }],
  ["B: cellStyles:true + bookVBA", XLSXStyle, { type: "array", cellStyles: true, cellNF: true }],
  ["C: xlsx puro", XLSXPlain, { type: "array", cellStyles: true }],
] as any[]) {
  const wb = lib.read(ab, opts);
  const ws = wb.Sheets["Performance"];
  const c = ws["E2"];
  console.log("---", name);
  console.log(JSON.stringify(c));
}
const wb = XLSXStyle.read(ab, { type: "array", cellStyles: true });
console.log("Themes/styles keys:", Object.keys(wb).slice(0,20));
console.log("statusFromFaixa('>100')=", statusFromFaixa(">100"), "statusFromHex('9FC7E8')=", statusFromHex("9FC7E8"));

void (async () => {
const p = await parseWorkbook(ab as ArrayBuffer);
console.log("rows", p.rows.length, "conflitos", p.conflitos.length);
console.log(p.conflitos.slice(0,3));
const cores = new Map<string, number>();
for (const r of p.rows) for (const [f, c] of Object.entries(r.metas_cores)) cores.set(c, (cores.get(c)||0)+1);
console.log("cores distintas:", [...cores]);
})();
