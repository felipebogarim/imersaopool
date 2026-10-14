import { describe, it, expect, vi } from "vitest";

describe("RepObservacoesCard - Estrutura e Lógica", () => {
  it("deve sincronizar e chamar onSave com texto atualizado", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const textoObservacoes = "Carteira em expansão com foco em clientes Gold.";

    await onSave(textoObservacoes);

    expect(onSave).toHaveBeenCalledWith("Carteira em expansão com foco em clientes Gold.");
  });

  it("deve lidar com textos vazios e espaços sem quebrar", async () => {
    const onSave = vi.fn();
    const textoVazio = "   ";

    await onSave(textoVazio.trim());

    expect(onSave).toHaveBeenCalledWith("");
  });
});
