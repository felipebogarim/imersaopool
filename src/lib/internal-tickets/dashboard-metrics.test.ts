import { describe, expect, it } from "vitest";
import {
  computeAvgFirstResponseMinutes,
  computeAvgResolutionMinutes,
  computeCreatedPerWeek,
  computeCriticalTickets,
  computeKpis,
  computeSlowestSectors,
  computeVolume,
  hasNoFirstResponse,
  isTicketDueSoon,
  isTicketOverdue,
  type DashboardTicket,
} from "./dashboard-metrics";

const NOW = new Date("2026-09-23T12:00:00Z");

function ticket(overrides: Partial<DashboardTicket>): DashboardTicket {
  return {
    id: "t1",
    status: "em_analise",
    priority: "normal",
    sectorId: "sector-1",
    categoryId: "category-1",
    requesterUserId: "user-1",
    commercialOwnerUserId: "user-1",
    createdAt: new Date("2026-09-20T12:00:00Z"),
    slaFirstResponseDueAt: null,
    slaResolutionDueAt: null,
    firstResponseAt: null,
    resolvedAt: null,
    ...overrides,
  };
}

describe("isTicketOverdue", () => {
  it("atrasado quando o prazo de 1ª resposta passou e ainda não respondeu", () => {
    const t = ticket({ slaFirstResponseDueAt: new Date("2026-09-23T11:00:00Z") });
    expect(isTicketOverdue(t, NOW)).toBe(true);
  });

  it("não atrasado quando já respondeu, mesmo com prazo de resolução no passado mas já resolvido", () => {
    const t = ticket({
      slaFirstResponseDueAt: new Date("2026-09-21T00:00:00Z"),
      firstResponseAt: new Date("2026-09-20T13:00:00Z"),
      slaResolutionDueAt: new Date("2026-09-22T00:00:00Z"),
      resolvedAt: new Date("2026-09-21T00:00:00Z"),
    });
    expect(isTicketOverdue(t, NOW)).toBe(false);
  });

  it("cancelado nunca está atrasado", () => {
    const t = ticket({
      status: "cancelado",
      slaFirstResponseDueAt: new Date("2026-09-01T00:00:00Z"),
    });
    expect(isTicketOverdue(t, NOW)).toBe(false);
  });
});

describe("isTicketDueSoon", () => {
  it("true quando o prazo cai dentro da janela e ainda não venceu", () => {
    const t = ticket({ slaFirstResponseDueAt: new Date("2026-09-23T20:00:00Z") });
    expect(isTicketDueSoon(t, NOW)).toBe(true);
  });

  it("false quando já está atrasado (isso é overdue, não dueSoon)", () => {
    const t = ticket({ slaFirstResponseDueAt: new Date("2026-09-23T11:00:00Z") });
    expect(isTicketDueSoon(t, NOW)).toBe(false);
  });

  it("false quando o prazo é além da janela de 24h", () => {
    const t = ticket({ slaFirstResponseDueAt: new Date("2026-09-30T12:00:00Z") });
    expect(isTicketDueSoon(t, NOW)).toBe(false);
  });

  it("false para ticket concluído", () => {
    const t = ticket({
      status: "concluido",
      slaFirstResponseDueAt: new Date("2026-09-23T20:00:00Z"),
    });
    expect(isTicketDueSoon(t, NOW)).toBe(false);
  });
});

describe("hasNoFirstResponse", () => {
  it("true quando já foi enviado mas não tem firstResponseAt", () => {
    expect(hasNoFirstResponse(ticket({ status: "enviado" }))).toBe(true);
  });

  it("false para rascunho/aberto (ainda não foi enviado)", () => {
    expect(hasNoFirstResponse(ticket({ status: "rascunho" }))).toBe(false);
    expect(hasNoFirstResponse(ticket({ status: "aberto" }))).toBe(false);
  });

  it("false quando já tem firstResponseAt", () => {
    expect(hasNoFirstResponse(ticket({ status: "respondido", firstResponseAt: NOW }))).toBe(false);
  });
});

describe("computeKpis", () => {
  it("soma open/completed corretamente e ignora cancelado em ambos", () => {
    const tickets = [
      ticket({ status: "em_analise" }),
      ticket({ status: "concluido" }),
      ticket({ status: "cancelado" }),
    ];
    const kpis = computeKpis(tickets, NOW);
    expect(kpis.open).toBe(1);
    expect(kpis.completed).toBe(1);
  });
});

describe("médias de tempo", () => {
  it("calcula a média de minutos até a 1ª resposta, ignorando quem ainda não respondeu", () => {
    const tickets = [
      ticket({
        createdAt: new Date("2026-09-20T00:00:00Z"),
        firstResponseAt: new Date("2026-09-20T01:00:00Z"),
      }),
      ticket({
        createdAt: new Date("2026-09-20T00:00:00Z"),
        firstResponseAt: new Date("2026-09-20T03:00:00Z"),
      }),
      ticket({ createdAt: new Date("2026-09-20T00:00:00Z"), firstResponseAt: null }),
    ];
    expect(computeAvgFirstResponseMinutes(tickets)).toBe(120);
  });

  it("devolve null quando nenhum ticket tem resolvedAt", () => {
    expect(computeAvgResolutionMinutes([ticket({})])).toBeNull();
  });
});

describe("computeVolume", () => {
  it("agrupa e ordena por contagem decrescente", () => {
    const tickets = [
      ticket({ priority: "alta" }),
      ticket({ priority: "alta" }),
      ticket({ priority: "urgente" }),
    ];
    expect(computeVolume(tickets, (t) => t.priority)).toEqual([
      { key: "alta", count: 2 },
      { key: "urgente", count: 1 },
    ]);
  });
});

describe("computeSlowestSectors", () => {
  it("ordena setores pelo maior tempo médio de resolução", () => {
    const tickets = [
      ticket({
        sectorId: "rapido",
        createdAt: new Date("2026-09-20T00:00:00Z"),
        resolvedAt: new Date("2026-09-20T01:00:00Z"),
      }),
      ticket({
        sectorId: "lento",
        createdAt: new Date("2026-09-20T00:00:00Z"),
        resolvedAt: new Date("2026-09-22T00:00:00Z"),
      }),
    ];
    const result = computeSlowestSectors(tickets, 5);
    expect(result[0].sectorId).toBe("lento");
    expect(result[1].sectorId).toBe("rapido");
  });

  it("respeita o topN", () => {
    const tickets = [
      ticket({ sectorId: "a" }),
      ticket({ sectorId: "b" }),
      ticket({ sectorId: "c" }),
    ];
    expect(computeSlowestSectors(tickets, 2)).toHaveLength(2);
  });
});

describe("computeCreatedPerWeek", () => {
  it("gera buckets mesmo para semanas sem ticket (sem buracos)", () => {
    const buckets = computeCreatedPerWeek([], 4, NOW);
    expect(buckets).toHaveLength(4);
    expect(buckets.every((b) => b.count === 0)).toBe(true);
  });

  it("conta tickets na semana correta", () => {
    const tickets = [ticket({ createdAt: NOW }), ticket({ createdAt: NOW })];
    const buckets = computeCreatedPerWeek(tickets, 4, NOW);
    expect(buckets.at(-1)!.count).toBe(2);
  });
});

describe("computeCriticalTickets", () => {
  it("inclui urgentes e atrasados, exclui o resto", () => {
    const urgent = ticket({ id: "u", priority: "urgente" });
    const overdue = ticket({ id: "o", slaFirstResponseDueAt: new Date("2026-09-23T11:00:00Z") });
    const normal = ticket({ id: "n" });
    const result = computeCriticalTickets([urgent, overdue, normal], NOW);
    expect(result.map((t) => t.id).sort()).toEqual(["o", "u"]);
  });

  it("ordena por prazo mais próximo primeiro", () => {
    const soon = ticket({
      id: "soon",
      priority: "urgente",
      slaFirstResponseDueAt: new Date("2026-09-23T13:00:00Z"),
    });
    const later = ticket({
      id: "later",
      priority: "urgente",
      slaFirstResponseDueAt: new Date("2026-09-25T13:00:00Z"),
    });
    const result = computeCriticalTickets([later, soon], NOW);
    expect(result.map((t) => t.id)).toEqual(["soon", "later"]);
  });
});
