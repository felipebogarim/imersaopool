import React from "react";
import { Body, Container, Head, Heading, Html, Preview, Text } from "@react-email/components";
import type { TemplateEntry } from "./registry";

interface Props {
  repName?: string;
  title?: string;
  decision?: "aprovada" | "recusada";
  newDue?: string;
  note?: string;
}

const Email = ({ repName, title, decision, newDue, note }: Props) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>{`Pedido de prorrogação ${decision === "aprovada" ? "aprovado" : "respondido"}`}</Preview>
    <Body style={{ backgroundColor: "#ffffff", fontFamily: "Helvetica, Arial, sans-serif" }}>
      <Container style={{ maxWidth: "560px", padding: "24px 16px" }}>
        <Heading style={{ fontSize: "20px", color: "#0E1C28" }}>
          Pedido de prorrogação {decision === "aprovada" ? "aprovado" : "não aprovado"}
        </Heading>
        <Text style={text}>
          Olá{repName ? `, ${repName}` : ""}! Sobre a ação <strong>{title}</strong>:{" "}
          {decision === "aprovada"
            ? `o novo prazo ficou em ${newDue}.`
            : "não foi possível ajustar o prazo desta vez, ele permanece o mesmo."}
        </Text>
        {note ? <Text style={text}>Observação da equipe: {note}</Text> : null}
        <Text style={{ fontSize: "12px", color: "#5A6A76" }}>PoolFlux · Imersão Comercial</Text>
      </Container>
    </Body>
  </Html>
);

export const template = {
  component: Email,
  subject: (d: Record<string, unknown>) =>
    d?.decision === "aprovada"
      ? "Pedido de prorrogação aprovado"
      : "Resposta ao seu pedido de prorrogação",
  displayName: "Decisão sobre prorrogação de prazo",
  previewData: {
    repName: "Matheus",
    title: "Reestruturar exposição",
    decision: "aprovada",
    newDue: "30/11/2026",
  },
} satisfies TemplateEntry;

const text = { fontSize: "15px", lineHeight: "24px", color: "#0E1C28" };
