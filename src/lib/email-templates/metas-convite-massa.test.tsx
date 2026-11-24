import React from "react";
import { render } from "@react-email/render";
import { describe, expect, it } from "vitest";
import { MetasConviteMassaEmail, template } from "./metas-convite-massa";

const clientes = [
  { nome: "CLIENTE TESTE 02", url: "https://poolflux.app/portal-rep/metas/r2" },
  { nome: "CLIENTE TESTE 03", url: "https://poolflux.app/portal-rep/metas/r3" },
];

describe("convite em massa para revisão de metas", () => {
  it("lista todos os clientes com link e prioriza a senha no primeiro acesso", async () => {
    const html = await render(
      <MetasConviteMassaEmail
        name="Representante Teste"
        clientes={clientes}
        senhaUrl="https://poolflux.app/definir-senha?t=tok&next=%2Fportal-rep"
        portalUrl="https://poolflux.app/portal-rep"
      />,
    );
    expect(html).toContain("Revisão de metas · 2 clientes");
    expect(html).toContain("https://poolflux.app/portal-rep/metas/r2");
    expect(html).toContain("https://poolflux.app/portal-rep/metas/r3");
    expect(html).toContain("Cadastrar senha e revisar metas");
    expect(html).not.toContain("Abrir portal e revisar metas");
  });

  it("sem primeiro acesso, o botão abre o portal; assunto com a quantidade", async () => {
    const html = await render(
      <MetasConviteMassaEmail clientes={clientes} portalUrl="https://poolflux.app/portal-rep" />,
    );
    expect(html).toContain("Abrir portal e revisar metas");
    expect(template.subject({ clientes: [clientes[0]] })).toBe("Revisão de metas · 1 cliente");
  });
});
