import { describe, expect, it } from "vitest";
import { buildExecutiveEmailSubject } from "./email-subject";

describe("buildExecutiveEmailSubject", () => {
  it("monta Imersão [região], Rep: [representante]", () => {
    expect(buildExecutiveEmailSubject("PR / SC", "NOVARE")).toBe("Imersão PR / SC, Rep: NOVARE");
  });
  it("omite o que falta e usa o fallback sem nada", () => {
    expect(buildExecutiveEmailSubject("", "NOVARE")).toBe("Imersão, Rep: NOVARE");
    expect(buildExecutiveEmailSubject("Curitiba", " ")).toBe("Imersão Curitiba");
    expect(buildExecutiveEmailSubject(null, null, "X")).toBe("X");
  });
});
