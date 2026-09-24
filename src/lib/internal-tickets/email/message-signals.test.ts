import { describe, expect, it } from "vitest";
import { deriveMessageSignals } from "./message-signals";

describe("derived message signals", () => {
  it("identifies probable conclusion only as a signal", () => {
    const signals = deriveMessageSignals("O ajuste foi concluído e entregue.");
    expect(signals.map((signal) => signal.type)).toContain("provavel_conclusao");
    expect(signals).not.toHaveProperty("status");
  });

  it("always records the objective fact that a reply exists", () => {
    expect(deriveMessageSignals(null)).toEqual([{ type: "resposta", confidence: 1 }]);
  });
});
