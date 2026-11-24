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
        metasUrl="https://poolflux.app/portal-rep/metas/cliente"
        senhaUrl="https://poolflux.app/definir-senha?t=token-teste"
      />,
    );

    expect(html).toContain("Cadastrar ou redefinir minha senha");
    expect(html).toContain("https://poolflux.app/definir-senha?t=token-teste");
    expect(html).toContain("Abrir metas do cliente");
  });
});
