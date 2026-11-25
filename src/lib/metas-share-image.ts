// Compartilhamento da página de metas do cliente como IMAGEM (sem texto): cabeçalho com o nome
// do cliente, período e blocos capturados da tela (gauge, faixa de categoria e gráfico de atingimento).

const BG = "#f1f5f9";
const PAD = 36;
const GAP = 20;
const SCALE = 2;

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

async function capture(el: HTMLElement): Promise<HTMLCanvasElement> {
  const { default: html2canvas } = await import("html2canvas-pro");
  return html2canvas(el, {
    scale: SCALE,
    useCORS: true,
    backgroundColor: null,
    onclone: (d) => {
      // Força tema claro para visual consistente idêntico ao print
      d.documentElement.classList.remove("dark");
      toRgbColors(d);

      // Garante grid em colunas lado a lado
      for (const grid of Array.from(d.querySelectorAll<HTMLElement>(".grid"))) {
        grid.style.display = "grid";
        grid.style.gridTemplateColumns = "repeat(12, minmax(0, 1fr))";
      }
      for (const col4 of Array.from(d.querySelectorAll<HTMLElement>(".lg\\:col-span-4"))) {
        col4.style.gridColumn = "span 4 / span 4";
      }
      for (const col8 of Array.from(d.querySelectorAll<HTMLElement>(".lg\\:col-span-8"))) {
        col8.style.gridColumn = "span 8 / span 8";
      }
    },
    ignoreElements: (n) => n instanceof HTMLElement && n.hasAttribute("data-share-ignore"),
  });
}

function fontFamily(): string {
  return (
    getComputedStyle(document.body).fontFamily ||
    "Inter, -apple-system, BlinkMacSystemFont, Arial, sans-serif"
  );
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

export type MetasShareArgs = {
  clienteNome: string;
  periodoReferencia: string;
  categoria?: string | null;
  repName?: string | null;
  blocks: HTMLElement[];
};

/** Gera o PNG: cabeçalho estilizado com nome do cliente, período e blocos empilhados. */
export async function buildMetasShareImage(args: MetasShareArgs): Promise<Blob> {
  const shots: HTMLCanvasElement[] = [];
  for (const el of args.blocks) {
    const c = await capture(el);
    if (c.width && c.height) shots.push(c);
  }
  if (shots.length === 0) throw new Error("Não foi possível capturar a página.");

  const pad = PAD * SCALE;
  const gap = GAP * SCALE;
  const contentW = Math.max(...shots.map((s) => s.width));
  const cardRadius = 14 * SCALE;
  const headerH = 92 * SCALE;
  const footerH = 24 * SCALE;
  const W = contentW + pad * 2;
  const H =
    pad +
    headerH +
    gap +
    shots.reduce((h, s) => h + s.height, 0) +
    gap * (shots.length - 1) +
    gap +
    footerH +
    pad;

  const out = document.createElement("canvas");
  out.width = W;
  out.height = H;
  const ctx = out.getContext("2d");
  if (!ctx) throw new Error("Canvas indisponível.");

  // Fundo geral cinza elegante
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);

  // Cartão de cabeçalho branco
  ctx.fillStyle = "#ffffff";
  roundRect(ctx, pad, pad, contentW, headerH, cardRadius);
  ctx.fill();
  ctx.strokeStyle = "#e2e8f0";
  ctx.lineWidth = 1 * SCALE;
  ctx.stroke();

  const family = fontFamily();

  // Linha 1: Nome do cliente em destaque
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#0f172a";
  ctx.font = `800 ${22 * SCALE}px ${family}`;
  const titleY = pad + 32 * SCALE;
  ctx.fillText(args.clienteNome.toUpperCase(), pad + 24 * SCALE, titleY, contentW - 240 * SCALE);

  // Badge da categoria no topo direito do cartão
  if (args.categoria) {
    const catText = `CATEGORIA ${args.categoria.toUpperCase()}`;
    ctx.font = `700 ${11 * SCALE}px ${family}`;
    const badgeW = ctx.measureText(catText).width + 20 * SCALE;
    const badgeH = 26 * SCALE;
    const badgeX = pad + contentW - 24 * SCALE - badgeW;
    const badgeY = pad + 20 * SCALE;

    const isGold = args.categoria.toLowerCase().includes("gold");
    const isBlack = args.categoria.toLowerCase().includes("black");

    ctx.fillStyle = isGold ? "#fef3c7" : isBlack ? "#f1f5f9" : "#e0f2fe";
    roundRect(ctx, badgeX, badgeY, badgeW, badgeH, 6 * SCALE);
    ctx.fill();

    ctx.fillStyle = isGold ? "#b45309" : isBlack ? "#0f172a" : "#0369a1";
    ctx.fillText(catText, badgeX + 10 * SCALE, badgeY + badgeH / 2);
  }

  // Linha 2: Período de referência e Representante
  const subY = pad + 64 * SCALE;
  ctx.font = `500 ${13 * SCALE}px ${family}`;
  ctx.fillStyle = "#475569";
  const periodoText = `📅 Período de referência: ${args.periodoReferencia}`;
  ctx.fillText(periodoText, pad + 24 * SCALE, subY);

  if (args.repName) {
    const pW = ctx.measureText(periodoText).width;
    ctx.fillStyle = "#64748b";
    ctx.fillText(`  •  Representante: ${args.repName}`, pad + 24 * SCALE + pW, subY);
  }

  // Logo / marca PoolFlux
  ctx.fillStyle = "#94a3b8";
  ctx.font = `600 ${12 * SCALE}px ${family}`;
  const brandText = "PoolFlux · Gestão de Metas";
  const brandW = ctx.measureText(brandText).width;
  ctx.fillText(brandText, pad + contentW - 24 * SCALE - brandW, subY);

  // Blocos capturados (cards no topo e gráfico abaixo)
  let y = pad + headerH + gap;
  for (const s of shots) {
    ctx.drawImage(s, pad, y);
    y += s.height + gap;
  }

  // Rodapé com timestamp
  const now = new Date();
  const dataFormatada = now.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const horaFormatada = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  ctx.fillStyle = "#94a3b8";
  ctx.font = `500 ${11 * SCALE}px ${family}`;
  ctx.textBaseline = "middle";
  ctx.fillText(
    `Relatório individual de metas gerado em ${dataFormatada} às ${horaFormatada} • PoolFlux`,
    pad + 8 * SCALE,
    y + footerH / 2,
  );

  return new Promise<Blob>((resolve, reject) =>
    out.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Falha ao gerar a imagem."))),
      "image/png",
    ),
  );
}

export type ShareOutcome = "shared" | "cancelled" | "copied" | "downloaded";

/**
 * Compartilha só a imagem. Com Web Share de arquivos (celular e navegadores compatíveis) abre a
 * folha de compartilhamento, onde o WhatsApp aparece. Sem suporte: copia a imagem para a área de
 * transferência (ou baixa o arquivo) e abre o WhatsApp Web para colar na conversa.
 */
export async function shareImageOnWhatsapp(blob: Blob, fileName: string): Promise<ShareOutcome> {
  const file = new File([blob], fileName, { type: "image/png" });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (typeof nav.share === "function" && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: fileName });
      return "shared";
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return "cancelled";
      // Outras falhas: segue para o plano B.
    }
  }

  let outcome: ShareOutcome = "downloaded";
  try {
    if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      outcome = "copied";
    }
  } catch {
    outcome = "downloaded";
  }
  if (outcome === "downloaded") {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
  window.open("https://web.whatsapp.com/", "_blank", "noopener");
  return outcome;
}
