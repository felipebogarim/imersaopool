import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  getUser: vi.fn(),
  reps: vi.fn(),
  profiles: vi.fn(),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: mocks.from, auth: { getUser: mocks.getUser } },
}));
vi.mock("@/lib/kanban-reps", () => ({ fetchAllKanbanReps: mocks.reps }));
vi.mock("@/lib/kanban-profiles", () => ({ fetchProfilesMap: mocks.profiles }));
import { fetchDirectorBI, setDirectorBIVisibility } from "./director-bi-data";

function result(data: unknown, error: unknown = null) {
  const query: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const method of [
    "select",
    "eq",
    "or",
    "is",
    "contains",
    "order",
    "range",
    "update",
    "single",
    "maybeSingle",
  ])
    query[method] = vi.fn().mockReturnValue(query);
  query.then = vi.fn((resolve) => Promise.resolve({ data, error }).then(resolve));
  return query;
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getUser.mockResolvedValue({ data: { user: { id: "user" } }, error: null });
  mocks.reps.mockResolvedValue([{ id: "rep", nome: "Anderson", regiao: null }]);
  mocks.profiles.mockResolvedValue({ owner: { full_name: "Maria atualizada" } });
});

describe("persistência da seleção executiva", () => {
  it("atualiza somente metadados do mesmo registro e preserva dados atuais", async () => {
    const metadata = {
      responsible_id: "owner",
      rep_id: "rep",
      suggested_action: { status: "aprovada" },
    };
    const read = result({ metadata, updated_at: "version", kanban_boards: { name: "Comercial" } });
    const write = result({ id: "original" });
    mocks.from.mockReturnValueOnce(read).mockReturnValueOnce(write);
    await setDirectorBIVisibility("original", true);
    expect(mocks.from.mock.calls).toEqual([["kanban_cards"], ["kanban_cards"]]);
    expect(write.update).toHaveBeenCalledWith({
      metadata: { ...metadata, show_in_director_bi: true },
    });
    expect(write.eq.mock.calls).toEqual([
      ["id", "original"],
      ["updated_at", "version"],
    ]);
  });

  it("permite retirar uma seleção mesmo após mudança para um quadro diferente", async () => {
    mocks.from.mockReturnValueOnce(
      result({
        metadata: { show_in_director_bi: true },
        updated_at: "version",
        kanban_boards: { name: "Outro" },
      }),
    );
    const write = result({ id: "original" });
    mocks.from.mockReturnValueOnce(write);
    await setDirectorBIVisibility("original", false);
    expect(write.update).toHaveBeenCalledWith({ metadata: { show_in_director_bi: false } });
  });

  it("não anuncia sucesso em conflito de edição ou bloqueio de RLS", async () => {
    mocks.from
      .mockReturnValueOnce(
        result({ metadata: {}, updated_at: "version", kanban_boards: { name: "Comercial" } }),
      )
      .mockReturnValueOnce(result(null));
    await expect(setDirectorBIVisibility("original", true)).rejects.toThrow(
      "Atualize e tente novamente",
    );
  });

  it("propaga falha de persistência", async () => {
    mocks.from
      .mockReturnValueOnce(
        result({ metadata: {}, updated_at: "version", kanban_boards: { name: "Comercial" } }),
      )
      .mockReturnValueOnce(result(null, new Error("Sem permissão")));
    await expect(setDirectorBIVisibility("original", true)).rejects.toThrow("Sem permissão");
  });
});

describe("leitura da fonte de verdade", () => {
  it("exibe cards marcados de workspaces sem empresa sem incluir outra empresa", async () => {
    // O formulário de criação de workspace não preenche company_id.
    // Estas linhas representam somente registros já autorizados pelo RLS.
    const fixtures = ["company", null, "other-company"].map((companyId, index) => ({
      id: String(index),
      metadata: { show_in_director_bi: true },
      kanban_boards: { name: "Comercial", kanban_workspaces: { company_id: companyId } },
      kanban_lists: { name: "A Fazer" },
      kanban_checklists: [],
    }));
    const cards = result([]);
    cards.then.mockImplementation((resolve) => {
      const equality = cards.eq.mock.calls.find(
        ([column]) => column === "kanban_boards.kanban_workspaces.company_id",
      );
      const alternative = cards.or.mock.calls.find(
        ([, options]) => options?.referencedTable === "kanban_boards.kanban_workspaces",
      );
      const data = fixtures.filter((card) => {
        const companyId = card.kanban_boards.kanban_workspaces.company_id;
        if (equality) return companyId === equality[1];
        if (alternative?.[0] === "company_id.eq.company,company_id.is.null")
          return companyId === "company" || companyId === null;
        return true;
      });
      return Promise.resolve({ data, error: null }).then(resolve);
    });
    mocks.from
      .mockReturnValueOnce(result({ active_company_id: "company" }))
      .mockReturnValueOnce(cards);
    const data = await fetchDirectorBI();
    expect(data.actions.map((card) => card.id)).toEqual(["0", "1"]);
  });

  it("pagina as ações selecionadas sem truncar o quadro executivo", async () => {
    const card = {
      metadata: {},
      kanban_boards: { name: "Produto" },
      kanban_lists: { name: "A Fazer" },
      kanban_checklists: [],
    };
    const first = result(Array.from({ length: 500 }, (_, id) => ({ ...card, id: String(id) })));
    const second = result([{ ...card, id: "500" }]);
    mocks.from
      .mockReturnValueOnce(result({ active_company_id: "company" }))
      .mockReturnValueOnce(first)
      .mockReturnValueOnce(second);
    const data = await fetchDirectorBI();
    expect(first.range).toHaveBeenCalledWith(0, 499);
    expect(second.range).toHaveBeenCalledWith(500, 999);
    expect(data.actions).toHaveLength(501);
    expect(new Set(data.actions.map((action) => action.id)).size).toBe(501);
  });

  it("filtra empresa ativa ou workspace sem empresa, seleção e arquivo; lê os dados atuais", async () => {
    const scope = result({ active_company_id: "company" });
    const cards = result([
      {
        id: "original",
        metadata: {
          show_in_director_bi: true,
          responsible_id: "owner",
          responsible_name: "Nome antigo",
          rep_id: "rep",
        },
        kanban_boards: { name: "Comercial" },
        kanban_lists: { name: "Em Andamento" },
        kanban_checklists: [{ kanban_checklist_items: [{ done: true }, { done: false }] }],
      },
    ]);
    mocks.from.mockReturnValueOnce(scope).mockReturnValueOnce(cards);
    const data = await fetchDirectorBI();
    expect(cards.contains).toHaveBeenCalledWith("metadata", { show_in_director_bi: true });
    expect(cards.or).toHaveBeenCalledWith("company_id.eq.company,company_id.is.null", {
      referencedTable: "kanban_boards.kanban_workspaces",
    });
    expect(cards.is.mock.calls).toContainEqual(["archived_at", null]);
    expect(cards.is.mock.calls).toContainEqual(["kanban_boards.archived_at", null]);
    expect(data.actions[0]).toMatchObject({
      id: "original",
      responsible: "Maria atualizada",
      representative: "Anderson",
      stage: "Em Andamento",
      checklistDone: 1,
      checklistTotal: 2,
    });
  });

  it("não consulta ações quando falta empresa ativa", async () => {
    mocks.from.mockReturnValueOnce(result({ active_company_id: null }));
    await expect(fetchDirectorBI()).rejects.toThrow("Selecione uma empresa");
    expect(mocks.from).toHaveBeenCalledTimes(1);
  });

  it("distingue erro de consulta de uma lista executiva vazia", async () => {
    mocks.from
      .mockReturnValueOnce(result({ active_company_id: "company" }))
      .mockReturnValueOnce(result(null, new Error("Falha de conexão")));
    await expect(fetchDirectorBI()).rejects.toThrow("Falha de conexão");
  });
});
