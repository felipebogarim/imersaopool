/**
 * Gera o PDF do Relatório Geral a partir do que está na tela (gráficos e imagens incluídos).
 * Cada bloco marcado com data-pdf-block vira um trecho da página; blocos não são cortados no meio.
 */
export async function exportGeneralReportPdf(root: HTMLElement, fileName: string) {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import("html2canvas"),
    import("jspdf"),
  ]);
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const M = 36;
  const PW = doc.internal.pageSize.getWidth();
  const PH = doc.internal.pageSize.getHeight();
  const W = PW - M * 2;
  let y = M;

  const blocks = Array.from(root.querySelectorAll<HTMLElement>("[data-pdf-block]"));
  for (const el of blocks) {
    const canvas = await html2canvas(el, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
      onclone: (d) => d.documentElement.classList.remove("dark"),
      ignoreElements: (n) => n instanceof HTMLElement && n.hasAttribute("data-pdf-ignore"),
    });
    if (!canvas.width || !canvas.height) continue;
    let h = (canvas.height * W) / canvas.width;
    let w = W;
    const maxH = PH - M * 2;
    if (h > maxH) {
      w = (W * maxH) / h;
      h = maxH;
    }
    if (y + h > PH - M && y > M) {
      doc.addPage();
      y = M;
    }
    doc.addImage(canvas.toDataURL("image/jpeg", 0.92), "JPEG", M, y, w, h);
    y += h + 12;
  }
  doc.save(fileName.endsWith(".pdf") ? fileName : `${fileName}.pdf`);
}
