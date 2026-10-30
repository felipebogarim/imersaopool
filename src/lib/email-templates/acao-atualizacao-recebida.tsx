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

interface Item {
  title: string;
  client?: string;
  statusLabel?: string;
  note?: string;
  pendencias?: string[];
  files?: number;
}

interface Props {
  recipientName?: string;
  repName?: string;
  /** true = cópia enviada ao representante que fez a atualização. */
  isCopy?: boolean;
  items?: Item[];
  link?: string;
}

function subjectFor(d: Record<string, unknown>) {
  const who = d?.repName ? ` — ${d.repName}` : "";
  return `Atualização de ações recebida${who}`;
}

const Email = ({ recipientName, repName, isCopy, items = [], link }: Props) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>{subjectFor({ repName })}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Evolução das Ações</Heading>
        <Text style={text}>
          {isCopy
            ? "Cópia: sua atualização foi registrada e enviada ao responsável."
            : `${recipientName ? `Olá, ${recipientName}. ` : ""}${repName ?? "O representante"} enviou uma atualização das ações.`}
        </Text>
        {items.map((it, i) => (
          <Section key={i} style={box}>
            <Text style={boxTitle}>{it.title}</Text>
            <Text style={line}>
              {it.client ? `${it.client} · ` : ""}
              {it.statusLabel ?? ""}
            </Text>
            {it.note ? <Text style={line}>“{it.note}”</Text> : null}
            {it.pendencias?.map((p, k) => (
              <Text key={k} style={line}>
                ⚠ Pendência: {p}
              </Text>
            ))}
            {it.files ? <Text style={line}>{it.files} anexo(s)</Text> : null}
          </Section>
        ))}
        {link && (
          <Text style={text}>
            <Link href={link} style={{ color: "#b8860b" }}>
              Abrir o painel
            </Link>
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
  displayName: "Atualização de ações recebida",
  previewData: {
    recipientName: "Felipe",
    repName: "Matheus",
    items: [
      {
        title: "Reestruturar exposição Newline",
        client: "LED MASTER",
        statusLabel: "Em andamento",
        note: "Projeto aprovado pelo cliente.",
        pendencias: ["Aguardando amostras (Ana)"],
        files: 2,
      },
    ],
    link: "https://poolflux.app/ferramentas/evolucao-acoes",
  },
} satisfies TemplateEntry;

const main = { backgroundColor: "#ffffff", fontFamily: "Inter, Arial, sans-serif" };
const container = { padding: "32px 28px", maxWidth: "560px" };
const h1 = { color: "#0a1730", fontSize: "22px", fontWeight: 700, margin: "0 0 16px" };
const text = { color: "#334155", fontSize: "15px", lineHeight: "22px", margin: "0 0 12px" };
const box = {
  background: "#f1f5f9",
  padding: "12px 16px",
  borderRadius: "8px",
  margin: "0 0 10px",
};
const boxTitle = { color: "#0a1730", fontSize: "15px", fontWeight: 700, margin: "0 0 4px" };
const line = { color: "#334155", fontSize: "14px", lineHeight: "20px", margin: "0 0 4px" };
const muted = { color: "#94a3b8", fontSize: "12px", marginTop: "24px" };
