import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { parseWorkbook } from "./performance-parser";

const FABIO = "/mnt/user-uploads/file-15"; // DESEMPENHO_FABIO_BRISTOTTI_1_SEMESTRE_26_IMPORTACAO_FINAL_CORRIGIDA.xlsx
const SALTON = "/mnt/user-uploads/DESEMPENHO_SALTON_1_SEMESTRE_26_AJUSTADO.xlsx";

const load = (p: string) => {
  const b = readFileSync(p);
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
};

const maybe = (p: string) => (existsSync(p) ? describe : describe.skip);

maybe(FABIO)("integração — arquivo real Fabio Bristotti", () => {
  it("importa sem conflitos com todas as contagens esperadas", async () => {
    const r = await parseWorkbook(load(FABIO));
    expect(r.rows).toHaveLength(30);
    expect(r.familias).toHaveLength(7);
    expect(r.stats.celulas_total_pct).toBe(30);
    expect(r.stats.celulas_familias).toBe(210);
    expect(r.stats.celulas_avaliadas).toBe(240);
    expect(r.stats.estilos_carregados).toBe(240);
    expect(r.stats.cores_extraidas).toBe(240);
    expect(r.stats.estilos_ausentes).toBe(0);
    expect(r.stats.cores_ausentes).toBe(0);
    expect(r.stats.cores_desconhecidas).toBe(0);
    expect(r.stats.divergencias_texto_cor).toBe(0);
    expect(r.conflitos).toHaveLength(0);
    expect(r.stats.cores_distintas).toHaveLength(6);
    expect(r.stats.por_status).toEqual({
      sem_compra: 38,
      abaixo_meta: 77,
      pode_melhorar: 27,
      proximo: 26,
      otimo: 10,
      excelente: 62,
    });
    // E2 — LED LUZ LTDA / DECOR NEWLINE / ">100" / 9FC7E8
    const led = r.rows.find((x) => x.razao_social.toUpperCase().includes("LED LUZ"))!;
    expect(led.metas_cores["DECOR NEWLINE"]).toBe("9FC7E8");
    expect(led.metas_status["DECOR NEWLINE"]).toBe("excelente");
    // Matriz financeira
    expect(r.matriz_erros).toEqual([]);
    expect(Object.keys(r.matriz?.matriz ?? {}).sort()).toEqual(["Black", "Gold", "Silver"]);
  });
});

maybe(SALTON)("regressão — arquivo antigo Salton", () => {
  it("mantém clientes, famílias e ignora linhas de total", async () => {
    const r = await parseWorkbook(load(SALTON));
    expect(r.rows.length).toBe(51);
    expect(r.familias).toHaveLength(7);
    expect(r.rows.every((x) => !!x.categoria)).toBe(true);
    expect(r.stats.celulas_avaliadas).toBe(408);
  });
});
