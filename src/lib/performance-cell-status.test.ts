import { describe, expect, it } from "vitest";
import { resolveCellStatus, conflictMessage } from "./performance-cell-status";
import { FAROL_HEX } from "./performance-farol";

const hex = (s: keyof typeof FAROL_HEX) => FAROL_HEX[s].replace("#", "");

describe("resolveCellStatus", () => {
  it("aceita texto e cor equivalentes", () => {
    expect(resolveCellStatus("90-100", hex("otimo"))).toEqual({ ok: true, status: "otimo" });
    expect(resolveCellStatus(">100", hex("excelente"))).toEqual({ ok: true, status: "excelente" });
  });

  it("bloqueia divergência entre faixa textual e cor", () => {
    const res = resolveCellStatus("90-100", hex("abaixo_meta"));
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.conflito.motivo).toBe("divergencia");
      expect(res.conflito.status_texto).toBe("otimo");
      expect(res.conflito.status_cor).toBe("abaixo_meta");
      const msg = conflictMessage({ ...res.conflito, linha: 12, razao_social: "X LTDA", familia: "PERFIL" });
      expect(msg).toContain("Importação interrompida");
      expect(msg).toContain("X LTDA");
      expect(msg).toContain("PERFIL");
      expect(msg).toContain("90-100");
    }
  });

  it("aceita 0% sem cor (compatibilidade retroativa)", () => {
    expect(resolveCellStatus("0%", null)).toEqual({ ok: true, status: "sem_compra" });
  });

  it("bloqueia faixa positiva sem cor", () => {
    const res = resolveCellStatus("70-89", null);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.conflito.motivo).toBe("cor_ausente");
  });

  it("usa a cor quando não há faixa textual (arquivo legado)", () => {
    expect(resolveCellStatus(null, hex("proximo"))).toEqual({ ok: true, status: "proximo" });
  });

  it("célula vazia não gera status nem conflito", () => {
    expect(resolveCellStatus(null, null)).toEqual({ ok: true, status: null });
  });
});
