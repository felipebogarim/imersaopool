import * as XLSX from "xlsx";
import { readFileSync } from "fs";
import { parseBIWorkbook } from "@/lib/bi-parser";
const b = readFileSync("/mnt/user-uploads/BI_DESEMPENHO_ISABELA_1_SEMESTRE_2026_CORRIGIDO_1.xlsx");
const wb = XLSX.read(b, { type: "buffer" });
console.log("SHEETS:", wb.SheetNames);
for (const n of wb.SheetNames) {
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, blankrows: false, defval: null }) as any[][];
  console.log("---", n, rows.length);
  console.log(JSON.stringify(rows.slice(0, 6)));
}
try {
  const d = parseBIWorkbook(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
  console.log("PARSED:", JSON.stringify(d, null, 1).slice(0, 4000));
} catch (e: any) { console.log("ERR", e.message); }
