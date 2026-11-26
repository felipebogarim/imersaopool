// Inteligência Comercial (Brain): tipos compartilhados entre servidor e interface.

export type BrainInterface = "plataforma" | "portal";

/** Capacidades configuráveis por papel (D8). */
export const BRAIN_CAPABILITIES = [
  "chat",
  "base_integral",
  "conhecimento_cadastrar",
  "conhecimento_importar",
  "conhecimento_aprovar",
  "confidencialidade",
  "modelos",
  "custos_limites",
  "auditoria",
] as const;
export type BrainCapability = (typeof BRAIN_CAPABILITIES)[number];

export const BRAIN_CAPABILITY_LABEL: Record<BrainCapability, string> = {
  chat: "Usar o chat",
  base_integral: "Consultar toda a base comercial",
  conhecimento_cadastrar: "Cadastrar conhecimento",
  conhecimento_importar: "Importar documentos",
  conhecimento_aprovar: "Aprovar conhecimento",
  confidencialidade: "Gerir confidencialidade",
  modelos: "Gerir modelos e provedores",
  custos_limites: "Gerir custos e limites",
  auditoria: "Auditoria",
};

/**
 * Escopo de dados resolvido NO SERVIDOR a partir da sessão. Nunca vem do cliente.
 * - gestao: toda a base comercial da empresa ativa.
 * - representante: apenas a(s) carteira(s) do representante vinculado ao login.
 */
export type BrainScope =
  | { kind: "gestao"; userId: string; companyId: string; capabilities: BrainCapability[] }
  | { kind: "representante"; userId: string; repIds: string[]; capabilities: BrainCapability[] };

export type BrainAttachmentInput = {
  name: string;
  mime: string;
  /** Texto extraído no navegador (PDF, Word, Excel, CSV, TXT). */
  text?: string;
  /** Imagem (data URL) para interpretação visual. */
  dataUrl?: string;
};

/** Eventos enviados ao navegador durante a resposta (SSE). */
export type BrainStreamEvent =
  | { type: "meta"; conversationId: string | null; persisted: boolean }
  | { type: "tool"; name: string; label: string }
  | { type: "text"; delta: string }
  | { type: "sources"; sources: BrainSource[] }
  | { type: "done"; messageId: string | null }
  | { type: "error"; message: string };

export type BrainSource = { tipo: string; descricao: string; periodo?: string | null };

export type BrainMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: BrainSource[];
  attachments?: Array<{ name: string; mime: string }>;
  created_at: string;
  /** Conteúdo histórico que deixou de ser autorizado (revalidação de escopo). */
  oculto?: boolean;
};

export type BrainConversation = {
  id: string;
  titulo: string;
  interface: BrainInterface;
  updated_at: string;
};

export type BrainAccess = {
  plataforma: boolean;
  portal: boolean;
  /** Persistência disponível (migration aplicada). */
  persistencia: boolean;
  capabilities: BrainCapability[];
  motivo?: string;
};
