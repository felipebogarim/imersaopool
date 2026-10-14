import { supabase } from "@/integrations/supabase/client";

/**
 * Converte e otimiza um arquivo de imagem de logo para uma URL pronta
 * para persistência em JSONB e exibição visual nítida.
 *
 * Tenta upload no Supabase Storage quando disponível, mas usa fallback
 * transparente para Base64 Data URL otimizada (max 400x250) garantindo
 * 100% de resiliência caso o bucket do storage ainda não esteja provisionado.
 */
export async function processLogoUpload(file: File): Promise<string> {
  if (!file) {
    throw new Error("Nenhum arquivo fornecido");
  }

  // Validação básica de tipo
  const validTypes = [
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/webp",
    "image/svg+xml",
    "image/gif",
  ];

  if (!validTypes.includes(file.type) && !file.name.match(/\.(svg|png|jpe?g|webp|gif)$/i)) {
    throw new Error("Formato inválido. Por favor, envie uma imagem PNG, JPG, WebP ou SVG.");
  }

  // Limite de 15MB
  if (file.size > 15 * 1024 * 1024) {
    throw new Error("O arquivo da logomarca excede o tamanho máximo de 15MB.");
  }

  // 1. Gera Data URL otimizada localmente via Canvas / FileReader
  const localDataUrl = await optimizeImageToDataUrl(file);

  // 2. Tenta enviar para o Supabase Storage (bucket imersoes-anexos ou public fallback)
  try {
    const fileExt = file.name.split(".").pop()?.toLowerCase() || "png";
    const cleanName = file.name
      .replace(/[^\w.\-]/g, "_")
      .toLowerCase();
    const storagePath = `marcas-logos/${Date.now()}_${cleanName}`;

    // Tenta buckets comuns existentes no projeto
    const candidateBuckets = ["imersoes-anexos", "product-images", "kanban-attachments"];

    for (const bucket of candidateBuckets) {
      try {
        const { error: upErr } = await supabase.storage
          .from(bucket)
          .upload(storagePath, file, {
            contentType: file.type || `image/${fileExt}`,
            upsert: true,
          });

        if (!upErr) {
          const { data: publicData } = supabase.storage
            .from(bucket)
            .getPublicUrl(storagePath);

          if (publicData?.publicUrl) {
            return publicData.publicUrl;
          }
        }
      } catch {
        // Tenta o próximo bucket silenciosamente
      }
    }
  } catch (err) {
    console.warn("[processLogoUpload] Falha no storage do Supabase, usando Data URL:", err);
  }

  // Retorna Data URL otimizada com 100% de garantia de funcionamento
  return localDataUrl;
}

/**
 * Converte um arquivo em Data URL utilizando ArrayBuffer (compatível com Node/SSR e navegador).
 */
async function fileToDataUrl(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = typeof btoa === "function" ? btoa(binary) : Buffer.from(buffer).toString("base64");
  const mime = file.type || "image/png";
  return `data:${mime};base64,${base64}`;
}

/**
 * Redimensiona a imagem raster para max 400x250 mantendo transparência (PNG)
 * ou lê SVG diretamente como Data URL.
 */
async function optimizeImageToDataUrl(file: File): Promise<string> {
  // Se for SVG, não precisa renderizar em canvas para não perder vetorização
  if (file.type === "image/svg+xml" || file.name.toLowerCase().endsWith(".svg")) {
    return await fileToDataUrl(file);
  }

  // Se estiver em ambiente sem window/document (ex: SSR / Vitest), converte direto
  if (typeof window === "undefined" || typeof document === "undefined") {
    return await fileToDataUrl(file);
  }

  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      const maxW = 400;
      const maxH = 250;
      let targetW = img.width;
      let targetH = img.height;

      if (targetW > maxW || targetH > maxH) {
        const ratio = Math.min(maxW / targetW, maxH / targetH);
        targetW = Math.round(targetW * ratio);
        targetH = Math.round(targetH * ratio);
      }

      const canvas = document.createElement("canvas");
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        fileToDataUrl(file).then(resolve);
        return;
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, targetW, targetH);

      // Preserva transparência usando image/png
      const dataUrl = canvas.toDataURL("image/png");
      resolve(dataUrl);
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      fileToDataUrl(file).then(resolve);
    };

    img.src = url;
  });
}

