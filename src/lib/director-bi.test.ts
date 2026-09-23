import { describe, expect, it } from "vitest";
import {
  directorArea,
  dueState,
  filterDirectorActions,
  isDirectorComplete,
  shortDescription,
  type DirectorAction,
} from "./director-bi";

function action(id: string, overrides: Partial<DirectorAction> = {}): DirectorAction {
  return {
    id,
    title: id,
    board_id: "board",
    list_id: "list",
    description: null,
    position: 0,
    priority: "media",
    due_date: null,
    start_date: null,
    completed_at: null,
    cover_color: null,
    cover_image: null,
    archived_at: null,
    created_by: "user",
    origin_action_plan_id: null,
    metadata: { show_in_director_bi: true, rep_id: "anderson" },
    created_at: "2026-09-01T00:00:00Z",
    updated_at: "2026-09-01T00:00:00Z",
    area: "commercial",
    stage: "A Fazer",
    responsible: "João",
    representative: "Anderson",
    checklistDone: 0,
    checklistTotal: 0,
    ...overrides,
  };
}

describe("visão executiva das ações originais", () => {
  it("combina seleção, categoria, representante e andamento sem alterar a origem", () => {
    const cards = [
      action("selecionada"),
      action("concluida", { completed_at: "2026-09-22T00:00:00Z" }),
      action("fora-bi", { metadata: {} }),
      action("marketing", { area: "marketing" }),
      action("outro-rep", { metadata: { show_in_director_bi: true, rep_id: "salton" } }),
      action("arquivada", { archived_at: "2026-09-22T00:00:00Z" }),
    ];
    const original = structuredClone(cards);
    const result = filterDirectorActions(cards, "commercial", "active", "anderson");
    expect(result.map((card) => card.id)).toEqual(["selecionada"]);
    expect(result[0]).toBe(cards[0]);
    expect(cards).toEqual(original);
    expect(filterDirectorActions(cards, "commercial", "active")).toHaveLength(2);
    expect(filterDirectorActions(cards, "marketing", "active", "outro")).toHaveLength(1);
  });

  it("acompanha alterações de responsável, prazo, título, categoria e conclusão no mesmo objeto", () => {
    const card = action("original");
    card.responsible = "Maria";
    card.title = "Revisão comercial";
    card.due_date = "2026-10-01";
    expect(filterDirectorActions([card], "commercial", "active")[0]).toMatchObject({
      id: "original",
      responsible: "Maria",
      title: "Revisão comercial",
      due_date: "2026-10-01",
    });
    card.completed_at = "2026-09-23T14:00:00Z";
    expect(filterDirectorActions([card], "commercial", "active")).toEqual([]);
    expect(filterDirectorActions([card], "commercial", "completed")).toEqual([card]);
    card.area = "product";
    expect(filterDirectorActions([card], "commercial", "all")).toEqual([]);
    expect(filterDirectorActions([card], "product", "all")).toEqual([card]);
    card.metadata.show_in_director_bi = false;
    expect(filterDirectorActions([card], "product", "all")).toEqual([]);
  });

  it("reconhece conclusão pela lista original ou pela data, mas não inventa status", () => {
    expect(isDirectorComplete(action("a", { stage: "Concluído" }))).toBe(true);
    expect(isDirectorComplete(action("a", { stage: "Concluída" }))).toBe(true);
    expect(isDirectorComplete(action("a", { stage: "Aguardando" }))).toBe(false);
    expect(
      filterDirectorActions([action("a", { stage: "Concluído" })], "commercial", "active"),
    ).toEqual([]);
  });

  it("ordena vencidas, próximos prazos, sem prazo e concluídas; usa prioridade no desempate", () => {
    const cards = [
      action("sem-prazo"),
      action("amanha", { due_date: "2026-09-24" }),
      action("vencida", { due_date: "2026-09-01" }),
      action("urgente", { due_date: "2026-09-24", priority: "urgente" }),
      action("concluida-antiga", { completed_at: "2026-09-02" }),
      action("concluida-recente", { completed_at: "2026-09-22" }),
    ];
    expect(filterDirectorActions(cards, "commercial", "all").map((c) => c.id)).toEqual([
      "vencida",
      "urgente",
      "amanha",
      "sem-prazo",
      "concluida-recente",
      "concluida-antiga",
    ]);
  });

  it("usa updated_at apenas como fallback de ordenação quando a lista conclui sem data", () => {
    const cards = [
      action("antiga", { stage: "Concluído" }),
      action("recente", { stage: "Concluído", updated_at: "2026-09-23T12:00:00Z" }),
    ];
    expect(filterDirectorActions(cards, "commercial", "completed").map((c) => c.id)).toEqual([
      "recente",
      "antiga",
    ]);
  });

  it("não considera o prazo de hoje atrasado e não sinaliza concluídas", () => {
    const now = new Date(2026, 8, 23, 15, 30);
    expect(dueState("2026-09-23T00:00:00Z", false, now)).toBe("Vence hoje");
    expect(dueState("2026-09-22", false, now)).toBe("Atrasada");
    expect(dueState("2026-09-26", false, now)).toBe("Prazo próximo");
    expect(dueState("2026-09-27", false, now)).toBeNull();
    expect(dueState("2026-09-22", true, now)).toBeNull();
    expect(dueState(null, false, now)).toBeNull();
  });

  it("reutiliza buckets existentes e não classifica quadros desconhecidos por suposição", () => {
    expect(["Comercial", "Governança", "Marketing", "Produto"].map(directorArea)).toEqual([
      "commercial",
      "governance",
      "marketing",
      "product",
    ]);
    expect(directorArea("Diretoria")).toBe("governance");
    expect(directorArea("Planos de Ação")).toBe("commercial");
    expect(directorArea("Outro quadro")).toBeNull();
  });

  it("resume a descrição sem criar outro campo de manutenção", () => {
    expect(shortDescription(" Retomar\n contas  prioritárias ")).toBe(
      "Retomar contas prioritárias",
    );
    expect(shortDescription("a".repeat(300))).toHaveLength(148);
    expect(shortDescription(null)).toBe("");
  });
});
