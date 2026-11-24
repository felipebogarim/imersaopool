import React from "react";
import {
  Body,
  Button,
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

interface Props {
  name?: string;
  mensagem?: string;
  clientes?: Array<{ nome: string; url: string }>;
  /** Primeiro acesso: link único para cadastrar a senha e seguir ao portal. */
  senhaUrl?: string | null;
  portalUrl?: string;
}

export const MetasConviteMassaEmail = ({
  name,
  mensagem,
  clientes = [],
  senhaUrl,
  portalUrl,
}: Props) => {
  const n = clientes.length;
  const titulo = `Revisão de metas · ${n} ${n === 1 ? "cliente" : "clientes"}`;
  return (
    <Html lang="pt-BR" dir="ltr">
      <Head />
      <Preview>{titulo}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>{titulo}</Heading>
          <Text style={text}>Olá{name ? `, ${name}` : ""}!</Text>
          {mensagem ? <Text style={quote}>{mensagem}</Text> : null}
          <Text style={text}>
            {n === 1
              ? "O cliente abaixo está com as metas mensais prontas para a sua revisão:"
              : `Os ${n} clientes abaixo estão com as metas mensais prontas para a sua revisão:`}
          </Text>
          <Section style={list}>
            {clientes.map((c) => (
              <Text key={c.url} style={item}>
                •{" "}
                <Link href={c.url} style={link}>
                  {c.nome}
                </Link>
              </Text>
            ))}
          </Section>
          {senhaUrl ? (
            <>
              <Text style={text}>
                Primeiro acesso: cadastre sua senha. Depois disso você será levado ao portal com
                todos esses clientes.
              </Text>
              <Section style={{ margin: "8px 0 20px" }}>
                <Button href={senhaUrl} style={button}>
                  Cadastrar senha e revisar metas
                </Button>
              </Section>
            </>
          ) : portalUrl ? (
            <Section style={{ margin: "8px 0 20px" }}>
              <Button href={portalUrl} style={button}>
                Abrir portal e revisar metas
              </Button>
            </Section>
          ) : null}
          <Text style={muted}>
            Em cada cliente você verá a meta oficial, o atingimento e poderá registrar as suas
            sugestões. O convite é pessoal.
          </Text>
          <Text style={muted}>PoolFlux · Imersão Comercial</Text>
        </Container>
      </Body>
    </Html>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const template = {
  component: MetasConviteMassaEmail,
  subject: (d: Record<string, unknown>) => {
    const n = Array.isArray(d.clientes) ? d.clientes.length : 0;
    return `Revisão de metas · ${n} ${n === 1 ? "cliente" : "clientes"}`;
  },
  displayName: "Convite em massa para revisão de metas (representante)",
  previewData: {
    name: "Matheus",
    mensagem: "Gostaríamos da sua colaboração na revisão das metas mensais da sua carteira.",
    clientes: [
      { nome: "Cliente Exemplo Ltda", url: "https://poolflux.app/portal-rep/metas/exemplo-1" },
      { nome: "Loja Modelo Ltda", url: "https://poolflux.app/portal-rep/metas/exemplo-2" },
    ],
    senhaUrl: null,
    portalUrl: "https://poolflux.app/portal-rep",
  },
} satisfies TemplateEntry;

const main = { backgroundColor: "#ffffff", fontFamily: "Inter, Arial, sans-serif" };
const container = { padding: "32px 28px", maxWidth: "560px" };
const h1 = { color: "#0a1730", fontSize: "22px", fontWeight: 700, margin: "0 0 16px" };
const text = { color: "#334155", fontSize: "15px", lineHeight: "22px", margin: "0 0 12px" };
const quote = {
  ...text,
  borderLeft: "3px solid #cbd5e1",
  paddingLeft: "12px",
  whiteSpace: "pre-wrap" as const,
};
const list = { margin: "0 0 16px" };
const item = { ...text, margin: "0 0 6px" };
const link = { color: "#062838", fontWeight: 600, textDecoration: "underline" };
const muted = { color: "#64748b", fontSize: "12px", wordBreak: "break-all" as const };
const button = {
  backgroundColor: "#062838",
  color: "#ffffff",
  padding: "12px 22px",
  borderRadius: "8px",
  fontWeight: 600,
  fontSize: "15px",
  textDecoration: "none",
};
