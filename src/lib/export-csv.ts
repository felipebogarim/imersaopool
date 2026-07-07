// CSV export helper: converts array of objects to CSV and triggers download.
// Uses semicolon separator + CRLF for pt-BR Excel compatibility.
const SEP = ";";

function escape(v: unknown): string {
  if (v === null || v === undefined) return "";
  let s = typeof v === "object" ? JSON.stringify(v) : String(v);
  // Normalize line breaks and strip control chars that break Excel cells
  s = s.replace(/\r\n|\r|\n/g, " ").replace(/\t/g, " ");
  if (/["";\n]/.test(s) || s.includes(SEP)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function exportToCsv(filename: string, rows: Record<string, any>[]) {
  if (!rows.length) return;
  const headers = Array.from(
    rows.reduce<Set<string>>((set, r) => {
      Object.keys(r).forEach((k) => set.add(k));
      return set;
    }, new Set()),
  );
  const lines = [`sep=${SEP}`, headers.map(escape).join(SEP)];
  for (const r of rows) lines.push(headers.map((h) => escape(r[h])).join(SEP));
  const csv = "\uFEFF" + lines.join("\r\n"); // BOM + CRLF for Excel
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
