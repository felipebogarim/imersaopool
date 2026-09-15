import React from "react";
import {
  Body,
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
  isCompactLayout,
  isCompactV2,
  type ExecutiveReportData,
} from "@/lib/executive-report/types";

export interface ExecutiveFamilyBar {
  familia: string;
  atingimento: number;
  farol?: string;
  fill?: string;
}

export interface ExecutiveEmailAttachment {
  name: string;
  url: string;
  size?: number;
}

export interface ExecutiveEmailProps {
  report?: ExecutiveReportData;
  message?: string;
  appUrl?: string;
  families?: ExecutiveFamilyBar[];
  immersionReportId?: string | null;
  representativeId?: string | null;
  attachments?: ExecutiveEmailAttachment[];
}

function formatSize(n?: number) {
  if (!n || n <= 0) return "";
  if (n < 1024 * 1024) return ` (${Math.round(n / 1024)} KB)`;
  return ` (${(n / (1024 * 1024)).toFixed(1)} MB)`;
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

export const ExecutiveReportEmail = ({ report, message, appUrl, families, immersionReportId, representativeId, attachments }: ExecutiveEmailProps) => {
  const r = report;
  const compact = isCompactLayout(r);
  const v2 = isCompactV2(r);
  const client = r?.client?.display_name ?? "Cliente";
  const companyName = (r?.companyName || "Newline").toUpperCase();
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
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <style>{`
          @media only screen and (max-width: 600px) {
            .container { width: 100% !important; padding: 16px 12px !important; }
            .header { padding: 20px 16px !important; }
            .card { padding: 14px !important; }
            h1 { font-size: 20px !important; line-height: 26px !important; }
            td { word-break: break-word; }
            img { max-width: 100% !important; height: auto !important; }
          }
        `}</style>
      </Head>
      <Preview>{`Relatório Executivo de Imersão · ${client}`}</Preview>
      <Body style={main}>
        <Container className="container" style={container}>
          {appUrl && immersionReportId ? (
            <Section style={{ textAlign: "center", padding: "0 0 18px" }}>
              <a
                href={`${appUrl.split("/").slice(0, 3).join("/")}/visao-imersao-2/${immersionReportId}/executivo?ouvir=1`}
                style={listenButton}
              >
                ▶ Ouvir relatório (leitura em voz alta)
              </a>
            </Section>
          ) : null}

          <Section className="header" style={header}>
            <Text style={kicker}>{companyName} · RELATÓRIO EXECUTIVO DE IMERSÃO</Text>
            <Heading style={h1}>{client}</Heading>
            <Text style={headerMeta}>
              {formatVisitDate(r?.client?.visit_date)}
              {r?.client?.location ? ` · ${r.client.location}` : ""}
            </Text>
          </Section>

          {message ? (
            <Section className="card" style={card}>
              <Text style={intro}>{message}</Text>
            </Section>
          ) : null}

          <Section style={sectionTitleWrap}>
            <Text style={sectionTitle}>BRIEFING EXECUTIVO</Text>
          </Section>
          <Section className="card" style={card}>
            <table cellPadding={0} cellSpacing={0} width="100%" style={{ borderCollapse: "collapse" }}>
              <tbody>
                {briefing.map((b) => (
                  <tr key={b.label}>
                    <td style={briefLabelCell}>{b.label.toUpperCase()}</td>
                    <td style={briefValueCell}>{b.value || "—"}</td>
                  </tr>
                ))}
                {(r?.brands_observed ?? []).length ? (
                  <tr>
                    <td style={briefLabelCell}>MARCAS OBSERVADAS</td>
                    <td style={briefValueCell}>{(r?.brands_observed ?? []).join(" · ")}</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </Section>

          <Section style={sectionTitleWrap}>
            <Text style={sectionTitle}>LEITURA EXECUTIVA</Text>
          </Section>
          <Section className="card" style={card}>
            {compact ? (
              <>
                {r?.executive_summary ? (
                  <Text style={readingParagraph}>{r.executive_summary}</Text>
                ) : null}
                {(r?.executive_topics ?? []).map((t, i) => (
                  <React.Fragment key={`${t.title}-${i}`}>
                    <Text style={blockTitle}>{t.title}</Text>
                    {t.bullets.map((b, j) => (
                      <Text key={j} style={bulletLine}>
                        {`• ${b}`}
                      </Text>
                    ))}
                  </React.Fragment>
                ))}
              </>
            ) : readingBlocks(r?.executive_reading).length ? (
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

          {(families ?? []).length ? (
            <>
              <Section style={sectionTitleWrap}>
                <Text style={sectionTitle}>RESULTADO POR FAMÍLIA</Text>
              </Section>
              <Section className="card" style={card}>
                <table cellPadding={0} cellSpacing={0} width="100%" style={{ borderCollapse: "collapse" }}>
                  <tbody>
                    {(families ?? []).map((f) => {
                      const pct = Number.isFinite(f.atingimento) ? f.atingimento : 0;
                      const width = Math.max(1, Math.min(100, (pct / 120) * 100));
                      return (
                        <tr key={f.familia}>
                          <td style={barNameCell}>{f.familia}</td>
                          <td style={{ padding: "6px 8px", width: "60%" }}>
                            <table cellPadding={0} cellSpacing={0} width="100%" style={barTrack}>
                              <tbody>
                                <tr>
                                  <td
                                    style={{
                                      width: `${width}%`,
                                      backgroundColor: `#${f.fill ?? "E5E5E5"}`,
                                      height: "14px",
                                      borderRadius: "4px",
                                      fontSize: "1px",
                                      lineHeight: "14px",
                                    }}
                                  >
                                    &nbsp;
                                  </td>
                                  <td>&nbsp;</td>
                                </tr>
                              </tbody>
                            </table>
                          </td>
                          <td style={barValueCell}>
                            {`${pct.toFixed(1).replace(".", ",")}%`}
                            {f.farol ? ` · ${f.farol}` : ""}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </Section>
            </>
          ) : null}

          {v2 ? (
            <>
              {(r?.evidence_recommendations ?? []).length ? (
                <>
                  <Section style={sectionTitleWrap}>
                    <Text style={sectionTitle}>EVIDÊNCIAS E RECOMENDAÇÕES</Text>
                  </Section>
                  {(r?.evidence_recommendations ?? []).map((e, i) => (
                    <Section key={e.id ?? i} className="card" style={card}>
                      <Text style={blockTitle}>{e.title}</Text>
                      {e.perception ? (
                        <>
                          <Text style={label}>PERCEPÇÃO</Text>
                          <Text style={paragraph}>{e.perception}</Text>
                        </>
                      ) : null}
                      {e.evidence?.quote ? (
                        <>
                          <Text style={label}>CITAÇÃO</Text>
                          <Section style={quoteBox}>
                            <Text style={quote}>{`“${e.evidence.quote}”`}</Text>
                            {e.evidence.author || e.evidence.role ? (
                              <Text style={quoteWho}>
                                {[e.evidence.author, e.evidence.role].filter(Boolean).join(", ")}
                              </Text>
                            ) : null}
                          </Section>
                        </>
                      ) : null}
                      {e.opportunity ? (
                        <>
                          <Text style={labelHighlight}>OPORTUNIDADE</Text>
                          <Text style={{ ...paragraph, fontWeight: 600 }}>{e.opportunity}</Text>
                        </>
                      ) : null}
                    </Section>
                  ))}
                </>
              ) : null}

              {actions.length ? (
                <>
                  <Section style={sectionTitleWrap}>
                    <Text style={sectionTitle}>AÇÕES SUGERIDAS</Text>
                  </Section>
                  {actions.slice(0, 3).map((a) => (
                    <Section key={a.id} className="card" style={card}>
                      <Text style={blockTitle}>{a.title}</Text>
                      {a.description ? <Text style={paragraph}>{a.description}</Text> : null}
                      <Text style={{ color: MUTED, fontSize: "13px", margin: "4px 0 0" }}>
                        {AREA_LABEL[a.area]} · Prioridade {PRIORITY_LABEL[a.priority]}
                      </Text>
                    </Section>
                  ))}
                </>
              ) : null}
            </>
          ) : null}

          {!v2 ? (
            <Section style={sectionTitleWrap}>
              <Text style={sectionTitle}>DO DIAGNÓSTICO À AÇÃO</Text>
            </Section>
          ) : null}

          {(v2 ? [] : r?.decision_blocks ?? []).map((b, i) => {
            const acts = actions.filter((a) => b.action_ids.includes(a.id));
            return (
              <Section key={b.id} className="card" style={card}>
                <Text style={blockIndex}>{String(i + 1).padStart(2, "0")}</Text>
                <Text style={blockTitle}>{b.title}</Text>
                {compact ? (
                  b.fact || b.cause ? (
                    <>
                      <Text style={label}>FATO / PERCEPÇÃO OBSERVADA</Text>
                      <Text style={paragraph}>{b.fact || b.cause}</Text>
                    </>
                  ) : null
                ) : (
                  <>
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
                  </>
                )}
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
                    <Text style={labelHighlight}>AÇÕES</Text>
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
                <Section key={n.id ?? i} className="card" style={card}>
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

          {(attachments ?? []).length ? (
            <Section style={linksSection}>
              <Text style={linksTitle}>ARQUIVOS ANEXOS</Text>
              {(attachments ?? []).map((a, i) => (
                <Text key={`${a.url}-${i}`} style={linkLine}>
                  <a href={a.url} style={linkStyle}>
                    {a.name}
                  </a>
                  <span style={{ color: MUTED, fontSize: "12px" }}>{formatSize(a.size)}</span>
                </Text>
              ))}
              <Text style={{ color: MUTED, fontSize: "11px", margin: "0 0 8px" }}>
                Links de download válidos por 90 dias.
              </Text>
            </Section>
          ) : null}

          {appUrl ? (
            <Section style={linksSection}>
              <Text style={linksTitle}>ACESSE NO SISTEMA</Text>
              {immersionReportId ? (
                <>
                  <Text style={linkLine}>
                    <a href={`${appUrl.split("/").slice(0, 3).join("/")}/visao-imersao-2/${immersionReportId}`} style={linkStyle}>
                      Visão Imersão 2
                    </a>
                  </Text>
                  <Text style={linkLine}>
                    <a href={`${appUrl.split("/").slice(0, 3).join("/")}/imersoes/${immersionReportId}`} style={linkStyle}>
                      Relatório de Imersão
                    </a>
                  </Text>
                </>
              ) : null}
              {representativeId ? (
                <Text style={linkLine}>
                  <a href={`${appUrl.split("/").slice(0, 3).join("/")}/visao-rep-2?rep=${representativeId}`} style={linkStyle}>
                    Visão Rep
                  </a>
                </Text>
              ) : null}
            </Section>
          ) : null}

          <Hr style={hr} />
          <Text style={footer}>
            {companyName} · Relatório Executivo de Imersão em Campo
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
const intro = { color: TEXT, fontSize: "15px", lineHeight: "24px", margin: "0 0 16px" };
const paragraph = { color: TEXT, fontSize: "15px", lineHeight: "24px", margin: "0 0 12px" };
const label = { color: MUTED, fontSize: "11px", letterSpacing: "1px", margin: "12px 0 4px", fontWeight: "bold" };
const labelHighlight = {
  backgroundColor: "#FDE047",
  color: "#0E1C28",
  fontSize: "11px",
  letterSpacing: "1px",
  fontWeight: "bold" as const,
  padding: "5px 10px",
  borderRadius: "4px",
  display: "inline-block" as const,
  margin: "12px 0 8px",
};
const blockIndex = { color: ACCENT, fontSize: "12px", fontWeight: "bold", margin: "0" };
const blockTitle = { color: BRAND, fontSize: "18px", lineHeight: "24px", fontWeight: "bold", margin: "4px 0 10px" };
const quoteBox = { borderLeft: `3px solid ${ACCENT}`, padding: "4px 0 4px 14px", margin: "8px 0" };
const quote = { color: TEXT, fontSize: "15px", fontStyle: "italic", lineHeight: "23px", margin: "0" };
const quoteWho = { color: MUTED, fontSize: "12px", margin: "6px 0 0" };
const actionLine = { color: TEXT, fontSize: "15px", lineHeight: "22px", margin: "0 0 10px" };
const hr = { borderColor: LINE, margin: "20px 0 12px" };
const footer = { color: MUTED, fontSize: "12px", lineHeight: "18px", textAlign: "center" as const, margin: "0" };
const linksSection = { textAlign: "center" as const, padding: "8px 0 4px" };
const linksTitle = { color: MUTED, fontSize: "11px", letterSpacing: "1px", fontWeight: "bold" as const, margin: "0 0 12px" };
const linkLine = { margin: "0 0 10px" };
const linkStyle = { color: ACCENT, fontSize: "15px", fontWeight: "bold" as const, textDecoration: "underline" };
const readingParagraph = { color: TEXT, fontSize: "15px", lineHeight: "25px", margin: "0 0 18px" };
const bulletLine = { color: TEXT, fontSize: "15px", lineHeight: "23px", margin: "0 0 8px" };
const tag = {
  backgroundColor: "#E6F4F8",
  color: BRAND,
  borderRadius: "4px",
  fontSize: "11px",
  fontWeight: "bold",
  letterSpacing: "0.6px",
  padding: "3px 8px",
  textTransform: "uppercase" as const,
};
const briefLabelCell = {
  color: MUTED,
  fontSize: "10px",
  letterSpacing: "0.8px",
  fontWeight: "bold" as const,
  padding: "5px 10px 5px 0",
  whiteSpace: "nowrap" as const,
  verticalAlign: "top" as const,
  width: "38%",
};
const briefValueCell = {
  color: TEXT,
  fontSize: "13px",
  lineHeight: "18px",
  padding: "5px 0",
  verticalAlign: "top" as const,
};
const barNameCell = {
  color: TEXT,
  fontSize: "12px",
  padding: "6px 8px 6px 0",
  verticalAlign: "middle" as const,
  width: "26%",
};
const barTrack = {
  backgroundColor: "#EDF3F6",
  borderRadius: "4px",
  borderCollapse: "collapse" as const,
};
const barValueCell = {
  color: MUTED,
  fontSize: "11px",
  padding: "6px 0 6px 8px",
  textAlign: "right" as const,
  verticalAlign: "middle" as const,
  whiteSpace: "nowrap" as const,
};
const listenButton = {
  backgroundColor: ACCENT,
  color: "#ffffff",
  display: "inline-block" as const,
  fontSize: "14px",
  fontWeight: "bold" as const,
  padding: "12px 24px",
  borderRadius: "8px",
  textDecoration: "none",
};
