import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { parseVisaoImersao2File, buildVisaoImersao2ViewModel } from "./visao-imersao-2-import";
import { matchPerformanceRow, normalizeCommercialName, stripCorporateSuffixes } from "./client-commercial-resolver";

describe("Visao Imersao 2 - Parser e Vinculo Comercial", () => {
  it("faz parse de Relatorio_ALL_LED_BAHIA preservando trade_name e dados do cliente", () => {
    const filePath = path.resolve(
      process.cwd(),
      ".orca/drops/Relatorio_ALL_LED_BAHIA_Salvador_VISAO_IMERSAO_2_FINAL_CORRIGIDO.md"
    );
    const content = fs.readFileSync(filePath, "utf-8");
    const data = parseVisaoImersao2File(content);

    expect(data.client.name).toBe("RSS DISTRIBUIDORA DE MATERIAL ELETRICO E SERVICOS LTDA");
    expect(data.client.trade_name).toBe("ALL LED BAHIA");
    expect(data.trade_name).toBe("ALL LED BAHIA");
    expect(data.client.representative).toBe("Anselmo");
    expect(data.client.location).toBe("Salvador, BA");

    const vm = buildVisaoImersao2ViewModel(data);
    expect(vm.metadata.client_name).toBe("RSS DISTRIBUIDORA DE MATERIAL ELETRICO E SERVICOS LTDA");
    expect(vm.metadata.client_trade_name).toBe("ALL LED BAHIA");
    expect(vm.metadata.representative_name).toBe("Anselmo");
  });

  it("reconhece correspondencia entre razao social, trade_name e linha de performance", () => {
    const client = {
      razao_social: "RSS DISTRIBUIDORA DE MATERIAL ELETRICO E SERVICOS LTDA",
      nome_fantasia: "ALL LED BAHIA",
    };

    // 1. Linha na planilha do representante com o nome fantasia
    expect(matchPerformanceRow("ALL LED BAHIA", client)).toBe(true);
    expect(matchPerformanceRow("All Led Bahia", client)).toBe(true);
    expect(matchPerformanceRow("ALL LED", client)).toBe(true);

    // 2. Linha na planilha com a razão social sem LTDA
    expect(matchPerformanceRow("RSS DISTRIBUIDORA DE MATERIAL ELETRICO E SERVICOS", client)).toBe(true);
    expect(matchPerformanceRow("RSS DISTRIBUIDORA", client)).toBe(true);

    // 3. Normalização e remoção de sufixos
    expect(normalizeCommercialName("RSS DISTRIBUIDORA DE MATERIAL ELÉTRICO E SERVIÇOS LTDA.")).toBe(
      "RSS DISTRIBUIDORA DE MATERIAL ELETRICO E SERVICOS LTDA"
    );
    expect(stripCorporateSuffixes("RSS DISTRIBUIDORA DE MATERIAL ELÉTRICO E SERVIÇOS LTDA.")).toBe(
      "RSS DISTRIBUIDORA DE MATERIAL ELETRICO E SERVICOS"
    );
  });
});
