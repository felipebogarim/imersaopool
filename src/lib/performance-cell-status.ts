// Reconciliação estrita entre a faixa textual da célula e a cor de preenchimento.
// Substitui a lógica antiga `statusFromFaixa(...) ?? statusFromHex(...)`, que
// mascarava inconsistências ao escolher silenciosamente uma das fontes.

import { statusFromFaixa, statusFromHex, FAROL_LABEL, type FarolStatus } from "./performance-farol";

export type CellConflict = {
  linha: number;
  razao_social: string;
  familia: string;
  texto: string;
  cor: string;
  status_texto: FarolStatus | null;
  status_cor: FarolStatus | null;
  motivo: "divergencia" | "cor_ausente";
};

export type CellResolution =
  | { ok: true; status: FarolStatus | null }
  | { ok: false; conflito: Omit<CellConflict, "linha" | "razao_social" | "familia"> };

const isZeroContent = (v: unknown): boolean => {
  if (v == null) return true;
  if (typeof v === "number") return v === 0;
  const s = String(v).trim().toLowerCase().replace(/\s+/g, "");
  return s === "" || s === "0" || s === "0%" || s === "-" || s === "sem" || s === "semcompra";
};

/**
 * Resolve o farol de uma célula exigindo equivalência entre texto e cor.
 * - texto + cor equivalentes → importa.
 * - texto + cor divergentes → conflito ("divergencia").
 * - texto sem cor → só é aceito quando o conteúdo indica Sem compra / 0% / zero
 *   (compatibilidade com arquivos antigos); caso contrário, conflito ("cor_ausente").
 * - apenas cor → usa a cor (arquivos legados sem faixa textual).
 * - célula totalmente vazia → sem status.
 */
export function resolveCellStatus(valor: unknown, hex: string | null | undefined): CellResolution {
  const statusTexto = statusFromFaixa(valor == null ? null : String(valor));
  const statusCor = statusFromHex(hex);
  const texto = valor == null ? "" : String(valor).trim();
  const cor = hex ? String(hex).replace(/^#/, "").toUpperCase() : "";

  if (statusTexto && statusCor) {
    if (statusTexto === statusCor) return { ok: true, status: statusTexto };
    return {
      ok: false,
      conflito: { texto, cor, status_texto: statusTexto, status_cor: statusCor, motivo: "divergencia" },
    };
  }

  if (statusTexto && !statusCor) {
    if (statusTexto === "sem_compra" && isZeroContent(valor)) {
      return { ok: true, status: "sem_compra" };
    }
    return {
      ok: false,
      conflito: { texto, cor, status_texto: statusTexto, status_cor: null, motivo: "cor_ausente" },
    };
  }

  if (!statusTexto && statusCor) return { ok: true, status: statusCor };

  return { ok: true, status: null };
}

/** Mensagem de bloqueio apresentada ao usuário (sem valores financeiros). */
export function conflictMessage(c: CellConflict): string {
  if (c.motivo === "cor_ausente") {
    return `Importação interrompida. Linha ${c.linha}, cliente ${c.razao_social}, família ${c.familia}: texto ${c.texto || "(vazio)"} corresponde a ${FAROL_LABEL[c.status_texto!]}, mas a célula não possui cor de farol.`;
  }
  return `Importação interrompida. Linha ${c.linha}, cliente ${c.razao_social}, família ${c.familia}: texto ${c.texto || "(vazio)"} corresponde a ${FAROL_LABEL[c.status_texto!]}, mas a cor corresponde a ${FAROL_LABEL[c.status_cor!]}.`;
}
