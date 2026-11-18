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

const SUBJECT = "Sugestão de ações para você avaliar";

const Email = ({ repName, actions = [], link, expiresLabel }: Props) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>{SUBJECT}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Sugestão de ações</Heading>
        <Text style={text}>
          Olá{repName ? `, ${repName}` : ""}! Após a nossa conversa, separamos as sugestões abaixo.
          Elas são apenas sugestões: você decide se faz sentido aceitá-las, e os prazos podem ser
          ajustados em conjunto.
        </Text>
        <Section style={box}>
          {actions.slice(0, 20).map((a, i) => (
            <Text key={i} style={item}>
              • {a.title}
              {a.client ? ` — ${a.client}` : ""}
              {a.prazo ? ` (prazo sugerido: ${a.prazo})` : ""}
            </Text>
          ))}
          {actions.length > 20 ? (
            <Text style={item}>… e mais {actions.length - 20} sugestão(ões)</Text>
          ) : null}
        </Section>
        {link && (
          <Text style={text}>
            <Link href={link} style={{ color: "#b8860b", fontWeight: 700 }}>
              Ver sugestões e responder
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
  displayName: "Sugestão de ações ao representante",
  previewData: {
    repName: "Matheus",
    actions: [
      { title: "Reestruturar exposição Newline", client: "LED MASTER", prazo: "30/11/2026" },
    ],
    link: "https://poolflux.app/atualizacao-acoes/exemplo",
    expiresLabel: "03/12/2026",
  },
} satisfies TemplateEntry;

const main = { backgroundColor: "#ffffff", fontFamily: "Helvetica, Arial, sans-serif" };
const container = { maxWidth: "560px", margin: "0 auto", padding: "24px 16px" };
const h1 = { fontSize: "22px", color: "#0E1C28", margin: "0 0 16px" };
const text = { fontSize: "15px", lineHeight: "24px", color: "#0E1C28" };
const box = {
  backgroundColor: "#F6FAFC",
  border: "1px solid #E1E9EF",
  borderRadius: "10px",
  padding: "12px 16px",
  margin: "12px 0",
};
const item = { fontSize: "14px", margin: "4px 0", color: "#0E1C28" };
const muted = { fontSize: "12px", color: "#5A6A76" };
