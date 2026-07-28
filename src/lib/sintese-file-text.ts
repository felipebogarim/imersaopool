// Extração de texto no cliente para "Carregar análise própria".
// Suporta: PDF, XLSX/XLS/CSV, DOCX, TXT/MD.

export async function extractFileText(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  const ext = name.split(".").pop() ?? "";

  if (["txt", "md", "markdown", "csv"].includes(ext) && ext !== "csv") {
    return await file.text();
  }

  if (ext === "csv") {
    return await file.text();
  }

  if (["xlsx", "xls", "xlsm"].includes(ext)) {
    const XLSX = await import("xlsx");
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    return wb.SheetNames.map(n => `# Aba: ${n}\n${XLSX.utils.sheet_to_csv(wb.Sheets[n])}`).join("\n\n");
  }

  if (ext === "docx") {
    const mammoth: any = await import(/* @vite-ignore */ "mammoth/mammoth.browser.js" as string);
    const buf = await file.arrayBuffer();
    const r = await (mammoth as any).extractRawText({ arrayBuffer: buf });
    return r.value as string;
  }

  if (ext === "pdf") {
    const pdfjs: any = await import("pdfjs-dist");
    pdfjs.GlobalWorkerOptions.workerSrc = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
    const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
    const parts: string[] = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const c = await page.getTextContent();
      parts.push(c.items.map((it: any) => it.str).join(" "));
    }
    return parts.join("\n\n");
  }

  return await file.text();
}
