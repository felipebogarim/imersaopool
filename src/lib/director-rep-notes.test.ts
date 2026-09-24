import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  getUser: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: mocks.from, auth: { getUser: mocks.getUser } },
}));

import {
  clearDirectorRepNote,
  fetchDirectorRepNotes,
  saveDirectorRepNote,
} from "./director-rep-notes";

function result(data: unknown, error: unknown = null) {
  const query: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const method of ["select", "eq", "single", "upsert"])
    query[method] = vi.fn().mockReturnValue(query);
  query.then = vi.fn((resolve) => Promise.resolve({ data, error }).then(resolve));
  return query;
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getUser.mockResolvedValue({ data: { user: { id: "master" } }, error: null });
});

describe("acompanhamento de representantes do BI Diretor", () => {
  it("lê somente as notas da empresa ativa", async () => {
    const profile = result({ active_company_id: "company" });
    const notes = result([
      {
        representative_id: "rep",
        company_id: "company",
        last_immersion: "2026-09-24",
        general_perception: "Boa",
        perceived_opportunities: null,
        notes: null,
        updated_at: "2026-09-24T12:00:00Z",
      },
    ]);
    mocks.from.mockReturnValueOnce(profile).mockReturnValueOnce(notes);

    const data = await fetchDirectorRepNotes();

    expect(mocks.from.mock.calls).toEqual([["profiles"], ["director_rep_notes"]]);
    expect(notes.eq).toHaveBeenCalledWith("company_id", "company");
    expect(data).toMatchObject({ schemaAvailable: true, notes: [{ representative_id: "rep" }] });
  });

  it("faz upsert por representante com empresa e autor derivados da sessão", async () => {
    const profile = result({ active_company_id: "company" });
    const write = result(null);
    mocks.from.mockReturnValueOnce(profile).mockReturnValueOnce(write);

    await saveDirectorRepNote({
      representative_id: "rep",
      last_immersion: null,
      general_perception: "Percepção",
      perceived_opportunities: "Oportunidade",
      notes: "Nota",
    });

    expect(write.upsert).toHaveBeenCalledWith(
      {
        representative_id: "rep",
        last_immersion: null,
        general_perception: "Percepção",
        perceived_opportunities: "Oportunidade",
        notes: "Nota",
        company_id: "company",
        updated_by: "master",
      },
      { onConflict: "representative_id" },
    );
  });

  it("limpa todos os campos de acompanhamento sem excluir o representante", async () => {
    const profile = result({ active_company_id: "company" });
    const write = result(null);
    mocks.from.mockReturnValueOnce(profile).mockReturnValueOnce(write);

    await clearDirectorRepNote("rep");

    expect(write.upsert).toHaveBeenCalledWith(
      {
        representative_id: "rep",
        last_immersion: null,
        general_perception: null,
        perceived_opportunities: null,
        notes: null,
        company_id: "company",
        updated_by: "master",
      },
      { onConflict: "representative_id" },
    );
  });

  it("não consulta notas sem empresa ativa", async () => {
    mocks.from.mockReturnValueOnce(result({ active_company_id: null }));
    await expect(fetchDirectorRepNotes()).rejects.toThrow("Selecione uma empresa");
    expect(mocks.from).toHaveBeenCalledTimes(1);
  });

  it("mantém a lista disponível enquanto a migration ainda não foi aplicada", async () => {
    const profile = result({ active_company_id: "company" });
    const notes = result(null, {
      code: "PGRST205",
      message: "Could not find the table 'public.director_rep_notes' in the schema cache",
    });
    mocks.from.mockReturnValueOnce(profile).mockReturnValueOnce(notes);

    await expect(fetchDirectorRepNotes()).resolves.toEqual({
      notes: [],
      schemaAvailable: false,
    });
  });
});
