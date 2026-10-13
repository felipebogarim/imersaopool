import { describe, it, expect } from "vitest";
import { formatWhatsappNumber, formatRepStructureWhatsappText } from "./whatsapp";
import { buildBrazilMapSvg, generateRepStructurePdf } from "./pdf";
import { buildDefaultStructure } from "./storage";

describe("estrutura-rep WhatsApp and PDF utilities", () => {
  it("formata número de telefone para padrão internacional do WhatsApp", () => {
    expect(formatWhatsappNumber("(65) 99206-0919")).toBe("5565992060919");
    expect(formatWhatsappNumber("5565992060919")).toBe("5565992060919");
    expect(formatWhatsappNumber(undefined)).toBe("");
    expect(formatWhatsappNumber(null)).toBe("");
  });

  it("formata texto otimizado para envio no WhatsApp com informações da representação", () => {
    const struct = buildDefaultStructure({
      id: "rep-1",
      nome: "Anderson Basso",
      representacao: "Basso Consultoria",
      regiao: "MT, GO e DF",
      outras_marcas: "Newline Iluminação, Stella",
    });

    const text = formatRepStructureWhatsappText(struct, {
      email: "basso@teste.com",
      telefone: "(65) 99999-9999",
    });

    expect(text).toContain("*ESTRUTURA COMERCIAL & OPERACIONAL*");
    expect(text).toContain("Anderson Basso");
    expect(text).toContain("Basso Consultoria");
    expect(text).toContain("TERRITÓRIO ATENDIDO");
    expect(text).toContain("MT");
    expect(text).toContain("GO");
    expect(text).toContain("DF");
    expect(text).toContain("Newline Iluminação");
    expect(text).toContain("RECURSOS OPERACIONAIS");
    expect(text).toContain("Relatório Executivo em PDF");
  });

  it("gera SVG do mapa com os estados atendidos destacados", () => {
    const svg = buildBrazilMapSvg(["MT", "GO", "DF"]);
    expect(svg).toContain("<svg");
    expect(svg).toContain("viewBox=\"0 0 800 800\"");
    expect(svg).toContain("#0e7490"); // Cor de destaque do estado atendido
    expect(svg).toContain("MT");
    expect(svg).toContain("GO");
    expect(svg).toContain("DF");
  });

  it("gera documento PDF executivo válido", async () => {
    const struct = buildDefaultStructure({
      id: "rep-2",
      nome: "Carlos Silva",
      representacao: "Silva Rep",
      regiao: "SP",
      outras_marcas: "Newline",
    });

    const result = await generateRepStructurePdf(struct);
    expect(result.blob).toBeDefined();
    expect(result.blob.size).toBeGreaterThan(1000);
    expect(result.filename).toBe("Estrutura-Rep-carlos-silva.pdf");
    expect(result.title).toContain("Carlos Silva");
  });
});
