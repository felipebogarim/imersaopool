export const GRO_CONSULTANT_ROLES = ["admin", "gestor", "agente", "consultoria_operador"] as const;
export const GRO_COMPANY_ROLES = ["empresa_admin", "empresa_usuario"] as const;

export const GRO_SECTIONS = {
  consultant: [
    ["panorama", "Panorama"],
    ["documentos", "Documentos"],
    ["questionarios", "Questionários"],
    ["reportes-de-campo", "Reportes de Campo"],
    ["relatorio-final", "Relatório Final"],
    ["plano-de-acao", "Plano de Ação"],
    ["nossa-cultura", "Nossa Cultura"],
  ],
  company: [
    ["panorama", "Panorama"],
    ["relatorio-final", "Relatório Final"],
    ["plano-de-acao", "Plano de Ação"],
    ["nossa-cultura", "Nossa Cultura"],
  ],
  administration: [
    ["usuarios-permissoes", "Usuários e Permissões"],
    ["configuracoes", "Configurações"],
  ],
} as const;

export const GRO_EXPERIENCE_STORAGE_KEY = "gro:experience";

export function preferredGroExperience() {
  if (typeof window === "undefined") return "consultancy" as const;
  return localStorage.getItem(GRO_EXPERIENCE_STORAGE_KEY) === "company"
    ? ("company" as const)
    : ("consultancy" as const);
}

export function setPreferredGroExperience(mode: "consultancy" | "company") {
  localStorage.setItem(GRO_EXPERIENCE_STORAGE_KEY, mode);
}

export const CONSULTANCY_STEPS = [
  ["initial_meeting", "Reunião inicial"],
  ["documents_received", "Documentação recebida"],
  ["certificates_analyzed", "Atestados analisados"],
  ["cat_analyzed", "CAT analisadas"],
  ["pgr_received", "PGR recebido"],
  ["aet_received", "AET recebida"],
  ["questionnaires_applied", "Questionários aplicados"],
  ["diagnosis_consolidated", "Diagnóstico consolidado"],
  ["report_validated", "Relatório validado"],
  ["delivery_completed", "Entrega realizada"],
] as const;

export const DOCUMENT_CATEGORIES: Record<string, string> = {
  administrative: "Contrato e documentos administrativos",
  medical_certificates: "Atestados",
  cat: "CAT",
  pgr: "PGR",
  aet: "AET",
  technical_other: "Outros documentos técnicos",
  existing_practices: "Boas práticas e ações existentes",
};

export const PRACTICE_TOPICS = [
  "Plano de saúde",
  "Apoio psicológico",
  "Ações de integração",
  "Eventos e comemorações",
  "Benefícios",
  "Flexibilidade",
  "Políticas internas",
  "Ações de comunicação",
  "Práticas de reconhecimento",
  "Apoio à família",
  "Outros",
] as const;

export const ACTION_COLUMNS = [
  ["todo", "A fazer"],
  ["in_progress", "Em andamento"],
  ["awaiting_evidence", "Aguardando evidência"],
  ["completed", "Concluída"],
] as const;

export const REPORT_STATUS: Record<string, string> = {
  draft: "Rascunho gerado",
  technical_review: "Revisão técnica",
  validated: "Validado",
  published: "Publicado",
  delivered: "Entregue",
};

export function isConsultant(roles: string[]) {
  return roles.some((role) => (GRO_CONSULTANT_ROLES as readonly string[]).includes(role));
}

export function formatDate(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(new Date(value));
}

export function isOverdue(action: { due_on?: string | null; status: string }) {
  return (
    action.status !== "completed" &&
    !!action.due_on &&
    action.due_on < new Date().toISOString().slice(0, 10)
  );
}

export function periodKind(period: { starts_on: string; ends_on: string }) {
  const today = new Date().toISOString().slice(0, 10);
  if (period.starts_on > today) return "programado";
  if (period.ends_on < today) return "anterior";
  return "atual";
}
