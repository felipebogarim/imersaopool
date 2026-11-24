import React from "react";
import { render } from "@react-email/render";
import { describe, expect, it } from "vitest";
import { MetasConviteEmail } from "./metas-convite";

describe("convite para revisão de metas", () => {
  it("leva uma conta existente ao login e depois às metas", async () => {
    const html = await render(
      <MetasConviteEmail
        name="Representante Teste"
        cliente="Cliente Teste"
        accessUrl="https://poolflux.app/auth?e=rep%40teste.com&next=%2Fportal-rep%2Fmetas%2Fcliente"
      />,
    );

    expect(html).toContain("Entrar e avaliar metas");
    expect(html).toContain("https://poolflux.app/auth?e=rep%40teste.com");
    expect(html).not.toContain("redefinir");
    expect(html.match(/<a\b/g)).toHaveLength(1);
  });

  it("pede cadastro de senha somente no primeiro acesso", async () => {
    const html = await render(
      <MetasConviteEmail accessUrl="https://poolflux.app/definir-senha?t=token" primeiroAcesso />,
    );
    expect(html).toContain("Cadastrar senha e avaliar metas");
    expect(html).not.toContain("redefinir");
  });
});
