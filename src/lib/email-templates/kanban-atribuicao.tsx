import React from "react";
import { Body, Container, Head, Heading, Html, Link, Preview, Section, Text } from "@react-email/components";
import type { TemplateEntry } from "./registry";

interface Props {
  kind?: "responsavel" | "membro";
  cardTitle?: string;
  boardName?: string;
  actorName?: string;
  link?: string;
}

function subjectFor(d: Record<string, any>) {
  const title = d?.cardTitle ?? "Ação";
  return d?.kind === "membro"
    ? `Você foi convidado para uma ação: ${title}`
    : `Nova tarefa atribuída a você: ${title}`;
}

const Email = ({ kind, cardTitle, boardName, actorName, link }: Props) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>{subjectFor({ kind, cardTitle })}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Gestão de Tarefas</Heading>
        <Text style={text}>
          {kind === "membro"
            ? "Você foi adicionado como membro de uma ação"
            : "Uma ação foi atribuída a você"}
          {boardName ? ` no quadro ${boardName}` : ""}
          {actorName ? ` por ${actorName}` : ""}.
        </Text>
        <Section style={box}>
          <Text style={boxLabel}>Ação</Text>
          <Text style={boxText}>{cardTitle ?? "—"}</Text>
        </Section>
        {link && (
          <Text style={text}>
            <Link href={link} style={{ color: "#b8860b" }}>Abrir a ação</Link>
          </Text>
        )}
        <Text style={muted}>PoolFlux · Imersão Comercial</Text>
      </Container>
    </Body>
  </Html>
);

export const template = {
  component: Email,
  subject: subjectFor,
  displayName: "Atribuição de tarefa",
  previewData: {
    kind: "responsavel",
    cardTitle: "Revisar mix da linha X",
    boardName: "Ações Comerciais",
    actorName: "Felipe",
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
