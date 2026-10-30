import React from "react";
import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import type { TemplateEntry } from "./registry";

interface Props {
  repName?: string;
  actions?: { title: string; client?: string; prazo?: string }[];
  link?: string;
  expiresLabel?: string;
}

const SUBJECT = "Atualização semanal das suas ações — houve novidades?";

const Email = ({ repName, actions = [], link, expiresLabel }: Props) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>{SUBJECT}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Evolução das Ações</Heading>
        <Text style={text}>
          Olá{repName ? `, ${repName}` : ""}! Houve alguma atualização de status nas ações abaixo?
          Use o link para marcar o status, escrever notas, anexar arquivos e registrar pendências.
        </Text>
        <Section style={box}>
          {actions.slice(0, 15).map((a, i) => (
            <Text key={i} style={item}>
              • {a.title}
              {a.client ? ` — ${a.client}` : ""}
              {a.prazo ? ` (prazo ${a.prazo})` : ""}
            </Text>
          ))}
          {actions.length > 15 ? (
            <Text style={item}>… e mais {actions.length - 15} ação(ões)</Text>
          ) : null}
        </Section>
        {link && (
          <Text style={text}>
            <Link href={link} style={{ color: "#b8860b", fontWeight: 700 }}>
              Atualizar minhas ações
            </Link>
          </Text>
        )}
        {expiresLabel ? (
          <Text style={muted}>Link pessoal, válido até {expiresLabel}. Não encaminhe.</Text>
        ) : null}
        <Text style={muted}>PoolFlux · Imersão Comercial</Text>
      </Container>
    </Body>
  </Html>
);

export const template = {
  component: Email,
  subject: SUBJECT,
  displayName: "Solicitação de atualização de ações",
  previewData: {
    repName: "Matheus",
    actions: [
      { title: "Reestruturar exposição Newline", client: "LED MASTER", prazo: "15/11/2026" },
    ],
    link: "https://poolflux.app/atualizacao-acoes/exemplo",
    expiresLabel: "13/11/2026",
  },
} satisfies TemplateEntry;

const main = { backgroundColor: "#ffffff", fontFamily: "Inter, Arial, sans-serif" };
const container = { padding: "32px 28px", maxWidth: "560px" };
const h1 = { color: "#0a1730", fontSize: "22px", fontWeight: 700, margin: "0 0 16px" };
const text = { color: "#334155", fontSize: "15px", lineHeight: "22px", margin: "0 0 12px" };
const box = { background: "#f1f5f9", padding: "12px 16px", borderRadius: "8px", margin: "16px 0" };
const item = { color: "#334155", fontSize: "14px", lineHeight: "20px", margin: "0 0 4px" };
const muted = { color: "#94a3b8", fontSize: "12px", marginTop: "16px" };
