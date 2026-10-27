export type PartnerKind = "arquiteto" | "light_designer" | "outro";

/** Cadastro mínimo de parceiro especificador; nenhum campo é obrigatório além do tipo. */
export interface ReportPartner {
  kind: PartnerKind;
  /** Descrição livre quando `kind` é "outro" (ex.: "Engenheiro", "Designer de interiores"). */
  kind_label?: string;
  contact_name?: string;
  city?: string;
  phone?: string;
  email?: string;
  notes?: string;
}

export const PARTNER_KIND_LABELS: Record<PartnerKind, string> = {
  arquiteto: "Arquiteto",
  light_designer: "Light designer",
  outro: "Outro",
};

export function partnerKindLabel(p: ReportPartner): string {
  if (p.kind === "outro") return p.kind_label?.trim() || PARTNER_KIND_LABELS.outro;
  return PARTNER_KIND_LABELS[p.kind];
}

const clean = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);

/** Lê o parceiro de um `structured_data` salvo; retorna null quando o relatório é de cliente. */
export function readPartner(structured: unknown): ReportPartner | null {
  const raw = (structured as { partner?: Record<string, unknown> } | null)?.partner;
  if (!raw || typeof raw !== "object") return null;
  const kind = raw.kind;
  if (kind !== "arquiteto" && kind !== "light_designer" && kind !== "outro") return null;
  return {
    kind,
    kind_label: clean(raw.kind_label),
    contact_name: clean(raw.contact_name),
    city: clean(raw.city),
    phone: clean(raw.phone),
    email: clean(raw.email),
    notes: clean(raw.notes),
  };
}
