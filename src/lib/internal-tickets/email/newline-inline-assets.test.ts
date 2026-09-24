import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { loadNewlineInlineAssets } from "./newline-inline-assets.server";

describe("loadNewlineInlineAssets", () => {
  it("carrega os dois assets com CIDs, filenames e base64 não vazio", async () => {
    const assets = await loadNewlineInlineAssets();

    expect(assets).toHaveLength(2);

    const logo = assets.find((a) => a.filename === "logo-newline.png");
    expect(logo).toBeDefined();
    expect(logo?.contentId).toBe("newline-logo");
    expect(logo?.contentType).toBe("image/png");
    expect(logo?.content.length).toBeGreaterThan(0);
    expect(logo?.content).not.toContain("data:image");

    const icon = assets.find((a) => a.filename === "icon-newline.png");
    expect(icon).toBeDefined();
    expect(icon?.contentId).toBe("newline-icon");
    expect(icon?.contentType).toBe("image/png");
    expect(icon?.content.length).toBeGreaterThan(0);
    expect(icon?.content).not.toContain("data:image");
  });

  it("não possui qualquer dependência ou referência a node:fs ou process.cwd()", () => {
    const loaderSourcePath = resolve(__dirname, "./newline-inline-assets.server.ts");
    const sourceCode = readFileSync(loaderSourcePath, "utf-8");

    expect(sourceCode).not.toMatch(/node:fs/);
    expect(sourceCode).not.toMatch(/\bfs\b/);
    expect(sourceCode).not.toMatch(/readFile/);
    expect(sourceCode).not.toMatch(/process\.cwd/);
  });
});
