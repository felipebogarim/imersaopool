import React from "react";
import { Body, Container, Head, Heading, Hr, Html, Img, Link, Preview, Section, Text } from "@react-email/components";
import type { TemplateEntry } from "./registry";

interface Block {
  id?: string;
  media_url?: string;
  media_type?: "image" | "video";
  video_url?: string;
  description?: string;
}

interface Props {
  title?: string;
  intro?: string;
  blocks?: Block[];
  farewell?: string;
  recipientName?: string;
}

const Email = ({ title, intro, blocks, farewell, recipientName }: Props) => (
  <Html lang="pt-BR" dir="ltr">
    <Head>
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <style>{`
        @media only screen and (max-width: 600px) {
          .container { width: 100% !important; }
          .header, .content { padding: 18px 16px !important; }
          h1 { font-size: 18px !important; line-height: 24px !important; }
          img { max-width: 100% !important; height: auto !important; }
          td { word-break: break-word; }
        }
      `}</style>
    </Head>
    <Preview>{title ?? "Novidades no sistema"}</Preview>
    <Body style={main}>
      <Container className="container" style={container}>
        <Section className="header" style={header}>
          <Heading style={h1}>{title ?? "Novidades no sistema"}</Heading>
        </Section>
        <Section className="content" style={content}>
          {recipientName && <Text style={text}>Olá, {recipientName}!</Text>}
          {intro && <Text style={text}>{intro}</Text>}
          {(blocks ?? []).map((b, i) => (
            <Section key={b.id ?? String(i)} style={blockStyle}>
              {b.media_url && b.media_type !== "video" && (
                <Img src={b.media_url} alt="" width="560" style={img} />
              )}
              {b.media_url && b.media_type === "video" && (
                <Text style={text}>
                  <Link href={b.media_url} style={link}>Assistir ao vídeo</Link>
                </Text>
              )}
              {!b.media_url && b.video_url && (
                <Text style={text}>
                  <Link href={b.video_url} style={link}>Assistir ao vídeo</Link>
                </Text>
              )}
              {b.description && <Text style={text}>{b.description}</Text>}
            </Section>
          ))}
          <Hr style={hr} />
          <Text style={muted}>{farewell || "Até a próxima"}</Text>
          <Text style={muted}>PoolFlux</Text>
        </Section>
      </Container>
    </Body>
  </Html>
);

export const template = {
  component: Email,
  subject: (d: Record<string, any>) => d?.subject || d?.title || "Novidades no sistema",
  displayName: "Central de Mensagens",
  previewData: {
    title: "Novo formato Relatório Executivo",
    intro: "Temos novidades no sistema para você.",
    blocks: [{ description: "Agora o relatório executivo tem um formato mais direto." }],
    farewell: "Até a próxima",
  },
} satisfies TemplateEntry;

const main = { backgroundColor: "#f1f5f9", fontFamily: "Inter, Arial, sans-serif" };
const container = { maxWidth: "600px", margin: "0 auto", backgroundColor: "#ffffff" };
const header = { backgroundColor: "#003087", padding: "24px 28px" };
const content = { padding: "24px 28px" };
const h1 = { color: "#ffffff", fontSize: "20px", fontWeight: 700, margin: 0 };
const text = { color: "#334155", fontSize: "15px", lineHeight: "23px", margin: "0 0 14px", whiteSpace: "pre-line" as const };
const blockStyle = { margin: "0 0 8px" };
const img = { width: "100%", maxWidth: "544px", borderRadius: "8px", margin: "0 0 12px" };
const link = { color: "#003087" };
const hr = { borderColor: "#e2e8f0", margin: "20px 0" };
const muted = { color: "#94a3b8", fontSize: "13px", margin: "0 0 4px" };
