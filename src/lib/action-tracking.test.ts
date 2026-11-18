import { describe, expect, it } from "vitest";
import {
  hasUpdateContent,
  isOverdue,
  readActionMeta,
  sanitizeFileName,
  statusOrDefault,
} from "./action-tracking";

describe("action-tracking", () => {
  it("status ausente ou inválido vira nao_iniciado", () => {
    expect(statusOrDefault(undefined)).toBe("nao_iniciado");
    expect(statusOrDefault("x")).toBe("nao_iniciado");
    expect(statusOrDefault("concluido")).toBe("concluido");
  });

  it("lê vínculos do metadata do card", () => {
    const m = readActionMeta({ rep_id: "r1", rep_name: "Matheus", client_id: 3 });
    expect(m.rep_id).toBe("r1");
    expect(m.client_id).toBeUndefined();
  });

  it("só considera atualização com conteúdo real", () => {
    expect(hasUpdateContent({ cardId: "c", status: "em_andamento" }, "em_andamento")).toBe(false);
    expect(hasUpdateContent({ cardId: "c", status: "concluido" }, "em_andamento")).toBe(true);
    expect(hasUpdateContent({ cardId: "c", note: "  " }, "nao_iniciado")).toBe(false);
    expect(hasUpdateContent({ cardId: "c", note: "feito" }, "nao_iniciado")).toBe(true);
    expect(
      hasUpdateContent(
        { cardId: "c", pendencias: [{ description: "aprovar", assigneeName: "Ana" }] },
        "nao_iniciado",
      ),
    ).toBe(true);
  });

  it("atraso ignora ações concluídas", () => {
    const now = new Date("2026-10-30T12:00:00Z");
    expect(isOverdue("2026-10-01", "em_andamento", now)).toBe(true);
    expect(isOverdue("2026-10-01", "concluido", now)).toBe(false);
    expect(isOverdue(null, "nao_iniciado", now)).toBe(false);
  });

  it("sanitiza nome de arquivo", () => {
    expect(sanitizeFileName("foto obra #1.jpg")).toBe("foto_obra_1.jpg");
  });
});

import { boardColumnFor, daysUntil } from "./action-tracking";

describe("Kanban Ações Reps", () => {
  it("posiciona a ação conforme aceite e status", () => {
    expect(boardColumnFor("nao_iniciado", "nao_enviada")).toBe("sugerida");
    expect(boardColumnFor("nao_iniciado", "enviada")).toBe("aguardando");
    expect(boardColumnFor("nao_iniciado", "aceita")).toBe("aceita");
    expect(boardColumnFor("em_andamento", "aceita")).toBe("andamento");
    expect(boardColumnFor("concluido", "aceita")).toBe("concluida");
    expect(boardColumnFor("em_andamento", "recusada")).toBe("recusada");
  });

  it("calcula dias até o prazo", () => {
    const now = new Date(2026, 10, 19, 9);
    expect(daysUntil("2026-11-24", now)).toBe(5);
    expect(daysUntil("2026-11-18", now)).toBe(-1);
    expect(daysUntil(null, now)).toBeNull();
  });
});
