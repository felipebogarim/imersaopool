import { describe, expect, it } from "vitest";
import { buildImmersionSubject, immersionSubjectName, isPartnerImmersion } from "./immersion-subject";

describe("buildImmersionSubject", () => {
  it("parceiro especificador: client_id nulo e dados do parceiro preservados", () => {
    const s = buildImmersionSubject({
      perfil: "especificador",
      client_id: "should-be-ignored",
      partner_name: " Polo Escritório Light Designer ",
      partner_type: "light_designer",
      partner_description: "Escritório de iluminação",
    });
    expect(s).toMatchObject({
      subject_type: "partner",
      client_id: null,
      partner_name: "Polo Escritório Light Designer",
      partner_type: "light_designer",
      partner_description: "Escritório de iluminação",
    });
  });

  it("parceiro exige nome e tipo", () => {
    expect(() => buildImmersionSubject({ perfil: "especificador", partner_type: "arquiteto" })).toThrow(/nome/);
    expect(() => buildImmersionSubject({ perfil: "especificador", partner_name: "X" })).toThrow(/tipo/);
  });

  it("cliente exige client_id e não carrega dados de parceiro", () => {
    expect(() => buildImmersionSubject({ perfil: "cliente" })).toThrow(/cliente/);
    expect(buildImmersionSubject({ perfil: "cliente", client_id: "c1" })).toEqual({
      client_id: "c1",
    });
  });

  it("tipo outro guarda a descrição livre", () => {
    const s = buildImmersionSubject({ perfil: "outro", partner_name: "Eng. Silva", partner_type: "outro", partner_type_label: "Engenheiro" });
    expect(s.partner_type_label).toBe("Engenheiro");
  });
});

describe("immersionSubjectName", () => {
  it("usa o parceiro quando subject_type = partner e o cliente nos legados", () => {
    expect(immersionSubjectName({ subject_type: "partner", partner_name: "Polo" })).toBe("Polo");
    expect(immersionSubjectName({ client: { nome_fantasia: "ALL LED" } })).toBe("ALL LED");
    expect(isPartnerImmersion({ client_id: "x" })).toBe(false);
  });
});
