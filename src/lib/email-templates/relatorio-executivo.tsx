import React from "react";
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import type { TemplateEntry } from "./registry";
import {
  AREA_LABEL,
  PRIORITY_LABEL,
  formatVisitDate,
  type ExecutiveReportData,
} from "@/lib/executive-report/types";

export interface ExecutiveEmailProps {
  report?: ExecutiveReportData;
  message?: string;
  appUrl?: string;
}

const BRAND = "#062838";
const ACCENT = "#008DAD";
const TEXT = "#0E1C28";
const MUTED = "#5A6A76";
const LINE = "#E1E9EF";

/** Blocos da leitura executiva para e-mail: sem "O que isso gera", com espaçamento. */
function readingBlocks(raw?: string): { kind: "h" | "p"; text: string }[] {
  if (!raw) return [];
  return raw
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean)
    .filter((b) => !/^\*\*o que isso gera/i.test(b))
    .map((b) =>
      /^#{1,6}\s/.test(b)
        ? { kind: "h" as const, text: b.replace(/^#{1,6}\s*/, "").replace(/\*\*/g, "") }
        : { kind: "p" as const, text: b.replace(/\*\*/g, "") },
    );
}

function statusTag(status: string) {
  return status === "validated" || status === "edited" ? "Ação Sugerida" : "Em validação";
}

export const ExecutiveReportEmail = ({ report, message, appUrl }: ExecutiveEmailProps) => {
  const r = report;
  const client = r?.client?.display_name ?? "Cliente";
  const actions = r?.actions ?? [];
  const briefing: { label: string; value?: string | null }[] = [
    { label: "Cliente", value: r?.client?.display_name },
    { label: "Data da imersão", value: formatVisitDate(r?.client?.visit_date) },
    { label: "Local", value: r?.client?.location },
    { label: "Representante", value: r?.client?.representative },
    { label: "Consultor", value: r?.client?.consultant },
    { label: "Categoria comercial", value: r?.client?.category },
    { label: "Atingimento geral", value: r?.client?.attainment },
  ];

  return (
    <Html lang="pt-BR" dir="ltr">
      <Head />
      <Preview>{`Relatório Executivo de Imersão · ${client}`}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={header}>
            <Text style={kicker}>POOLFLUX · RELATÓRIO EXECUTIVO DE IMERSÃO</Text>
            <Heading style={h1}>{client}</Heading>
            <Text style={headerMeta}>
              {formatVisitDate(r?.client?.visit_date)}
              {r?.client?.location ? ` · ${r.client.location}` : ""}
            </Text>
          </Section>

          {message ? (
            <Section style={card}>
              <Text style={intro}>{message}</Text>
            </Section>
          ) : null}

          <Section style={sectionTitleWrap}>
            <Text style={sectionTitle}>BRIEFING EXECUTIVO</Text>
          </Section>
          <Section style={card}>
            {briefing.map((b) => (
              <Section key={b.label} style={planRow}>
                <Text style={label}>{b.label.toUpperCase()}</Text>
                <Text style={planTitle}>{b.value || "—"}</Text>
              </Section>
            ))}
            {(r?.brands_observed ?? []).length ? (
              <Section style={{ paddingTop: "10px" }}>
                <Text style={label}>MARCAS OBSERVADAS</Text>
                <Text style={paragraph}>{(r?.brands_observed ?? []).join(" · ")}</Text>
              </Section>
            ) : null}
          </Section>

          <Section style={sectionTitleWrap}>
            <Text style={sectionTitle}>LEITURA EXECUTIVA</Text>
          </Section>
          <Section style={card}>
            {readingBlocks(r?.executive_reading).length ? (
              readingBlocks(r?.executive_reading).map((b, i) =>
                b.kind === "h" ? (
                  <Text key={i} style={blockTitle}>
                    {b.text}
                  </Text>
                ) : (
                  <Text key={i} style={readingParagraph}>
                    {b.text}
                  </Text>
                ),
              )
            ) : (
              <Text style={paragraph}>—</Text>
            )}
          </Section>

          <Section style={sectionTitleWrap}>
            <Text style={sectionTitle}>DO DIAGNÓSTICO À AÇÃO</Text>
          </Section>

          {(r?.decision_blocks ?? []).map((b, i) => {
            const acts = actions.filter((a) => b.action_ids.includes(a.id));
            return (
              <Section key={b.id} style={card}>
                <Text style={blockIndex}>{String(i + 1).padStart(2, "0")}</Text>
                <Text style={blockTitle}>{b.title}</Text>
                {b.cause ? (
                  <>
                    <Text style={label}>CAUSA</Text>
                    <Text style={paragraph}>{b.cause}</Text>
                  </>
                ) : null}
                {b.impact ? (
                  <>
                    <Text style={label}>O QUE ISSO GERA</Text>
                    <Text style={paragraph}>{b.impact}</Text>
                  </>
                ) : null}
                {b.evidence?.quote ? (
                  <Section style={quoteBox}>
                    <Text style={quote}>{`“${b.evidence.quote}”`}</Text>
                    {b.evidence.author || b.evidence.role ? (
                      <Text style={quoteWho}>
                        {[b.evidence.author, b.evidence.role].filter(Boolean).join(" · ")}
                      </Text>
                    ) : null}
                  </Section>
                ) : null}
                {acts.length ? (
                  <>
                    <Text style={label}>AÇÕES</Text>
                    {acts.map((a) => (
                      <Text key={a.id} style={actionLine}>
                        <span style={tag}>{statusTag(a.status)}</span>
                        <br />
                        <strong>{a.title}</strong>
                        {a.description ? (
                          <>
                            <br />
                            <span style={{ color: MUTED, fontSize: "14px" }}>{a.description}</span>
                          </>
                        ) : null}
                        <br />
                        <span style={{ color: MUTED, fontSize: "13px" }}>
                          {AREA_LABEL[a.area]} · Prioridade {PRIORITY_LABEL[a.priority]}
                        </span>
                      </Text>
                    ))}
                  </>
                ) : null}
              </Section>
            );
          })}


          {(r?.do_not_prioritize ?? []).length ? (
            <>
              <Section style={sectionTitleWrap}>
                <Text style={sectionTitle}>ONDE NÃO CONCENTRAR ENERGIA AGORA</Text>
              </Section>
              {(r?.do_not_prioritize ?? []).map((n, i) => (
                <Section key={n.id ?? i} style={card}>
                  <Text style={blockTitle}>{n.title}</Text>
                  {n.cause ? (
                    <>
                      <Text style={label}>CAUSA</Text>
                      <Text style={paragraph}>{n.cause}</Text>
                    </>
                  ) : null}
                  {n.decision ? (
                    <>
                      <Text style={label}>DECISÃO RECOMENDADA</Text>
                      <Text style={paragraph}>{n.decision}</Text>
                    </>
                  ) : null}
                </Section>
              ))}
            </>
          ) : null}

          <Section style={sectionTitleWrap}>
            <Text style={sectionTitle}>PLANO DE AÇÃO</Text>
          </Section>
          <Section style={card}>
            {actions.length ? (
              actions.map((a) => (
                <Section key={a.id} style={planRow}>
                  <Text style={planBadge}>
                    {statusTag(a.status)} · {PRIORITY_LABEL[a.priority]} · {AREA_LABEL[a.area]}
                  </Text>
                  <Text style={planTitle}>{a.title}</Text>
                  {a.description ? <Text style={planDesc}>{a.description}</Text> : null}
                </Section>
              ))
            ) : (
              <Text style={paragraph}>Nenhuma ação neste relatório.</Text>

            )}
          </Section>

          {appUrl ? (
            <Section style={{ textAlign: "center", padding: "8px 0 4px" }}>
              <Button href={appUrl} style={button}>
                Abrir relatório no sistema
              </Button>
            </Section>
          ) : null}

          <Hr style={hr} />
          <Text style={footer}>
            PoolFlux · Relatório Executivo de Imersão em Campo
            <br />
            Documento de uso interno e confidencial.
          </Text>
        </Container>
      </Body>
    </Html>
  );
};

export const template = {
  component: ExecutiveReportEmail,
  subject: (d: Record<string, any>) =>
    d?.subject || `Relatório Executivo de Imersão · ${d?.report?.client?.display_name ?? "Cliente"}`,
  displayName: "Relatório Executivo de Imersão",
  previewData: {
    report: {
      status: "closed",
      report_title: "Relatório Executivo",
      client: { display_name: "LLUMINAH ILUMINAÇÃO", visit_date: "2026-08-01", location: "Curitiba/PR" },
      executive_reading: "Leitura gerencial resumida da imersão.",
      brands_observed: [],
      decision_blocks: [],
      do_not_prioritize: [],
      actions: [],
      email: {},
      current_version: 1,
    },
  },
} satisfies TemplateEntry;

const main = {
  backgroundColor: "#ffffff",
  fontFamily: "Helvetica, Arial, sans-serif",
  margin: "0",
  padding: "0",
};
const container = { width: "100%", maxWidth: "640px", margin: "0 auto", padding: "24px 16px" };
const header = { backgroundColor: BRAND, borderRadius: "10px", padding: "28px 24px", marginBottom: "16px" };
const kicker = { color: "#8FD3E4", fontSize: "11px", letterSpacing: "1px", margin: "0 0 8px" };
const h1 = { color: "#ffffff", fontSize: "24px", lineHeight: "30px", margin: "0" };
const headerMeta = { color: "#C8DCE6", fontSize: "13px", margin: "8px 0 0" };
const card = {
  backgroundColor: "#F6FAFC",
  border: `1px solid ${LINE}`,
  borderRadius: "10px",
  padding: "20px",
  marginBottom: "14px",
};
const sectionTitleWrap = { padding: "12px 4px 6px" };
const sectionTitle = { color: BRAND, fontSize: "13px", letterSpacing: "1.4px", fontWeight: "bold", margin: "0" };
const chapterLabel = { color: MUTED, fontSize: "11px", letterSpacing: "1px", margin: "0 0 8px" };
const intro = { color: TEXT, fontSize: "15px", lineHeight: "24px", margin: "0 0 16px" };
const paragraph = { color: TEXT, fontSize: "15px", lineHeight: "24px", margin: "0 0 12px" };
const meta = { color: MUTED, fontSize: "13px", margin: "4px 0 0" };
const label = { color: MUTED, fontSize: "11px", letterSpacing: "1px", margin: "12px 0 4px", fontWeight: "bold" };
const blockIndex = { color: ACCENT, fontSize: "12px", fontWeight: "bold", margin: "0" };
const blockTitle = { color: BRAND, fontSize: "18px", lineHeight: "24px", fontWeight: "bold", margin: "4px 0 10px" };
const quoteBox = { borderLeft: `3px solid ${ACCENT}`, padding: "4px 0 4px 14px", margin: "8px 0" };
const quote = { color: TEXT, fontSize: "15px", fontStyle: "italic", lineHeight: "23px", margin: "0" };
const quoteWho = { color: MUTED, fontSize: "12px", margin: "6px 0 0" };
const actionLine = { color: TEXT, fontSize: "15px", lineHeight: "22px", margin: "0 0 10px" };
const planRow = { borderBottom: `1px solid ${LINE}`, padding: "10px 0" };
const planBadge = { color: ACCENT, fontSize: "11px", letterSpacing: "0.6px", fontWeight: "bold", margin: "0 0 4px" };
const planTitle = { color: TEXT, fontSize: "15px", fontWeight: "bold", margin: "0" };
const planDesc = { color: MUTED, fontSize: "13px", lineHeight: "20px", margin: "4px 0 0" };
const button = {
  backgroundColor: ACCENT,
  color: "#ffffff",
  borderRadius: "8px",
  fontSize: "15px",
  fontWeight: "bold",
  padding: "14px 24px",
  textDecoration: "none",
  display: "inline-block",
};
const hr = { borderColor: LINE, margin: "20px 0 12px" };
const footer = { color: MUTED, fontSize: "12px", lineHeight: "18px", textAlign: "center" as const, margin: "0" };
