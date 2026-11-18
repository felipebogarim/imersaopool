const COLOR_PROPS = [
  "color",
  "background-color",
  "background-image",
  "border-top-color",
  "border-right-color",
  "border-bottom-color",
  "border-left-color",
  "outline-color",
  "text-decoration-color",
  "box-shadow",
  "fill",
  "stroke",
];
const MODERN_COLOR = /(?:oklch|oklab|lab|lch|color)\([^)]*\)/g;

/**
 * html2canvas 1.4 não entende as cores modernas do Tailwind v4 (oklch, oklab, color()).
 * No clone usado para a captura, troca cada uma pelo rgb equivalente calculado pelo navegador.
 */
function toRgbColors(clone: Document) {
  const ctx = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
  const win = clone.defaultView;
  if (!ctx || !win) return;
  const cache = new Map<string, string>();
  const toRgb = (c: string) => {
    const hit = cache.get(c);
    if (hit) return hit;
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = "#000";
    ctx.fillStyle = c;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
    const out =
      a === 255 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${+(a / 255).toFixed(3)})`;
    cache.set(c, out);
    return out;
  };
  for (const el of Array.from(clone.querySelectorAll<HTMLElement | SVGElement>("*"))) {
    const cs = win.getComputedStyle(el);
    for (const prop of COLOR_PROPS) {
      const v = cs.getPropertyValue(prop);
      if (v && MODERN_COLOR.test(v)) {
        el.style.setProperty(prop, v.replace(MODERN_COLOR, toRgb), "important");
      }
      MODERN_COLOR.lastIndex = 0;
    }
  }
}

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
      onclone: (d) => {
        d.documentElement.classList.remove("dark");
        toRgbColors(d);
      },
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
