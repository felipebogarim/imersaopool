import { generateRepStructurePdf } from "./pdf";
import type { RepStructure } from "./types";
import {
  MODELO_ESCRITORIO_LABEL,
  MODELO_ATUACAO_LABEL,
  MODELO_NEGOCIO_LABEL,
  RECURSOS_CONFIG,
} from "./types";
import { toast } from "sonner";

/** Formata número de WhatsApp limpo para envio internacional */
export function formatWhatsappNumber(phone?: string | null): string {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`;
  }
  return digits;
}

/** Formata mensagem textual executiva de alta legibilidade para WhatsApp (sem emojis) */
export function formatRepStructureWhatsappText(
  structure: RepStructure,
  repContact?: { email?: string | null; telefone?: string | null },
  options?: { appUrl?: string }
): string {
  const nome = structure.nome_representante || "Representante";
  const empresa = structure.empresa_representacao || "Representação Comercial";
  const base =
    structure.cidade_base && structure.estado_base
      ? `${structure.cidade_base}/${structure.estado_base}`
      : "Base operacional";
  const regiao = structure.regiao_principal || "Brasil";
  const atuacao = MODELO_ATUACAO_LABEL[structure.modelo_atuacao] || "Equipe";
  const escritorio = MODELO_ESCRITORIO_LABEL[structure.modelo_escritorio] || "Escritório Físico";

  const ufs = structure.estados_atendidos || [];
  const totalUfs = ufs.length;
  const ufsStr = totalUfs > 0 ? ufs.join(", ") : "Nenhum informado";

  const marcas = structure.marcas_representadas || [];
  const marcasLines = marcas.map((m) => {
    const mod = MODELO_NEGOCIO_LABEL[m.modelo_negocio] || m.modelo_negocio;
    return `  • *${m.nome}* (${mod}${m.segmento ? ` · ${m.segmento}` : ""})`;
  });

  const equipe = structure.equipe || [];
  const equipeLines = equipe.map((eq) => {
    return `  • *${eq.nome}* — ${eq.cargo || "Atendimento"}`;
  });

  const recursosAtivos = RECURSOS_CONFIG.filter(
    (r) => Boolean(structure.recursos_operacionais?.[r.key])
  ).map((r) => r.label);

  const linhas: string[] = [
    `*ESTRUTURA COMERCIAL & OPERACIONAL*`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `*Representante:* ${nome}`,
    `*Empresa:* ${empresa}`,
    `*Base:* ${base}  •  *Região:* ${regiao}`,
    `*Atuação:* ${atuacao}`,
    `*Escritório:* ${escritorio}`,
  ];

  if (repContact?.telefone || repContact?.email) {
    const contatos = [repContact.telefone, repContact.email].filter(Boolean).join("  •  ");
    linhas.push(`*Contato:* ${contatos}`);
  }

  linhas.push(
    ``,
    `*TERRITÓRIO ATENDIDO (${totalUfs} UFs):*`,
    ufsStr,
    ``,
    `*MARCAS REPRESENTADAS (${marcas.length}):*`
  );

  if (marcasLines.length > 0) {
    linhas.push(...marcasLines);
  } else {
    linhas.push(`  • Nenhuma marca informada`);
  }

  linhas.push(
    ``,
    `*EQUIPE & BACKOFFICE (${equipe.length} integrantes):*`
  );

  if (equipeLines.length > 0) {
    linhas.push(...equipeLines);
  } else {
    linhas.push(`  • Operação individual`);
  }

  linhas.push(
    ``,
    `*RECURSOS OPERACIONAIS (${recursosAtivos.length}/6 ativos):*`,
    recursosAtivos.map((r) => `• ${r}`).join("  ·  ") || "Em estruturação"
  );

  const baseUrl = options?.appUrl || "https://poolflux.app";
  const repId = structure.representative_id;
  const previewUrl = `${baseUrl.replace(/\/+$/, "")}/estrutura/${repId}`;

  linhas.push(
    ``,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `*Documento Executivo em PDF (abrir e visualizar):*`,
    previewUrl,
    ``,
    `_PoolFlux · Imersão Comercial Newline_`
  );

  return linhas.join("\n");
}

import { generateRepInfographicImage } from "./infographic";

/** Dispara o compartilhamento via WhatsApp com geração e envio da imagem em formato infográfico */
export async function shareRepStructureByWhatsapp(
  structure: RepStructure,
  repContact?: { email?: string | null; telefone?: string | null }
): Promise<void> {
  const nome = structure.nome_representante || "Representante";
  const cleanPhone = formatWhatsappNumber(repContact?.telefone);

  // 1. Gera a imagem infográfico de alta resolução em PNG
  const { blob, filename } = await generateRepInfographicImage(structure);

  // 2. Tenta compartilhamento nativo com o arquivo de imagem PNG (Mobile / Safari com Web Share)
  const file = new File([blob], filename, { type: "image/png" });
  const nav: any = typeof navigator !== "undefined" ? navigator : null;

  if (nav && nav.canShare && nav.canShare({ files: [file] })) {
    try {
      await nav.share({
        files: [file],
        title: `Infográfico da Estrutura Comercial — ${nome}`,
      });
      toast.success("Infográfico compartilhado via WhatsApp com sucesso!");
      return;
    } catch (err: any) {
      if (err?.name === "AbortError") {
        return; // Usuário cancelou o compartilhamento
      }
      console.warn("[shareRepStructureByWhatsapp] Web Share API failed, using fallback:", err);
    }
  }

  // 3. Fallback Desktop / Web: Copia a imagem para a área de transferência e baixa o PNG
  if (typeof navigator !== "undefined" && navigator.clipboard?.write) {
    try {
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      toast.info("Imagem do infográfico copiada para a área de transferência! Cole (Ctrl+V) na conversa.");
    } catch {
      // noop
    }
  }

  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);

  // Abre WhatsApp Web ou wa.me limpo, pronto para colar a imagem
  const waUrl = cleanPhone
    ? `https://wa.me/${cleanPhone}`
    : `https://wa.me/`;

  window.open(waUrl, "_blank", "noopener,noreferrer");

  toast.success(
    "Infográfico baixado e imagem copiada! Na conversa do WhatsApp que foi aberta, basta pressionar Ctrl+V (ou Cmd+V) para enviar a imagem.",
    { duration: 7000 }
  );
}

