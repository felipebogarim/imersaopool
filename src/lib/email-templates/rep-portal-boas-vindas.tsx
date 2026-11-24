import React from "react";
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import type { TemplateEntry } from "./registry";

interface Props {
  name?: string;
  accessUrl?: string;
  primeiroAcesso?: boolean;
  portalUrl?: string;
}

export const RepPortalBoasVindasEmail = ({
  name,
  accessUrl,
  primeiroAcesso = false,
  portalUrl,
}: Props) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Seu acesso ao portal do representante</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Acesso ao portal do representante</Heading>
        <Text style={text}>Olá{name ? `, ${name}` : ""}!</Text>
        <Text style={text}>
          Use o portal para acompanhar as ações sugeridas, registrar o andamento (com comentários,
          fotos, áudios e vídeos) e, se precisar, pedir mais prazo. As ações são sugestões: você
          decide se aceita.
        </Text>
        <Section style={{ margin: "24px 0" }}>
          <Button href={accessUrl} style={button}>
            {primeiroAcesso ? "Cadastrar minha senha" : "Entrar no portal"}
          </Button>
        </Section>
        <Text style={muted}>{accessUrl}</Text>
        <Text style={text}>
          {primeiroAcesso
            ? `Depois de cadastrar a senha, entre sempre em ${portalUrl ?? "poolflux.app"}. O convite é pessoal e vale por 14 dias.`
            : "Entre com o seu e-mail e a senha já cadastrada. Sua senha atual não será alterada."}
        </Text>
        <Text style={muted}>PoolFlux · Imersão Comercial</Text>
      </Container>
    </Body>
  </Html>
);

// eslint-disable-next-line react-refresh/only-export-components
export const template = {
  component: RepPortalBoasVindasEmail,
  subject: "Seu acesso ao portal do representante",
  displayName: "Boas-vindas ao portal do representante",
  previewData: {
    name: "Matheus",
    accessUrl: "https://poolflux.app/definir-senha?t=exemplo",
    primeiroAcesso: true,
    portalUrl: "https://poolflux.app/portal-rep",
  },
} satisfies TemplateEntry;

const main = { backgroundColor: "#ffffff", fontFamily: "Inter, Arial, sans-serif" };
const container = { padding: "32px 28px", maxWidth: "560px" };
const h1 = { color: "#0a1730", fontSize: "22px", fontWeight: 700, margin: "0 0 16px" };
const text = { color: "#334155", fontSize: "15px", lineHeight: "22px", margin: "0 0 12px" };
const muted = { color: "#64748b", fontSize: "12px", wordBreak: "break-all" as const };
const button = {
  backgroundColor: "#062838",
  color: "#ffffff",
  padding: "12px 22px",
  borderRadius: "8px",
  fontWeight: 600,
  fontSize: "15px",
  textDecoration: "none",
};
