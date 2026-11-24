// Compartilhamento da página de metas do cliente como IMAGEM (sem texto): cabeçalho com o nome
// do cliente + blocos capturados da tela (gauge, faixa de categoria e gráfico de atingimento).

const BG = "#e6ebf2";
const PAD = 40;
const GAP = 24;
const SCALE = 2;

async function capture(el: HTMLElement): Promise<HTMLCanvasElement> {
  const { default: html2canvas } = await import("html2canvas-pro");
  return html2canvas(el, {
    scale: SCALE,
    useCORS: true,
    backgroundColor: null,
    onclone: (d) => {
      // A imagem sai sempre no tema claro, como no print de referência.
      d.documentElement.classList.remove("dark");
    },
    ignoreElements: (n) => n instanceof HTMLElement && n.hasAttribute("data-share-ignore"),
  });
}

function fontFamily(): string {
  return getComputedStyle(document.body).fontFamily || "Inter, Arial, sans-serif";
}

/** Gera o PNG: título + subtítulo e os blocos empilhados, na largura do maior bloco. */
export async function buildMetasShareImage(args: {
  title: string;
  subtitle: string;
  blocks: HTMLElement[];
}): Promise<Blob> {
  const shots: HTMLCanvasElement[] = [];
  for (const el of args.blocks) {
    const c = await capture(el);
    if (c.width && c.height) shots.push(c);
  }
  if (shots.length === 0) throw new Error("Não foi possível capturar a página.");

  const pad = PAD * SCALE;
  const gap = GAP * SCALE;
  const contentW = Math.max(...shots.map((s) => s.width));
  const titleSize = 30 * SCALE;
  const subSize = 17 * SCALE;
  const headerH = titleSize + 14 * SCALE + subSize + 10 * SCALE;
  const W = contentW + pad * 2;
  const H =
    pad + headerH + gap + shots.reduce((h, s) => h + s.height, 0) + gap * (shots.length - 1) + pad;

  const out = document.createElement("canvas");
  out.width = W;
  out.height = H;
  const ctx = out.getContext("2d");
  if (!ctx) throw new Error("Canvas indisponível.");
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);

  const family = fontFamily();
  ctx.textBaseline = "top";
  ctx.fillStyle = "#1e293b";
  ctx.font = `700 ${titleSize}px ${family}`;
  ctx.fillText(args.title, pad, pad, contentW);
  ctx.fillStyle = "#475569";
  ctx.font = `400 ${subSize}px ${family}`;
  ctx.fillText(args.subtitle, pad, pad + titleSize + 14 * SCALE, contentW);

  let y = pad + headerH + gap;
  for (const s of shots) {
    ctx.drawImage(s, pad, y);
    y += s.height + gap;
  }

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
      await nav.share({ files: [file] });
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
