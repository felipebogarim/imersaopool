import { describe, expect, it } from "vitest";
import { firstAccessDestination } from "./first-access-redirect";

describe("destino após definir a senha", () => {
  it("leva diretamente às metas do cliente no portal", () => {
    expect(firstAccessDestination("/portal-rep/metas/cliente-123")).toBe(
      "/portal-rep/metas/cliente-123",
    );
  });

  it.each([
    "https://exemplo.com/roubo",
    "//exemplo.com/roubo",
    "/portal-rep-malicioso",
    "/portal-rep\\@exemplo.com",
  ])("bloqueia destino externo ou malformado: %s", (next) => {
    expect(firstAccessDestination(next)).toBe("/home");
  });
});
