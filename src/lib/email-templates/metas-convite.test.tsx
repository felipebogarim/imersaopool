import React from "react";
import { render } from "@react-email/render";
import { describe, expect, it } from "vitest";
import { MetasConviteEmail } from "./metas-convite";

describe("convite para revisão de metas", () => {
  it("prioriza o cadastro ou a redefinição de senha antes do link das metas", async () => {
    const html = await render(
      <MetasConviteEmail
        name="Representante Teste"
        cliente="Cliente Teste"
        senhaUrl="https://poolflux.app/definir-senha?t=token-teste&next=%2Fportal-rep%2Fmetas%2Fcliente"
      />,
    );

    expect(html).toContain("Cadastrar ou redefinir senha e avaliar metas");
    expect(html).toContain("https://poolflux.app/definir-senha?t=token-teste");
    expect(html).not.toContain("Abrir metas do cliente");
    expect(html.match(/<a\b/g)).toHaveLength(1);
  });
});
