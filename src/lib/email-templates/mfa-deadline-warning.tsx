import React from "react";
import { Body, Container, Head, Heading, Html, Preview, Section, Text } from "@react-email/components";
import type { TemplateEntry } from "./registry";

interface Props {
  name?: string;
  daysLeft?: number;
  deadline?: string;
}

const Email = ({ name, daysLeft, deadline }: Props) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>{`Faltam ${daysLeft ?? "poucos"} dias para o MFA obrigatório`}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Ative o MFA antes do prazo</Heading>
        <Text style={text}>Olá {name ?? "administrador"},</Text>
        <Text style={text}>
          O prazo de adaptação para o MFA obrigatório está próximo do fim. Você tem{" "}
          <strong>{daysLeft ?? "poucos"} dia(s)</strong> para configurar seu autenticador antes que as ações
          administrativas sensíveis sejam bloqueadas.
        </Text>
        {deadline && (
          <Section style={box}>
            <Text style={boxText}>Prazo final: {deadline}</Text>
          </Section>
        )}
        <Text style={text}>
          Acesse <strong>/admin/mfa</strong> no PoolFlux e conclua a configuração agora.
        </Text>
        <Text style={muted}>PoolFlux · Segurança e Conformidade</Text>
      </Container>
    </Body>
  </Html>
);

export const template = {
  component: Email,
  subject: (d) => `⚠️ Faltam ${d?.daysLeft ?? "poucos"} dias para o MFA obrigatório`,
  displayName: "Aviso de prazo do MFA",
  previewData: { name: "Felipe", daysLeft: 2, deadline: "30/07/2026 10:00" },
} satisfies TemplateEntry;

const main = { backgroundColor: "#ffffff", fontFamily: "Inter, Arial, sans-serif" };
const container = { padding: "32px 28px", maxWidth: "560px" };
const h1 = { color: "#0a1730", fontSize: "22px", fontWeight: 700, margin: "0 0 16px" };
const text = { color: "#334155", fontSize: "15px", lineHeight: "22px", margin: "0 0 12px" };
const box = { background: "#fef3c7", padding: "12px 16px", borderRadius: "8px", margin: "16px 0" };
const boxText = { color: "#78350f", fontSize: "14px", margin: 0, fontWeight: 600 };
const muted = { color: "#94a3b8", fontSize: "12px", marginTop: "24px" };
