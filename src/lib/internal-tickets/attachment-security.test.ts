import { describe, expect, it } from "vitest";
import { assessAttachmentContent, detectAttachmentMime } from "./attachment-security";

describe("segurança mínima de anexos", () => {
  it("detecta PNG pelos magic bytes", () => {
    const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(detectAttachmentMime(png)).toBe("image/png");
    expect(assessAttachmentContent(png, "image/png")).toMatchObject({
      mimeMismatch: false,
      suspicious: false,
    });
  });

  it("bloqueia conteúdo executável disfarçado de imagem", () => {
    const executable = Uint8Array.from([0x4d, 0x5a, 0x90, 0x00]);
    expect(assessAttachmentContent(executable, "image/png")).toEqual({
      detectedMimeType: "application/x-dosexec",
      mimeMismatch: true,
      suspicious: true,
    });
  });
});
