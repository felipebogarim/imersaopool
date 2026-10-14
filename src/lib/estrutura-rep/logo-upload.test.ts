import { describe, it, expect } from "vitest";
import { processLogoUpload } from "./logo-upload";

describe("processLogoUpload", () => {
  it("rejeita arquivo com formato não suportado", async () => {
    const fakeFile = new File(["dummy content"], "manual.pdf", { type: "application/pdf" });
    await expect(processLogoUpload(fakeFile)).rejects.toThrow("Formato inválido");
  });

  it("rejeita arquivos que excedem o tamanho máximo permitido", async () => {
    // 16MB file
    const bigContent = new Uint8Array(16 * 1024 * 1024);
    const bigFile = new File([bigContent], "logo.png", { type: "image/png" });
    await expect(processLogoUpload(bigFile)).rejects.toThrow("excede o tamanho máximo");
  });

  it("processa arquivo SVG e retorna Data URL válida", async () => {
    const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="red"/></svg>`;
    const svgFile = new File([svgContent], "brand-logo.svg", { type: "image/svg+xml" });

    const result = await processLogoUpload(svgFile);
    expect(result).toBeDefined();
    expect(typeof result).toBe("string");
    expect(result.startsWith("data:image/svg+xml") || result.startsWith("http")).toBe(true);
  });
});
