import * as React from "react";
import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Img,
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
  recipientName: string;
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
  recipientName,
  dueAtLabel,
}: TicketOpenedEmailProps) {
  const priorityTone = getPriorityTone(priorityLabel);

  return (
    <Html lang="pt-BR" dir="ltr">
      <Head />
      <Preview>Solicitação interna Newline</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={header}>
            <Img src="cid:newline-logo" alt="Newline" width="154" style={logo} />
          </Section>
          <Section style={content}>
            <Img src="cid:newline-icon" alt="" width="48" height="48" style={systemIcon} />
            <Text style={eyebrow}>SOLICITAÇÕES INTERNAS</Text>
            <Heading style={h1}>
              Eu sou o Sistema de solicitações internas Newline. Há uma nova solicitação destinada a
              você
            </Heading>
            <Section style={flowBox}>
              <Text style={flowText}>
                <span style={flowLabel}>Quem solicita:</span> {requesterName}
              </Text>
              <Text style={flowText}>
                <span style={flowLabel}>Destinatário:</span> {recipientName}
              </Text>
            </Section>
            <Section style={box}>
              <Text style={boxLabel}>{ticketNumber}</Text>
              <Text style={boxTitle}>{title}</Text>
              <Text style={boxText}>{description}</Text>
            </Section>
            <Section style={metaGrid}>
              <Section style={categoryCard}>
                <Text style={cardIcon}>▦</Text>
                <Text style={cardLabel}>CATEGORIA</Text>
                <Text style={categoryValue}>{categoryName}</Text>
              </Section>
              <Section style={{ ...priorityCard, borderColor: priorityTone.border }}>
                <Text style={{ ...priorityLight, backgroundColor: priorityTone.color }} />
                <Text style={cardLabel}>PRIORIDADE</Text>
                <Text style={{ ...priorityValue, color: priorityTone.text }}>{priorityLabel}</Text>
              </Section>
            </Section>
            {dueAtLabel ? (
              <Text style={dueText}>Prazo de primeira resposta: {dueAtLabel}</Text>
            ) : null}
            <Text style={text}>
              Responda diretamente a este e-mail para registrar sua resposta no ticket.
            </Text>
          </Section>
          <Section style={footer}>
            <Text style={muted}>Newline · Solicitações Internas</Text>
            <Text style={footerSector}>Setor atual: {sectorName}</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

function getPriorityTone(label: string) {
  const normalized = label.toLocaleLowerCase("pt-BR");
  if (normalized.includes("urgent"))
    return { color: "#dc2626", border: "#fecaca", text: "#991b1b" };
  if (normalized.includes("alta")) return { color: "#f97316", border: "#fed7aa", text: "#c2410c" };
  if (
    normalized.includes("normal") ||
    normalized.includes("média") ||
    normalized.includes("media")
  ) {
    return { color: "#f59e0b", border: "#fde68a", text: "#b45309" };
  }
  return { color: "#16a34a", border: "#bbf7d0", text: "#15803d" };
}

const main = { backgroundColor: "#eef2f6", fontFamily: "Inter, Arial, sans-serif", margin: 0 };
const container = {
  backgroundColor: "#ffffff",
  border: "1px solid #dfe6ee",
  borderRadius: "12px",
  margin: "32px auto",
  maxWidth: "600px",
  overflow: "hidden",
};
const header = { backgroundColor: "#071a2b", padding: "22px 28px" };
const logo = { display: "block", maxWidth: "154px" };
const content = { padding: "30px 28px 10px" };
const systemIcon = { display: "block", margin: "0 0 16px" };
const eyebrow = {
  color: "#177f8f",
  fontSize: "11px",
  fontWeight: 700,
  letterSpacing: "1.2px",
  margin: "0 0 8px",
};
const h1 = {
  color: "#102a43",
  fontSize: "23px",
  fontWeight: 700,
  lineHeight: "31px",
  margin: "0 0 20px",
};
const text = { color: "#334155", fontSize: "15px", lineHeight: "22px", margin: "0 0 12px" };
const flowBox = {
  backgroundColor: "#f5f8fa",
  borderLeft: "4px solid #177f8f",
  borderRadius: "6px",
  padding: "12px 16px",
  margin: "0 0 18px",
};
const flowText = { color: "#334155", fontSize: "14px", lineHeight: "21px", margin: "2px 0" };
const flowLabel = { color: "#102a43", fontWeight: 700 };
const box = {
  backgroundColor: "#f8fafc",
  border: "1px solid #e2e8f0",
  padding: "18px",
  borderRadius: "8px",
  margin: "16px 0",
};
const boxLabel = {
  color: "#177f8f",
  fontSize: "12px",
  margin: "0 0 4px",
  fontWeight: 700,
  textTransform: "uppercase" as const,
};
const boxTitle = { color: "#0f172a", fontSize: "16px", fontWeight: 600, margin: "0 0 8px" };
const boxText = { color: "#334155", fontSize: "14px", lineHeight: "20px", margin: 0 };
const metaGrid = { margin: "0 0 16px" };
const categoryCard = {
  backgroundColor: "#eef7f8",
  border: "1px solid #cde7ea",
  borderRadius: "8px",
  display: "inline-block",
  marginRight: "10px",
  padding: "12px 14px",
  verticalAlign: "top",
  width: "42%",
};
const priorityCard = {
  backgroundColor: "#fffdfa",
  border: "1px solid",
  borderRadius: "8px",
  display: "inline-block",
  padding: "12px 14px",
  verticalAlign: "top",
  width: "42%",
};
const cardIcon = { color: "#177f8f", fontSize: "18px", lineHeight: "18px", margin: "0 0 5px" };
const priorityLight = { borderRadius: "50%", height: "12px", margin: "1px 0 10px", width: "12px" };
const cardLabel = {
  color: "#64748b",
  fontSize: "10px",
  fontWeight: 700,
  letterSpacing: "0.8px",
  margin: "0 0 4px",
};
const categoryValue = { color: "#0f5f6b", fontSize: "14px", fontWeight: 700, margin: 0 };
const priorityValue = { fontSize: "14px", fontWeight: 700, margin: 0 };
const dueText = { color: "#64748b", fontSize: "12px", margin: "0 0 18px" };
const footer = { backgroundColor: "#071a2b", padding: "18px 28px" };
const muted = { color: "#ffffff", fontSize: "12px", fontWeight: 600, margin: "0 0 4px" };
const footerSector = { color: "#9fb1c1", fontSize: "11px", margin: 0 };
