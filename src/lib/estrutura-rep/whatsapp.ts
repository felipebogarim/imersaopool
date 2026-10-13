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

/** Formata mensagem textual executiva de alta legibilidade para WhatsApp */
export function formatRepStructureWhatsappText(
  structure: RepStructure,
  repContact?: { email?: string | null; telefone?: string | null }
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
    `🏢 *ESTRUTURA COMERCIAL & OPERACIONAL*`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `👤 *Representante:* ${nome}`,
    `🏢 *Empresa:* ${empresa}`,
    `📍 *Base:* ${base}  •  *Região:* ${regiao}`,
    `💼 *Atuação:* ${atuacao}`,
    `🏢 *Escritório:* ${escritorio}`,
  ];

  if (repContact?.telefone || repContact?.email) {
    const contatos = [repContact.telefone, repContact.email].filter(Boolean).join("  •  ");
    linhas.push(`📞 *Contato:* ${contatos}`);
  }

  linhas.push(
    ``,
    `🗺️ *TERRITÓRIO ATENDIDO (${totalUfs} UFs):*`,
    ufsStr,
    ``,
    `💼 *MARCAS REPRESENTADAS (${marcas.length}):*`
  );

  if (marcasLines.length > 0) {
    linhas.push(...marcasLines);
  } else {
    linhas.push(`  • Nenhuma marca informada`);
  }

  linhas.push(
    ``,
    `👥 *EQUIPE & BACKOFFICE (${equipe.length} integrantes):*`
  );

  if (equipeLines.length > 0) {
    linhas.push(...equipeLines);
  } else {
    linhas.push(`  • Operação individual`);
  }

  linhas.push(
    ``,
    `🛡️ *RECURSOS OPERACIONAIS (${recursosAtivos.length}/6 ativos):*`,
    recursosAtivos.map((r) => `✓ ${r}`).join("  ·  ") || "Em estruturação",
    ``,
    `📄 *Segue anexo o Relatório Executivo em PDF com o mapa geográfico e organograma completo.*`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `_PoolFlux · Imersão Comercial Newline_`
  );

  return linhas.join("\n");
}

/** Dispara o compartilhamento via WhatsApp com geração e anexo do PDF otimizado */
export async function shareRepStructureByWhatsapp(
  structure: RepStructure,
  repContact?: { email?: string | null; telefone?: string | null }
): Promise<void> {
  const shareText = formatRepStructureWhatsappText(structure, repContact);
  const cleanPhone = formatWhatsappNumber(repContact?.telefone);

  // 1. Gera o PDF executivo
  const { blob, filename, title } = await generateRepStructurePdf(structure);

  // 2. Tenta compartilhamento nativo com o arquivo PDF (Mobile / Safari / Chrome com Web Share)
  const file = new File([blob], filename, { type: "application/pdf" });
  const nav: any = typeof navigator !== "undefined" ? navigator : null;

  if (nav && nav.canShare && nav.canShare({ files: [file] })) {
    try {
      await nav.share({
        files: [file],
        title,
        text: shareText,
      });
      toast.success("Estrutura compartilhada via WhatsApp com sucesso!");
      return;
    } catch (err: any) {
      if (err?.name === "AbortError") {
        return; // Usuário cancelou o compartilhamento
      }
      console.warn("[shareRepStructureByWhatsapp] Web Share API failed, using fallback:", err);
    }
  }

  // 3. Fallback Desktop / Web: Baixa o PDF no dispositivo e abre o WhatsApp com a mensagem pronta
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);

  // Abre WhatsApp Web ou wa.me
  const encodedText = encodeURIComponent(shareText);
  const waUrl = cleanPhone
    ? `https://wa.me/${cleanPhone}?text=${encodedText}`
    : `https://wa.me/?text=${encodedText}`;

  window.open(waUrl, "_blank", "noopener,noreferrer");

  toast.success(
    "PDF da estrutura gerado e baixado! Anexe o arquivo baixado na conversa do WhatsApp que foi aberta.",
    { duration: 6000 }
  );
}
