import { describe, expect, it } from "vitest";
import { partnerKindLabel, readPartner } from "./visao-imersao-2-partner";

describe("readPartner", () => {
  it("retorna null para relatório de cliente", () => {
    expect(readPartner({ data: {} })).toBeNull();
    expect(readPartner(null)).toBeNull();
    expect(readPartner({ partner: { kind: "invalido" } })).toBeNull();
  });

  it("lê parceiro sem campos obrigatórios além do tipo", () => {
    expect(readPartner({ partner: { kind: "arquiteto", city: " " } })).toEqual({
      kind: "arquiteto",
      kind_label: undefined,
      contact_name: undefined,
      city: undefined,
      phone: undefined,
      email: undefined,
      notes: undefined,
    });
  });

  it("usa a descrição livre quando o tipo é outro", () => {
    expect(partnerKindLabel({ kind: "outro", kind_label: "Engenheiro" })).toBe("Engenheiro");
    expect(partnerKindLabel({ kind: "light_designer" })).toBe("Light designer");
  });
});
