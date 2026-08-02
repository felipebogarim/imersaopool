import React from "react";
import { Body, Button, Container, Head, Heading, Html, Preview, Section, Text } from "@react-email/components";
import type { TemplateEntry } from "./registry";

interface Props {
  name?: string;
  link?: string;
}

const Email = ({ name, link }: Props) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Seu convite de acesso ao painel PoolFlux</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Bem-vindo(a) ao painel</Heading>
        <Text style={text}>Olá {name ?? ""},</Text>
        <Text style={text}>
          Seu acesso ao painel PoolFlux foi criado. Clique no botão abaixo para cadastrar a sua senha
          pessoal — leva menos de um minuto e você já entra no painel.
        </Text>
        <Section style={{ margin: "24px 0" }}>
          <Button href={link} style={button}>
            Cadastrar minha senha
          </Button>
        </Section>
        <Text style={muted}>{link}</Text>
        <Text style={text}>Este convite é pessoal e vale por 14 dias.</Text>
        <Text style={muted}>PoolFlux</Text>
      </Container>
    </Body>
  </Html>
);

export const template = {
  component: Email,
  subject: "Seu convite de acesso ao painel PoolFlux",
  displayName: "Convite de primeiro acesso",
  previewData: {
    name: "Filipe",
    link: "https://poolflux.app/definir-senha?t=exemplo",
  },
} satisfies TemplateEntry;


const main = { backgroundColor: "#ffffff", fontFamily: "Inter, Arial, sans-serif" };
const container = { padding: "32px 28px", maxWidth: "560px" };
const h1 = { color: "#0a1730", fontSize: "22px", fontWeight: 700, margin: "0 0 16px" };
const text = { color: "#334155", fontSize: "15px", lineHeight: "22px", margin: "0 0 12px" };
const box = { background: "#e2e8f0", padding: "12px 16px", borderRadius: "8px", margin: "16px 0" };
const boxLabel = { color: "#0f172a", fontSize: "12px", margin: "0 0 4px", fontWeight: 700, textTransform: "uppercase" as const };
const boxText = { color: "#0f172a", fontSize: "16px", margin: 0, fontFamily: "monospace" };
const button = {
  backgroundColor: "#0e7490",
  color: "#ffffff",
  padding: "12px 22px",
  borderRadius: "8px",
  fontSize: "15px",
  fontWeight: 600,
  textDecoration: "none",
};
const muted = { color: "#94a3b8", fontSize: "12px", marginTop: "12px", wordBreak: "break-all" as const };
