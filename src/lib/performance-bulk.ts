/**
 * Utilitários do "Envio em massa" da Performance.
 * Expande arquivos .zip, identifica o representante pelo nome do arquivo e
 * converte PDF em matriz (aoa) para o gerador de performance.
 */

export type BulkEntry = {
  id: string;
  name: string;
  kind: "xlsx" | "pdf";
  file: File;
  repId: string;
  status: "pendente" | "processando" | "ok" | "erro";
  message?: string;
};

const ACCEPTED = /\.(xlsx|xls|pdf)$/i;

export function normalizeName(s: string): string {
  return (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Tenta descobrir o representante a partir do nome do arquivo. */
export function guessRepId(
  filename: string,
  reps: { id: string; nome: string }[],
): string {
  const base = normalizeName(filename.replace(/\.[^.]+$/, ""));
  if (!base) return "";
  let best = "";
  let bestScore = 0;
  for (const r of reps) {
    const nome = normalizeName(r.nome);
    if (!nome) continue;
    let score = 0;
    if (base.includes(nome)) score = nome.length * 2;
    else {
      const tokens = nome.split(" ").filter((t) => t.length >= 3);
      const hits = tokens.filter((t) => base.includes(t));
      if (hits.length) score = hits.join("").length;
    }
    if (score > bestScore) {
      bestScore = score;
      best = r.id;
    }
  }
  return bestScore >= 3 ? best : "";
}

/** Expande zips e devolve apenas arquivos aceitos (xlsx/xls/pdf). */
export async function expandFiles(files: File[]): Promise<File[]> {
  const out: File[] = [];
  for (const f of files) {
    if (/\.zip$/i.test(f.name)) {
      const JSZip = (await import("jszip")).default;
      const zip = await JSZip.loadAsync(await f.arrayBuffer());
      const entries = Object.values(zip.files) as any[];
      for (const entry of entries) {
        if (entry.dir) continue;
        const name = String(entry.name).split("/").pop() || entry.name;
        if (name.startsWith(".") || name.startsWith("__MACOSX")) continue;
        if (!ACCEPTED.test(name)) continue;
        const blob: Blob = await entry.async("blob");
        out.push(new File([blob], name));
      }
    } else if (ACCEPTED.test(f.name)) {
      out.push(f);
    }
  }
  return out;
}

/** Converte o texto de um PDF em uma matriz linha x coluna aproximada. */
export async function pdfToAoa(file: File): Promise<(string | number | null)[][]> {
  const pdfjs: any = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = (
    await import("pdfjs-dist/build/pdf.worker.min.mjs?url")
  ).default;
  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const aoa: (string | number | null)[][] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    // Agrupa itens por posição vertical para reconstruir as linhas.
    const lines = new Map<number, { x: number; str: string }[]>();
    for (const it of content.items as any[]) {
      if (!it.str?.trim()) continue;
      const y = Math.round(it.transform[5]);
      const arr = lines.get(y) ?? [];
      arr.push({ x: it.transform[4], str: it.str });
      lines.set(y, arr);
    }
    const ys = Array.from(lines.keys()).sort((a, b) => b - a);
    for (const y of ys) {
      const cells = (lines.get(y) ?? [])
        .sort((a, b) => a.x - b.x)
        .map((c) => c.str.trim())
        .filter(Boolean);
      if (cells.length) aoa.push(cells);
    }
  }
  return aoa;
}
