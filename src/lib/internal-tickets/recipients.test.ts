import { describe, expect, it } from "vitest";
import { resolveSectorRecipients, type SectorPersonForRecipients } from "./recipients";

function person(overrides: Partial<SectorPersonForRecipients>): SectorPersonForRecipients {
  return {
    id: "p1",
    sector_id: "sector-1",
    name: "Fulano",
    role_title: null,
    email: "fulano@x.com",
    active: true,
    is_primary_recipient: false,
    is_cc: false,
    receives_new_tickets: true,
    ...overrides,
  };
}

describe("resolveSectorRecipients", () => {
  it("encontra o principal quando existe exatamente um", () => {
    const people = [person({ id: "p1", is_primary_recipient: true })];
    expect(resolveSectorRecipients(people, "sector-1").principal?.id).toBe("p1");
  });

  it("principal é null quando ninguém está marcado", () => {
    const people = [person({ id: "p1", is_cc: true })];
    expect(resolveSectorRecipients(people, "sector-1").principal).toBeNull();
  });

  it("ignora pessoa inativa mesmo marcada como principal", () => {
    const people = [person({ id: "p1", is_primary_recipient: true, active: false })];
    expect(resolveSectorRecipients(people, "sector-1").principal).toBeNull();
  });

  it("ignora pessoa com receives_new_tickets=false", () => {
    const people = [person({ id: "p1", is_primary_recipient: true, receives_new_tickets: false })];
    expect(resolveSectorRecipients(people, "sector-1").principal).toBeNull();
  });

  it("ignora pessoa de outro setor", () => {
    const people = [person({ id: "p1", sector_id: "sector-2", is_primary_recipient: true })];
    expect(resolveSectorRecipients(people, "sector-1").principal).toBeNull();
  });

  it("cc inclui quem tem is_cc, exceto quem já é principal", () => {
    const people = [
      person({ id: "principal", is_primary_recipient: true, is_cc: true }),
      person({ id: "copia-1", is_cc: true }),
      person({ id: "copia-2", is_cc: true }),
    ];
    const { cc } = resolveSectorRecipients(people, "sector-1");
    expect(cc.map((p) => p.id)).toEqual(["copia-1", "copia-2"]);
  });

  it("escalonamento sozinho (sem principal/cc) não aparece em nenhuma lista", () => {
    const people = [person({ id: "p1", is_primary_recipient: false, is_cc: false })];
    const result = resolveSectorRecipients(people, "sector-1");
    expect(result.principal).toBeNull();
    expect(result.cc).toEqual([]);
  });
});
