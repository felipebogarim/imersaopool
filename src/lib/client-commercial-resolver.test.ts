import { describe, it, expect, vi } from "vitest";
import { resolveClientCommercialData } from "./client-commercial-resolver";

describe("client-commercial-resolver", () => {
  it("considera o relatório mais recente (Janeiro a Agosto / Black) sobre o cadastro anterior (Gold)", async () => {
    // Mock do cliente que tinha "Gold" no cadastro
    const mockClient = {
      id: "client-top-light",
      razao_social: "TOP LIGHT COMERCIO DE LUSTRES LTDA",
      nome_fantasia: "Top Light",
      categoria: "Gold", // Legado no cadastro
      representative_id: "rep-anselmo",
    };

    // Mock das versões de performance do representante
    const mockUploads = [
      {
        id: "v-jul",
        representative_id: "rep-anselmo",
        periodo_label: "Janeiro a Julho 2026",
        periodo_fim: "2026-07-31",
        created_at: "2026-09-14T12:00:00Z",
        familias: ["DECOR NEWLINE", "FITAS E FONTES"],
      },
      {
        id: "v-sem1",
        representative_id: "rep-anselmo",
        periodo_label: "1º Semestre 2026",
        periodo_fim: "2026-06-30",
        created_at: "2026-09-13T12:00:00Z",
        familias: ["DECOR NEWLINE", "FITAS E FONTES"],
      },
      {
        id: "v-ago",
        representative_id: "rep-anselmo",
        periodo_label: "Janeiro a Agosto 2026",
        periodo_fim: "2026-08-31",
        created_at: "2026-09-08T12:00:00Z",
        familias: ["DECOR NEWLINE", "FITAS E FONTES"],
      },
    ];

    // Mock das linhas da versão mais recente (v-ago)
    const mockRowsAgo = [
      {
        id: "row-top-light-ago",
        upload_id: "v-ago",
        razao_social: "TOP LIGHT COMERCIO DE LUSTRES LTDA",
        categoria: "Black", // No período mais recente virou Black!
        ordem: 1,
        total_pct: 0.45,
        total_pct_status: "critico",
        familia_pct: {
          "DECOR NEWLINE": 0.40,
          "FITAS E FONTES": 1.20,
        },
        metas_status: {
          "DECOR NEWLINE": "critico",
          "FITAS E FONTES": "superado",
        },
      },
    ];

    const mockUpdate = vi.fn().mockReturnValue(Promise.resolve({ error: null }));

    const mockSupabase: any = {
      from: (table: string) => {
        if (table === "clients") {
          return {
            select: () => ({
              eq: () => ({
                single: async () => ({ data: mockClient, error: null }),
              }),
            }),
            update: (...args: any[]) => ({
              eq: (...eqArgs: any[]) => mockUpdate(...args, ...eqArgs),
            }),
          };
        }
        if (table === "rep_performance_uploads") {
          return {
            select: () => ({
              eq: () => ({
                is: () => ({
                  order: () => ({
                    order: async () => ({ data: mockUploads, error: null }),
                  }),
                }),
              }),
            }),
          };
        }
        if (table === "rep_performance_rows") {
          return {
            select: () => ({
              eq: async (col: string, val: string) => {
                if (val === "v-ago") return { data: mockRowsAgo, error: null };
                return { data: [], error: null };
              },
            }),
          };
        }
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                is: () => ({
                  order: () => ({
                    limit: () => ({
                      maybeSingle: async () => ({ data: null, error: null }),
                    }),
                  }),
                }),
              }),
            }),
          }),
        };
      },
    };

    const result = await resolveClientCommercialData("client-top-light", {
      customSupabase: mockSupabase,
    });

    expect(result.status).toBe("linked");
    if (result.status === "linked") {
      // Regra estrutural chave: Categoria e Período do relatório mais recente prevalecem
      expect(result.categoria).toBe("Black");
      expect(result.periodoLabel).toBe("Janeiro a Agosto 2026");
      expect(result.source).toBe("performance_bi");
      expect(result.versionId).toBe("v-ago");
      expect(result.geralPct).toBe(45);
      expect(result.familias.length).toBeGreaterThan(0);
    }
  });

  it("retorna not_found se o cliente não existir", async () => {
    const mockSupabase: any = {
      from: () => ({
        select: () => ({
          eq: () => ({
            single: async () => ({ data: null, error: null }),
          }),
        }),
      }),
    };

    const result = await resolveClientCommercialData("nao-existe", {
      customSupabase: mockSupabase,
    });

    expect(result.status).toBe("not_found");
  });
});
