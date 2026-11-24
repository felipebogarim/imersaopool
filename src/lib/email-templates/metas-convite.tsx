import React from "react";
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import type { TemplateEntry } from "./registry";

interface Props {
  name?: string;
  cliente?: string;
  mensagem?: string;
  /** Link das metas do cliente no portal. */
  metasUrl?: string;
  /** Primeiro acesso: link para cadastrar a senha (ausente se o acesso já existe). */
  senhaUrl?: string;
}

export const MetasConviteEmail = ({ name, cliente, mensagem, metasUrl, senhaUrl }: Props) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Revisão das metas mensais{cliente ? ` · ${cliente}` : ""}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Revisão de metas{cliente ? ` · ${cliente}` : ""}</Heading>
        <Text style={text}>Olá{name ? `, ${name}` : ""}!</Text>
        {mensagem ? <Text style={quote}>{mensagem}</Text> : null}
        {senhaUrl ? (
          <>
            <Text style={text}>
              <strong>1.</strong> Cadastre ou redefina sua senha de acesso ao portal do
              representante:
            </Text>
            <Section style={{ margin: "8px 0 20px" }}>
              <Button href={senhaUrl} style={button}>
                Cadastrar ou redefinir minha senha
              </Button>
            </Section>
            <Text style={text}>
              <strong>2.</strong> Depois, abra as metas do cliente e registre sua sugestão por
              portfólio:
            </Text>
          </>
        ) : (
          <Text style={text}>
            Abra as metas do cliente e registre sua sugestão e justificativa por portfólio:
          </Text>
        )}
        <Section style={{ margin: "8px 0 20px" }}>
          <Button href={metasUrl} style={senhaUrl ? buttonOutline : button}>
            Abrir metas do cliente
          </Button>
        </Section>
        <Text style={muted}>{metasUrl}</Text>
        <Text style={muted}>
          Você verá a meta oficial, o atingimento e as suas sugestões. O convite é pessoal
          {senhaUrl ? " e o link de senha vale por 14 dias" : ""}.
        </Text>
        <Text style={muted}>PoolFlux · Imersão Comercial</Text>
      </Container>
    </Body>
  </Html>
);

// eslint-disable-next-line react-refresh/only-export-components
export const template = {
  component: MetasConviteEmail,
  subject: (d: Record<string, unknown>) =>
    `Revisão de metas${d.cliente ? ` · ${String(d.cliente)}` : ""}`,
  displayName: "Convite para revisão de metas (representante)",
  previewData: {
    name: "Matheus",
    cliente: "Cliente Exemplo Ltda",
    mensagem: "Gostaríamos da sua colaboração na revisão das metas mensais deste cliente.",
    metasUrl: "https://poolflux.app/portal-rep/metas/exemplo",
    senhaUrl: "https://poolflux.app/definir-senha?t=exemplo",
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
const buttonOutline = {
  ...button,
  backgroundColor: "#ffffff",
  color: "#062838",
  border: "1px solid #062838",
};
