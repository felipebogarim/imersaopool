import React from "react";
import { Body, Container, Head, Heading, Html, Link, Preview, Section, Text } from "@react-email/components";
import type { TemplateEntry } from "./registry";

interface Props {
  automationName?: string;
  cardTitle?: string;
  boardName?: string;
  message?: string;
  link?: string;
}

const Email = ({ automationName, cardTitle, boardName, message, link }: Props) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>{`Automação disparada: ${automationName ?? "Gestão de Tarefas"}`}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Gestão de Tarefas</Heading>
        <Text style={text}>
          A automação <strong>{automationName ?? "sem nome"}</strong> foi disparada
          {boardName ? ` no quadro ${boardName}` : ""}.
        </Text>
        <Section style={box}>
          <Text style={boxLabel}>Card</Text>
          <Text style={boxText}>{cardTitle ?? "—"}</Text>
        </Section>
        {message && <Text style={text}>{message}</Text>}
        {link && (
          <Text style={text}>
            <Link href={link} style={{ color: "#b8860b" }}>Abrir o quadro</Link>
          </Text>
        )}
        <Text style={muted}>PoolFlux · Imersão Comercial</Text>
      </Container>
    </Body>
  </Html>
);

export const template = {
  component: Email,
  subject: (d: Record<string, any>) =>
    `${d?.automationName ? `${d.automationName} · ` : ""}${d?.cardTitle ?? "Nova atividade no quadro"}`,
  displayName: "Automação de tarefas",
  previewData: {
    automationName: "Novo card criado",
    cardTitle: "Revisar mix da linha X",
    boardName: "Ações Comerciais",
    message: "Automação disparada",
    link: "https://poolflux.app",
  },
} satisfies TemplateEntry;

const main = { backgroundColor: "#ffffff", fontFamily: "Inter, Arial, sans-serif" };
const container = { padding: "32px 28px", maxWidth: "560px" };
const h1 = { color: "#0a1730", fontSize: "22px", fontWeight: 700, margin: "0 0 16px" };
const text = { color: "#334155", fontSize: "15px", lineHeight: "22px", margin: "0 0 12px" };
const box = { background: "#fef9c3", padding: "12px 16px", borderRadius: "8px", margin: "16px 0" };
const boxLabel = { color: "#713f12", fontSize: "12px", margin: "0 0 4px", fontWeight: 700, textTransform: "uppercase" as const };
const boxText = { color: "#713f12", fontSize: "15px", margin: 0, fontWeight: 600 };
const muted = { color: "#94a3b8", fontSize: "12px", marginTop: "24px" };
