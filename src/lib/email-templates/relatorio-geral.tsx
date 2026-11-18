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
import type { GeneralReportContent, ReportBlock } from "@/lib/general-report-lib";

const BRAND = "#062838";
const TEXT = "#0E1C28";
const MUTED = "#5A6A76";
const LINE = "#E1E9EF";
const BARS = ["#3a8fb0", "#e8a33d", "#5aa469", "#c8553d", "#7a6bb5"];

export interface GeneralEmailProps {
  report: GeneralReportContent;
  message?: string;
  representative?: string;
  date?: string;
  appUrl?: string;
  reportId?: string;
  /** fileId -> URL assinada (válida por 90 dias) das imagens do relatório. */
  imageUrls?: Record<string, string>;
  attachments?: Array<{ name: string; url: string; size: number }>;
}

const fmt = (v: unknown) =>
  typeof v === "number" ? v.toLocaleString("pt-BR", { maximumFractionDigits: 2 }) : String(v ?? "");

function BlockEmail({ b, imageUrls }: { b: ReportBlock; imageUrls: Record<string, string> }) {
  switch (b.type) {
    case "text":
      return <Text style={p}>{b.text}</Text>;
    case "bullets":
      return (
        <Section style={box}>
          {b.title ? <Text style={boxTitle}>{b.title}</Text> : null}
          {b.items.map((i, k) => (
            <Text key={k} style={li}>
              • {i}
            </Text>
          ))}
        </Section>
      );
    case "kpis":
      return (
        <table width="100%" cellPadding={0} cellSpacing={6} style={{ marginBottom: 10 }}>
          <tbody>
            <tr>
              {b.items.slice(0, 4).map((k, i) => (
                <td key={i} style={kpi} valign="top">
                  <div style={{ color: MUTED, fontSize: 10, textTransform: "uppercase" }}>
                    {k.label}
                  </div>
                  <div style={{ color: BRAND, fontSize: 20, fontWeight: "bold" }}>{k.value}</div>
                  {k.hint ? <div style={{ color: MUTED, fontSize: 11 }}>{k.hint}</div> : null}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      );
    case "chart": {
      const s = b.series[0];
      const max = Math.max(...b.data.map((d) => Math.abs(Number(d[s]) || 0)), 1);
      return (
        <Section style={box}>
          <Text style={boxTitle}>{b.title}</Text>
          <table width="100%" cellPadding={0} cellSpacing={0}>
            <tbody>
              {b.data.slice(0, 12).map((d, i) => {
                const pct = Math.max(2, Math.round((Math.abs(Number(d[s]) || 0) / max) * 100));
                return (
                  <tr key={i}>
                    <td
                      style={{ width: "32%", fontSize: 12, color: TEXT, padding: "3px 6px 3px 0" }}
                    >
                      {String(d[b.x])}
                    </td>
                    <td style={{ padding: "3px 0" }}>
                      <div
                        style={{
                          width: `${pct}%`,
                          backgroundColor: BARS[0],
                          height: 14,
                          borderRadius: 3,
                        }}
                      />
                    </td>
                    <td
                      style={{
                        width: "22%",
                        fontSize: 12,
                        color: TEXT,
                        textAlign: "right",
                        padding: "3px 0 3px 6px",
                      }}
                    >
                      {fmt(d[s])}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {b.series.length > 1 ? (
            <Text style={{ color: MUTED, fontSize: 11, margin: "6px 0 0" }}>
              Série exibida: {s}. Veja as demais no sistema.
            </Text>
          ) : null}
          {b.insight ? (
            <Text style={{ color: MUTED, fontSize: 12, margin: "6px 0 0" }}>{b.insight}</Text>
          ) : null}
        </Section>
      );
    }
    case "table":
      return (
        <Section style={box}>
          {b.title ? <Text style={boxTitle}>{b.title}</Text> : null}
          <table
            width="100%"
            cellPadding={0}
            cellSpacing={0}
            style={{ fontSize: 12, borderCollapse: "collapse" }}
          >
            <thead>
              <tr>
                {b.columns.map((c, i) => (
                  <th key={i} align="left" style={th}>
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {b.rows.map((r, i) => (
                <tr key={i}>
                  {r.map((c, j) => (
                    <td key={j} style={td}>
                      {c}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      );
    case "image": {
      const url = imageUrls[b.fileId];
      return (
        <Section style={box}>
          {url ? (
            <img
              src={url}
              alt={b.caption}
              width="100%"
              style={{ maxWidth: "100%", borderRadius: 6 }}
            />
          ) : null}
          {b.caption ? <Text style={boxTitle}>{b.caption}</Text> : null}
          {b.observations.map((o, k) => (
            <Text key={k} style={li}>
              • {o}
            </Text>
          ))}
        </Section>
      );
    }
    case "callout":
      return (
        <Section
          style={{
            ...box,
            borderLeft: `4px solid ${b.tone === "atencao" ? "#e8a33d" : b.tone === "oportunidade" ? "#5aa469" : BRAND}`,
          }}
        >
          <Text style={{ ...p, margin: 0 }}>{b.text}</Text>
        </Section>
      );
  }
}

export const GeneralReportEmail = ({
  report,
  message,
  representative,
  date,
  appUrl,
  reportId,
  imageUrls,
  attachments,
}: GeneralEmailProps) => {
  const origin = appUrl ? appUrl.split("/").slice(0, 3).join("/") : "";
  return (
    <Html lang="pt-BR" dir="ltr">
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <Preview>{report?.title ?? "Relatório Geral"}</Preview>
      <Body
        style={{
          backgroundColor: "#ffffff",
          fontFamily: "Helvetica, Arial, sans-serif",
          margin: 0,
          padding: 0,
        }}
      >
        <Container style={{ width: "100%", maxWidth: 640, margin: "0 auto", padding: "24px 16px" }}>
          <Section style={{ backgroundColor: BRAND, borderRadius: 10, padding: "24px" }}>
            <Text style={{ color: "#8FD3E4", fontSize: 11, letterSpacing: 1, margin: "0 0 8px" }}>
              RELATÓRIO GERAL{representative ? ` · ${representative.toUpperCase()}` : ""}
              {date ? ` · ${date}` : ""}
            </Text>
            <Heading style={{ color: "#fff", fontSize: 22, margin: 0 }}>{report.title}</Heading>
            {report.subtitle ? (
              <Text style={{ color: "#C8DCE6", fontSize: 13, margin: "6px 0 0" }}>
                {report.subtitle}
              </Text>
            ) : null}
          </Section>
          {message ? <Text style={{ ...p, marginTop: 16 }}>{message}</Text> : null}
          {report.executive_summary ? (
            <Section style={{ ...box, marginTop: 14 }}>
              <Text style={boxTitle}>RESUMO</Text>
              <Text style={{ ...p, margin: 0 }}>{report.executive_summary}</Text>
            </Section>
          ) : null}
          {report.chapters.map((ch, i) => (
            <Section key={i} style={{ marginTop: 18 }}>
              <Text
                style={{
                  color: BRAND,
                  fontSize: 13,
                  letterSpacing: 1.2,
                  fontWeight: "bold",
                  margin: "0 0 2px",
                }}
              >
                CAPÍTULO {String(i + 1).padStart(2, "0")} · {ch.title.toUpperCase()}
              </Text>
              {ch.summary ? (
                <Text style={{ color: MUTED, fontSize: 12, margin: "0 0 8px" }}>{ch.summary}</Text>
              ) : null}
              {ch.blocks.map((b, k) => (
                <BlockEmail key={k} b={b} imageUrls={imageUrls ?? {}} />
              ))}
            </Section>
          ))}
          {(attachments ?? []).length ? (
            <Section style={box}>
              <Text style={boxTitle}>ARQUIVOS ANEXOS</Text>
              {(attachments ?? []).map((a, i) => (
                <Text key={i} style={li}>
                  <a href={a.url} style={{ color: BRAND }}>
                    {a.name}
                  </a>
                </Text>
              ))}
              <Text style={{ color: MUTED, fontSize: 11, margin: 0 }}>
                Links de download válidos por 90 dias.
              </Text>
            </Section>
          ) : null}
          {origin && reportId ? (
            <Text style={{ fontSize: 13 }}>
              <a href={`${origin}/relatorio-geral/${reportId}`} style={{ color: BRAND }}>
                Abrir no sistema
              </a>
            </Text>
          ) : null}
          <Hr style={{ borderColor: LINE }} />
          <Text style={{ color: MUTED, fontSize: 11 }}>
            Relatório Geral · Documento de uso interno e confidencial.
          </Text>
        </Container>
      </Body>
    </Html>
  );
};

const p = { color: TEXT, fontSize: 14, lineHeight: "22px", margin: "0 0 10px" } as const;
const li = { color: TEXT, fontSize: 13, lineHeight: "20px", margin: "0 0 4px" } as const;
const box = {
  backgroundColor: "#F6FAFC",
  border: `1px solid ${LINE}`,
  borderRadius: 10,
  padding: "14px 16px",
  marginBottom: 12,
} as const;
const boxTitle = { color: BRAND, fontSize: 12, fontWeight: "bold", margin: "0 0 8px" } as const;
const kpi = {
  backgroundColor: "#F6FAFC",
  border: `1px solid ${LINE}`,
  borderRadius: 8,
  padding: 10,
} as const;
const th = { padding: "6px 8px", borderBottom: `2px solid ${LINE}`, color: BRAND } as const;
const td = { padding: "6px 8px", borderBottom: `1px solid ${LINE}`, color: TEXT } as const;

export const template = {
  component: GeneralReportEmail,
  subject: (d: Record<string, any>) =>
    d?.subject || `Relatório Geral · ${d?.report?.title ?? ""}`.trim(),
  displayName: "Relatório Geral",
  previewData: {
    report: {
      title: "Relatório Geral de exemplo",
      executive_summary: "Resumo de exemplo.",
      chapters: [{ title: "Números", blocks: [{ type: "text", text: "Texto de exemplo." }] }],
    },
    representative: "Representante",
    date: "18/11/2026",
  },
} satisfies TemplateEntry;
