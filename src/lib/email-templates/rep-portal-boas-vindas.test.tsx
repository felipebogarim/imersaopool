import React from "react";
import { render } from "@react-email/render";
import { describe, expect, it } from "vitest";
import { RepPortalBoasVindasEmail } from "./rep-portal-boas-vindas";

describe("acesso ao portal do representante", () => {
  it("preserva a senha existente e leva ao login normal", async () => {
    const html = await render(
      <RepPortalBoasVindasEmail
        name="Representante Teste"
        accessUrl="https://poolflux.app/auth?conviteRep=1&e=rep%40teste.com&next=%2Fportal-rep"
      />,
    );

    expect(html).toContain("Entrar no portal");
    expect(html).toContain("senha já cadastrada");
    expect(html).toContain("não será alterada");
    expect(html).not.toContain("Cadastrar minha senha");
  });

  it("mantém o cadastro de senha para o primeiro acesso", async () => {
    const html = await render(
      <RepPortalBoasVindasEmail
        accessUrl="https://poolflux.app/definir-senha?t=token"
        primeiroAcesso
      />,
    );

    expect(html).toContain("Cadastrar minha senha");
    expect(html).toContain("vale por 14 dias");
  });
});
