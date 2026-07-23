import React from "react";
import { Body, Container, Head, Heading, Html, Preview, Section, Text } from "@react-email/components";
import type { TemplateEntry } from "./registry";

interface Props {
  name?: string;
  actorName?: string;
  justificativa?: string;
  when?: string;
}

const Email = ({ name, actorName, justificativa, when }: Props) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Seus fatores MFA foram removidos por um superadministrador</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Seus fatores de MFA foram removidos</Heading>
        <Text style={text}>Olá {name ?? "administrador"},</Text>
        <Text style={text}>
          Um superadministrador ({actorName ?? "sistema"}) executou a recuperação da sua conta em{" "}
          {when ?? "agora"} e removeu todos os seus fatores de autenticação em duas etapas. Todas as suas
          sessões foram encerradas.
        </Text>
        {justificativa && (
          <Section style={box}>
            <Text style={boxLabel}>Justificativa registrada:</Text>
            <Text style={boxText}>{justificativa}</Text>
          </Section>
        )}
        <Text style={text}>
          Faça login novamente e configure imediatamente um novo fator em <strong>/admin/mfa</strong>. Se
          você não solicitou essa recuperação, contate o time de segurança imediatamente.
        </Text>
        <Text style={muted}>PoolFlux · Auditoria de Segurança</Text>
      </Container>
    </Body>
  </Html>
);

export const template = {
  component: Email,
  subject: "🔐 Seus fatores MFA foram removidos",
  displayName: "MFA removido por superadmin",
  previewData: {
    name: "Felipe",
    actorName: "felipe@poolbranding.com.br",
    justificativa: "Perda do dispositivo autenticador, aprovado por telefone.",
    when: new Date().toLocaleString("pt-BR"),
  },
} satisfies TemplateEntry;

const main = { backgroundColor: "#ffffff", fontFamily: "Inter, Arial, sans-serif" };
const container = { padding: "32px 28px", maxWidth: "560px" };
const h1 = { color: "#0a1730", fontSize: "22px", fontWeight: 700, margin: "0 0 16px" };
const text = { color: "#334155", fontSize: "15px", lineHeight: "22px", margin: "0 0 12px" };
const box = { background: "#fee2e2", padding: "12px 16px", borderRadius: "8px", margin: "16px 0" };
const boxLabel = { color: "#7f1d1d", fontSize: "12px", margin: "0 0 4px", fontWeight: 700, textTransform: "uppercase" as const };
const boxText = { color: "#7f1d1d", fontSize: "14px", margin: 0 };
const muted = { color: "#94a3b8", fontSize: "12px", marginTop: "24px" };
