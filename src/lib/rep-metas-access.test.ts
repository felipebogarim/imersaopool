import { describe, expect, it } from "vitest";
import { buildRepMetasAccessUrl } from "./rep-metas-access";

describe("buildRepMetasAccessUrl", () => {
  it("leva conta existente ao login normal com o destino da revisão", () => {
    const link = new URL(
      buildRepMetasAccessUrl({
        appOrigin: "https://poolflux.app",
        email: "rep@teste.com",
        next: "/portal-rep/metas/cliente-1",
        firstAccessUrl: null,
      }),
    );

    expect(link.pathname).toBe("/auth");
    expect(link.searchParams.get("e")).toBe("rep@teste.com");
    expect(link.searchParams.get("conviteRep")).toBe("1");
    expect(link.searchParams.get("primeiro")).toBeNull();
    expect(link.searchParams.get("next")).toBe("/portal-rep/metas/cliente-1");
  });

  it("mantém cadastro de senha somente no primeiro acesso", () => {
    const link = new URL(
      buildRepMetasAccessUrl({
        appOrigin: "https://poolflux.app",
        email: "rep@teste.com",
        next: "/portal-rep/metas/cliente-1",
        firstAccessUrl: "https://poolflux.app/definir-senha?t=token",
      }),
    );

    expect(link.pathname).toBe("/definir-senha");
    expect(link.searchParams.get("t")).toBe("token");
    expect(link.searchParams.get("next")).toBe("/portal-rep/metas/cliente-1");
    expect(link.searchParams.get("conviteRep")).toBeNull();
  });
});
