// Reconciliação estrita entre a faixa textual da célula e a cor de preenchimento.
// A validação usa SOMENTE correspondência exata de cor (ver IMPORT_FAROL_HEX);
// nenhuma aproximação por distância participa da importação.

import { statusFromFaixa, statusFromHex, FAROL_LABEL, type FarolStatus } from "./performance-farol";

export type CellConflictReason =
  | "estilo_ausente"
  | "cor_ausente"
  | "cor_nao_reconhecida"
  | "divergencia_texto_cor";

export type CellConflict = {
  linha: number;
  razao_social: string;
  familia: string;
  texto: string;
  /** Cor bruta como veio do arquivo (ex.: "FF9FC7E8", "theme:4"). */
  cor_bruta: string;
  /** Cor normalizada RRGGBB (vazio quando não foi possível normalizar). */
  cor: string;
  status_texto: FarolStatus | null;
  status_cor: FarolStatus | null;
  motivo: CellConflictReason;
};

export type CellStyleMeta = {
  /** true quando a célula possui objeto de estilo (cell.s). */
  hasStyle?: boolean;
  /** Valor bruto da cor encontrada (rgb, theme:N, indexed:N) ou null. */
  rawColor?: string | null;
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
 * - texto + cor divergentes → "divergencia_texto_cor".
 * - texto sem estilo → "estilo_ausente"; com estilo mas sem RGB → "cor_ausente";
 *   com cor extraída fora das paletas → "cor_nao_reconhecida".
 * - exceção retroativa: conteúdo inequívoco de zero é aceito como Sem compra.
 * - apenas cor → usa a cor (arquivos legados sem faixa textual).
 * - célula totalmente vazia → sem status.
 */
export function resolveCellStatus(
  valor: unknown,
  hex: string | null | undefined,
  meta?: CellStyleMeta,
): CellResolution {
  const statusTexto = statusFromFaixa(valor == null ? null : String(valor));
  const statusCor = statusFromHex(hex);
  const texto = valor == null ? "" : String(valor).trim();
  const cor = hex ? String(hex).replace(/^#/, "").toUpperCase() : "";
  const rawColor = meta?.rawColor ?? (hex ? String(hex) : null);
  const cor_bruta = rawColor ? String(rawColor) : "";
  const hasStyle = meta?.hasStyle ?? Boolean(hex);

  if (statusTexto && statusCor) {
    if (statusTexto === statusCor) return { ok: true, status: statusTexto };
    return {
      ok: false,
      conflito: {
        texto,
        cor,
        cor_bruta,
        status_texto: statusTexto,
        status_cor: statusCor,
        motivo: "divergencia_texto_cor",
      },
    };
  }

  if (statusTexto && !statusCor) {
    // Compatibilidade retroativa: célula sem preenchimento com conteúdo zero.
    if (statusTexto === "sem_compra" && isZeroContent(valor) && !rawColor) {
      return { ok: true, status: "sem_compra" };
    }
    const motivo: CellConflictReason = rawColor
      ? "cor_nao_reconhecida"
      : hasStyle
        ? "cor_ausente"
        : "estilo_ausente";
    return {
      ok: false,
      conflito: { texto, cor, cor_bruta, status_texto: statusTexto, status_cor: null, motivo },
    };
  }

  if (!statusTexto && statusCor) return { ok: true, status: statusCor };

  // Sem texto: cor presente mas fora das paletas também é rejeição.
  if (!statusTexto && rawColor) {
    return {
      ok: false,
      conflito: {
        texto,
        cor,
        cor_bruta,
        status_texto: null,
        status_cor: null,
        motivo: "cor_nao_reconhecida",
      },
    };
  }

  return { ok: true, status: null };
}

export const CONFLICT_LABEL: Record<CellConflictReason, string> = {
  estilo_ausente: "Estilo ausente",
  cor_ausente: "Cor ausente",
  cor_nao_reconhecida: "Cor não reconhecida",
  divergencia_texto_cor: "Divergência entre texto e cor",
};

/** Mensagem de bloqueio apresentada ao usuário (sem valores financeiros). */
export function conflictMessage(c: CellConflict): string {
  const loc = `Linha ${c.linha}, cliente ${c.razao_social}, família ${c.familia}`;
  const txt = c.texto || "(vazio)";
  const st = c.status_texto ? FAROL_LABEL[c.status_texto] : "(indefinido)";
  switch (c.motivo) {
    case "estilo_ausente":
      return `Importação interrompida. ${loc}: texto ${txt} corresponde a ${st}, mas a célula não possui informações de estilo.`;
    case "cor_ausente":
      return `Importação interrompida. ${loc}: texto ${txt} corresponde a ${st}, mas a célula possui estilo sem uma cor RGB de farol.`;
    case "cor_nao_reconhecida":
      return `Importação interrompida. ${loc}: a cor ${c.cor || c.cor_bruta || "(desconhecida)"} não pertence às paletas reconhecidas pelo sistema (texto ${txt}).`;
    default:
      return `Importação interrompida. ${loc}: o texto ${txt} corresponde a ${st}, mas a cor ${c.cor || c.cor_bruta} corresponde a ${c.status_cor ? FAROL_LABEL[c.status_cor] : "(indefinido)"}.`;
  }
}
