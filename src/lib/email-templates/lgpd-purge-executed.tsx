import React from "react";
import { Body, Container, Head, Heading, Html, Preview, Section, Text } from "@react-email/components";
import type { TemplateEntry } from "./registry";

interface Props {
  actionType?: string;
  targetEmail?: string;
  actorName?: string;
  justificativa?: string;
  when?: string;
  status?: string;
}

const LABELS: Record<string, string> = {
  revoke_sessions: "Revogação de sessões",
  anonymize: "Anonimização de perfil",
  delete: "Exclusão de conta",
};

const Email = ({ actionType, targetEmail, actorName, justificativa, when, status }: Props) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Ação LGPD executada: {LABELS[actionType ?? ""] ?? actionType}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Ação LGPD executada</Heading>
        <Text style={text}>
          Uma ação de privacidade foi executada e registrada em auditoria.
        </Text>
        <Section style={box}>
          <Text style={row}><strong>Tipo:</strong> {LABELS[actionType ?? ""] ?? actionType ?? "—"}</Text>
          <Text style={row}><strong>Titular:</strong> {targetEmail ?? "—"}</Text>
          <Text style={row}><strong>Executado por:</strong> {actorName ?? "—"}</Text>
          <Text style={row}><strong>Quando:</strong> {when ?? "—"}</Text>
          <Text style={row}><strong>Status:</strong> {status ?? "executado"}</Text>
          {justificativa && <Text style={row}><strong>Justificativa:</strong> {justificativa}</Text>}
        </Section>
        <Text style={text}>
          Consulte o painel <strong>/admin/lgpd</strong> e <strong>/admin/conformidade</strong> para o
          histórico completo.
        </Text>
        <Text style={muted}>PoolFlux · Conformidade LGPD</Text>
      </Container>
    </Body>
  </Html>
);

export const template = {
  component: Email,
  subject: (d) => `LGPD: ${LABELS[d?.actionType] ?? "ação"} executada`,
  displayName: "Ação LGPD executada",
  previewData: {
    actionType: "anonymize",
    targetEmail: "usuario@exemplo.com",
    actorName: "felipe@poolbranding.com.br",
    justificativa: "Solicitação formal do titular via e-mail em 20/07/2026.",
    when: new Date().toLocaleString("pt-BR"),
    status: "executado",
  },
} satisfies TemplateEntry;

const main = { backgroundColor: "#ffffff", fontFamily: "Inter, Arial, sans-serif" };
const container = { padding: "32px 28px", maxWidth: "560px" };
const h1 = { color: "#0a1730", fontSize: "22px", fontWeight: 700, margin: "0 0 16px" };
const text = { color: "#334155", fontSize: "15px", lineHeight: "22px", margin: "0 0 12px" };
const box = { background: "#f1f5f9", padding: "16px", borderRadius: "8px", margin: "16px 0" };
const row = { color: "#334155", fontSize: "14px", margin: "0 0 6px", lineHeight: "20px" };
const muted = { color: "#94a3b8", fontSize: "12px", marginTop: "24px" };
