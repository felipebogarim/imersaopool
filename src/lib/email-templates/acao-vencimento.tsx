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
  repName?: string;
  items?: { title: string; client?: string; prazo: string; days: number }[];
  portalUrl?: string;
  copy?: boolean;
}

const when = (d: number) =>
  d <= 0 ? "vence hoje" : d === 1 ? "vence amanhã" : `vence em ${d} dias`;

const Email = ({ repName, items = [], portalUrl, copy }: Props) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Ações com vencimento próximo</Preview>
    <Body style={{ backgroundColor: "#ffffff", fontFamily: "Helvetica, Arial, sans-serif" }}>
      <Container style={{ maxWidth: "560px", padding: "24px 16px" }}>
        <Heading style={{ fontSize: "20px", color: "#0E1C28" }}>
          Ações com vencimento próximo
        </Heading>
        {copy ? (
          <Text style={text}>
            Cópia do alerta enviado ao representante <strong>{repName}</strong>.
          </Text>
        ) : (
          <Text style={text}>
            Olá{repName ? `, ${repName}` : ""}! As ações abaixo estão com o prazo se aproximando. Se
            precisar de mais tempo, você pode pedir uma prorrogação pelo portal.
          </Text>
        )}
        <Section style={{ backgroundColor: "#F4F7FA", borderRadius: "8px", padding: "12px 16px" }}>
          {items.slice(0, 20).map((a, i) => (
            <Text key={i} style={{ ...text, margin: "6px 0" }}>
              • {a.title}
              {a.client ? ` — ${a.client}` : ""} · prazo {a.prazo} ({when(a.days)})
            </Text>
          ))}
        </Section>
        {portalUrl && (
          <Section style={{ margin: "20px 0" }}>
            <Button
              href={portalUrl}
              style={{
                backgroundColor: "#062838",
                color: "#fff",
                padding: "12px 22px",
                borderRadius: "8px",
                textDecoration: "none",
                fontWeight: 600,
              }}
            >
              Abrir o portal
            </Button>
          </Section>
        )}
        <Text style={{ fontSize: "12px", color: "#5A6A76" }}>PoolFlux · Imersão Comercial</Text>
      </Container>
    </Body>
  </Html>
);

export const template = {
  component: Email,
  subject: (d: Record<string, unknown>) =>
    d?.copy
      ? `Cópia: ações de ${d.repName ?? "representante"} com vencimento próximo`
      : "Ações com vencimento próximo",
  displayName: "Alerta de vencimento de ações",
  previewData: {
    repName: "Matheus",
    items: [{ title: "Reestruturar exposição", client: "4LIGHT", prazo: "23/11/2026", days: 5 }],
    portalUrl: "https://poolflux.app/portal-rep",
  },
} satisfies TemplateEntry;

const text = { fontSize: "15px", lineHeight: "24px", color: "#0E1C28" };
