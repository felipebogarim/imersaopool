/**
 * Helper para leitura e otimização imediata de logomarcas para a Estrutura do Representante.
 *
 * Gera Data URL compacta e auto-contida (max 320x160 px com preservação de transparência),
 * garantindo renderização instantânea no navegador, sem dependência de buckets privados
 * do Storage que causam erros de carregamento (400/403) ou imagens quebradas.
 */

/** Converte arquivo/blob para Data URL de forma rápida e segura em qualquer ambiente */
export function readBlobAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    if (typeof FileReader !== "undefined") {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (e) => reject(new Error("Erro ao ler arquivo: " + e));
      reader.readAsDataURL(blob);
    } else {
      // Fallback para ambiente Node.js / testes Vitest
      blob
        .arrayBuffer()
        .then((buf) => {
          const b64 = Buffer.from(buf).toString("base64");
          const mime = blob.type || "image/png";
          resolve(`data:${mime};base64,${b64}`);
        })
        .catch(reject);
    }
  });
}

/**
 * Valida o arquivo e gera Data URL otimizada pronta para persistência em JSONB e exibição visual.
 */
export async function processLogoUpload(file: File): Promise<string> {
  if (!file) {
    throw new Error("Nenhum arquivo selecionado.");
  }

  const validExtensions = /\.(svg|png|jpe?g|webp|gif)$/i;
  const isImageMime = file.type?.startsWith("image/");
  const hasImageExt = validExtensions.test(file.name);

  if (!isImageMime && !hasImageExt) {
    throw new Error("Formato inválido. Por favor, envie uma imagem PNG, JPG, WebP ou SVG.");
  }

  // Limite de 15MB para upload
  if (file.size > 15 * 1024 * 1024) {
    throw new Error("O arquivo da logomarca excede o tamanho máximo de 15MB.");
  }

  // Se for SVG, preserva o formato vetorial lendo como Data URL direto
  if (file.type === "image/svg+xml" || file.name.toLowerCase().endsWith(".svg")) {
    return await readBlobAsDataUrl(file);
  }

  // Se não estiver em ambiente com DOM (ex: Node/SSR/Vitest), lê como Data URL direto
  if (typeof window === "undefined" || typeof document === "undefined") {
    return await readBlobAsDataUrl(file);
  }

  // No navegador: redimensiona para no máximo 320x160 mantendo proporção e transparência
  return new Promise((resolve) => {
    let objectUrl = "";
    try {
      objectUrl = URL.createObjectURL(file);
    } catch {
      readBlobAsDataUrl(file).then(resolve);
      return;
    }

    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      const maxW = 320;
      const maxH = 160;
      let targetW = img.naturalWidth || img.width || maxW;
      let targetH = img.naturalHeight || img.height || maxH;

      if (targetW > maxW || targetH > maxH) {
        const ratio = Math.min(maxW / targetW, maxH / targetH);
        targetW = Math.max(1, Math.round(targetW * ratio));
        targetH = Math.max(1, Math.round(targetH * ratio));
      }

      const canvas = document.createElement("canvas");
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        readBlobAsDataUrl(file).then(resolve);
        return;
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, targetW, targetH);

      try {
        const dataUrl = canvas.toDataURL("image/png");
        resolve(dataUrl);
      } catch {
        readBlobAsDataUrl(file).then(resolve);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      readBlobAsDataUrl(file).then(resolve);
    };

    img.src = objectUrl;
  });
}
