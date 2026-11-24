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
  /** Primeiro acesso: cadastro de senha; acessos seguintes: login normal. */
  accessUrl?: string;
  primeiroAcesso?: boolean;
}

export const MetasConviteEmail = ({
  name,
  cliente,
  mensagem,
  accessUrl,
  primeiroAcesso = false,
}: Props) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Revisão das metas mensais{cliente ? ` · ${cliente}` : ""}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Revisão de metas{cliente ? ` · ${cliente}` : ""}</Heading>
        <Text style={text}>Olá{name ? `, ${name}` : ""}!</Text>
        {mensagem ? <Text style={quote}>{mensagem}</Text> : null}
        {accessUrl ? (
          <>
            <Text style={text}>
              {primeiroAcesso
                ? "Cadastre sua senha para acessar o portal e avaliar as metas deste cliente:"
                : "Entre com seu e-mail e sua senha para avaliar as metas deste cliente:"}
            </Text>
            <Section style={{ margin: "8px 0 20px" }}>
              <Button href={accessUrl} style={button}>
                {primeiroAcesso ? "Cadastrar senha e avaliar metas" : "Entrar e avaliar metas"}
              </Button>
            </Section>
            <Text style={text}>
              Após entrar, você será direcionado automaticamente ao painel de revisão das metas.
            </Text>
          </>
        ) : null}
        <Text style={muted}>
          Você verá a meta oficial, o atingimento e as suas sugestões. O convite é pessoal e o link
          vale por 14 dias.
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
    accessUrl:
      "https://poolflux.app/auth?e=matheus%40exemplo.com&next=%2Fportal-rep%2Fmetas%2Fexemplo",
    primeiroAcesso: false,
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
