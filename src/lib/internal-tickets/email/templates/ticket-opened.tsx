import * as React from "react";
import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";

export type TicketOpenedEmailProps = {
  ticketNumber: string;
  title: string;
  description: string;
  sectorName: string;
  categoryName: string;
  priorityLabel: string;
  requesterName: string;
  dueAtLabel: string | null;
};

/**
 * E-mail enviado ao setor quando um ticket é enviado. Sem botões de ação
 * ainda — as 5 ações públicas (Confirmar recebimento, Marcar em análise...)
 * entram no próximo checkpoint (Fase 4b), junto com as páginas públicas que
 * os tokens de internal_ticket_action_tokens vão autorizar. Por ora, quem
 * recebe pode responder diretamente a este e-mail (reply-to volta pro
 * ticket certo via reply-address.ts).
 */
export function TicketOpenedEmail({
  ticketNumber,
  title,
  description,
  sectorName,
  categoryName,
  priorityLabel,
  requesterName,
  dueAtLabel,
}: TicketOpenedEmailProps) {
  return (
    <Html lang="pt-BR" dir="ltr">
      <Head />
      <Preview>{`[${ticketNumber}] ${title}`}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Nova solicitação interna</Heading>
          <Text style={text}>
            {requesterName} abriu uma solicitação para o setor {sectorName}.
          </Text>
          <Section style={box}>
            <Text style={boxLabel}>{ticketNumber}</Text>
            <Text style={boxTitle}>{title}</Text>
            <Text style={boxText}>{description}</Text>
          </Section>
          <Text style={meta}>
            Categoria: {categoryName} · Prioridade: {priorityLabel}
            {dueAtLabel ? ` · Prazo de primeira resposta: ${dueAtLabel}` : ""}
          </Text>
          <Text style={text}>
            Responda diretamente a este e-mail para registrar sua resposta no ticket.
          </Text>
          <Text style={muted}>PoolFlux · Solicitações Internas</Text>
        </Container>
      </Body>
    </Html>
  );
}

const main = { backgroundColor: "#ffffff", fontFamily: "Inter, Arial, sans-serif" };
const container = { padding: "32px 28px", maxWidth: "560px" };
const h1 = { color: "#0a1730", fontSize: "22px", fontWeight: 700, margin: "0 0 16px" };
const text = { color: "#334155", fontSize: "15px", lineHeight: "22px", margin: "0 0 12px" };
const box = { background: "#f1f5f9", padding: "16px", borderRadius: "8px", margin: "16px 0" };
const boxLabel = {
  color: "#64748b",
  fontSize: "12px",
  margin: "0 0 4px",
  fontWeight: 700,
  textTransform: "uppercase" as const,
};
const boxTitle = { color: "#0f172a", fontSize: "16px", fontWeight: 600, margin: "0 0 8px" };
const boxText = { color: "#334155", fontSize: "14px", lineHeight: "20px", margin: 0 };
const meta = { color: "#64748b", fontSize: "13px", margin: "0 0 16px" };
const muted = { color: "#94a3b8", fontSize: "12px", marginTop: "24px" };
