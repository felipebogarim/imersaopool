import React from "react";
import { Body, Container, Head, Heading, Html, Link, Preview, Section, Text } from "@react-email/components";
import type { TemplateEntry } from "./registry";

interface Props {
  title?: string;
  dateLabel?: string;
  durationLabel?: string;
  details?: string;
  organizerName?: string;
  link?: string;
}

const Email = ({ title, dateLabel, durationLabel, details, organizerName, link }: Props) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>{`Convite de agenda: ${title ?? "Novo compromisso"}`}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Convite de agenda</Heading>
        <Text style={text}>
          {organizerName ?? "Um usuário"} convidou você para participar deste compromisso.
        </Text>
        <Section style={box}>
          <Text style={boxLabel}>Compromisso</Text>
          <Text style={boxTitle}>{title ?? "Novo compromisso"}</Text>
          {dateLabel && <Text style={boxText}>{dateLabel}</Text>}
          {durationLabel && <Text style={boxText}>Duração: {durationLabel}</Text>}
        </Section>
        {details && <Text style={text}>{details}</Text>}
        {link && (
          <Text style={text}>
            <Link href={link} style={linkStyle}>Abrir minha agenda</Link>
          </Text>
        )}
        <Text style={muted}>PoolFlux · Imersão Comercial</Text>
      </Container>
    </Body>
  </Html>
);

export const template = {
  component: Email,
  subject: (data: Record<string, any>) => `Convite de agenda: ${data?.title ?? "Novo compromisso"}`,
  displayName: "Convite de agenda",
  previewData: {
    title: "Reunião comercial",
    dateLabel: "15 de setembro de 2026, às 14:00",
    durationLabel: "1 hora",
    organizerName: "Felipe",
    details: "Alinhamento dos próximos passos.",
    link: "https://poolflux.app/ferramentas/agenda",
  },
} satisfies TemplateEntry;

const main = { backgroundColor: "#ffffff", fontFamily: "Arial, sans-serif" };
const container = { padding: "32px 28px", maxWidth: "560px" };
const h1 = { color: "#0a1730", fontSize: "22px", fontWeight: 700, margin: "0 0 16px" };
const text = { color: "#334155", fontSize: "15px", lineHeight: "22px", margin: "0 0 12px" };
const box = { background: "#fef9c3", padding: "16px", borderRadius: "8px", margin: "16px 0" };
const boxLabel = { color: "#713f12", fontSize: "12px", margin: "0 0 5px", fontWeight: 700, textTransform: "uppercase" as const };
const boxTitle = { color: "#422006", fontSize: "17px", margin: "0 0 8px", fontWeight: 700 };
const boxText = { color: "#713f12", fontSize: "14px", margin: "2px 0" };
const linkStyle = { color: "#0369a1", fontWeight: 700 };
const muted = { color: "#94a3b8", fontSize: "12px", marginTop: "24px" };