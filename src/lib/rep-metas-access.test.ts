import { describe, expect, it } from "vitest";
import { buildRepMetasAccessUrl, resolveRepInviteSession } from "./rep-metas-access";

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

describe("resolveRepInviteSession", () => {
  it("abre o cliente diretamente quando a sessão já é do destinatário", () => {
    expect(resolveRepInviteSession(" REP@teste.com ", "rep@TESTE.com")).toBe("open_destination");
  });

  it("mostra o login quando não existe sessão", () => {
    expect(resolveRepInviteSession(null, "rep@teste.com")).toBe("show_login");
  });

  it("exige troca de conta quando a sessão pertence a outra pessoa", () => {
    expect(resolveRepInviteSession("gestor@teste.com", "rep@teste.com")).toBe("switch_account");
  });

  it("não reaproveita sessão quando o destinatário foi removido do link", () => {
    expect(resolveRepInviteSession("rep@teste.com", null)).toBe("switch_account");
  });
});
