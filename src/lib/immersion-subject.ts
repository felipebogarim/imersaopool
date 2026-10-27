import { PARTNER_KIND_LABELS, type PartnerKind } from "@/lib/visao-imersao-2-partner";

/** Sujeito de uma imersão: cliente da base (`client_id`) ou parceiro especificador (`client_id` nulo). */
export type ImmersionSubjectType = "client" | "partner";

export interface ImmersionSubjectFields {
  subject_type?: string | null;
  client_id?: string | null;
  partner_name?: string | null;
  partner_type?: string | null;
  partner_type_label?: string | null;
  partner_description?: string | null;
  client?: { nome_fantasia?: string | null } | null;
}

export function isPartnerImmersion(imm?: ImmersionSubjectFields | null): boolean {
  return imm?.subject_type === "partner";
}

/** Perfil do formulário de nova imersão → tipo de parceiro sugerido (null quando é cliente). */
export function defaultPartnerKindForPerfil(perfil: string): PartnerKind | "" {
  if (perfil === "ld") return "light_designer";
  if (perfil === "outro") return "outro";
  return "";
}

export function partnerTypeLabel(imm: ImmersionSubjectFields): string {
  if (imm.partner_type === "outro") return imm.partner_type_label?.trim() || PARTNER_KIND_LABELS.outro;
  return PARTNER_KIND_LABELS[imm.partner_type as PartnerKind] ?? "Parceiro";
}

/** Nome exibido da imersão: parceiro ou cliente. */
export function immersionSubjectName(imm?: ImmersionSubjectFields | null): string {
  if (!imm) return "";
  if (isPartnerImmersion(imm)) return imm.partner_name?.trim() ?? "";
  return imm.client?.nome_fantasia?.trim() ?? "";
}

export interface NewImmersionSubjectForm {
  perfil: string;
  client_id?: string;
  partner_name?: string;
  partner_type?: string;
  partner_type_label?: string;
  partner_description?: string;
}

/**
 * Colunas de sujeito para o INSERT de `immersions`. Lança erro de validação em português.
 * Cliente exige `client_id` e não envia colunas de parceiro; parceiro nunca leva `client_id`.
 */
export function buildImmersionSubject(form: NewImmersionSubjectForm) {
  if (form.perfil === "cliente") {
    if (!form.client_id) throw new Error("Selecione um cliente da base.");
    // Só campos de cliente: não toca nas colunas de parceiro (subject_type assume o default "client").
    return { client_id: form.client_id };
  }
  const name = form.partner_name?.trim();
  if (!name) throw new Error("Informe o nome do parceiro.");
  const kind = form.partner_type as PartnerKind;
  if (!(kind in PARTNER_KIND_LABELS)) throw new Error("Informe o tipo de parceiro.");
  return {
    subject_type: "partner" as const,
    client_id: null,
    partner_name: name,
    partner_type: kind,
    partner_type_label: kind === "outro" ? form.partner_type_label?.trim() || null : null,
    partner_description: form.partner_description?.trim() || null,
  };
}
