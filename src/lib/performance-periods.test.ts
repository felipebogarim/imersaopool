import { describe, it, expect } from "vitest";
import {
  parsePeriodEndDate,
  comparePerformanceVersions,
  sortPerformanceVersions,
  getLatestPerformanceVersion,
  getLatestActiveVersionByRep,
} from "./performance-periods";

describe("performance-periods helper", () => {
  it("determina corretamente as datas de término para diferentes rótulos de período", () => {
    expect(parsePeriodEndDate(null, "Janeiro a Agosto 2026")).toBe("2026-08-31");
    expect(parsePeriodEndDate(null, "Janeiro a Julho 2026")).toBe("2026-07-31");
    expect(parsePeriodEndDate(null, "1º Semestre 2026")).toBe("2026-06-30");
    expect(parsePeriodEndDate(null, "2º Semestre 2026")).toBe("2026-12-31");
    expect(parsePeriodEndDate(null, "Anual 2026")).toBe("2026-12-31");
  });

  it("prioriza periodo_fim explícito quando disponível", () => {
    expect(parsePeriodEndDate("2026-08-31", "1º Semestre 2026")).toBe("2026-08-31");
  });

  it("ordena o período mais recente (Janeiro a Agosto) antes de uploads mais antigos criados depois", () => {
    const versions = [
      {
        id: "v-jul",
        periodo_label: "Janeiro a Julho 2026",
        periodo_fim: "2026-07-31",
        created_at: "2026-09-14T12:00:00Z", // upload mais novo no tempo
      },
      {
        id: "v-sem1",
        periodo_label: "1º Semestre 2026",
        periodo_fim: "2026-06-30",
        created_at: "2026-09-13T12:00:00Z",
      },
      {
        id: "v-ago",
        periodo_label: "Janeiro a Agosto 2026",
        periodo_fim: "2026-08-31",
        created_at: "2026-09-08T12:00:00Z", // upload com data anterior, MAS período mais avançado!
      },
    ];

    const sorted = sortPerformanceVersions(versions);
    expect(sorted.map((v) => v.id)).toEqual(["v-ago", "v-jul", "v-sem1"]);

    const latest = getLatestPerformanceVersion(versions);
    expect(latest?.id).toBe("v-ago");
    expect(latest?.periodo_label).toBe("Janeiro a Agosto 2026");
  });

  it("desempata por created_at quando o período de apuração for idêntico", () => {
    const versions = [
      {
        id: "v-ago-antigo",
        periodo_label: "Janeiro a Agosto 2026",
        periodo_fim: "2026-08-31",
        created_at: "2026-09-01T10:00:00Z",
      },
      {
        id: "v-ago-revisado",
        periodo_label: "Janeiro a Agosto 2026",
        periodo_fim: "2026-08-31",
        created_at: "2026-09-08T18:00:00Z",
      },
    ];

    const sorted = sortPerformanceVersions(versions);
    expect(sorted[0].id).toBe("v-ago-revisado");
  });

  it("agrupa e retorna a versão mais recente para cada representante", () => {
    const versions = [
      {
        id: "anselmo-jul",
        representative_id: "rep-anselmo",
        periodo_label: "Janeiro a Julho 2026",
        periodo_fim: "2026-07-31",
        created_at: "2026-09-14T12:00:00Z",
      },
      {
        id: "anselmo-ago",
        representative_id: "rep-anselmo",
        periodo_label: "Janeiro a Agosto 2026",
        periodo_fim: "2026-08-31",
        created_at: "2026-09-08T12:00:00Z",
      },
      {
        id: "outro-sem1",
        representative_id: "rep-outro",
        periodo_label: "1º Semestre 2026",
        periodo_fim: "2026-06-30",
        created_at: "2026-09-10T12:00:00Z",
      },
    ];

    const byRep = getLatestActiveVersionByRep(versions);
    expect(byRep.get("rep-anselmo")?.id).toBe("anselmo-ago");
    expect(byRep.get("rep-outro")?.id).toBe("outro-sem1");
  });
});
