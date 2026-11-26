import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { authorizeAiRequest, type AiAuthDeps } from "./ai-endpoint-auth.server";

const JWT_OK = "aaa.bbb.ccc";
const JWT_EXPIRADO = "xxx.yyy.zzz";

function deps(over: Partial<AiAuthDeps> = {}): AiAuthDeps {
  return {
    verifySession: vi.fn(async (jwt: string) => (jwt === JWT_OK ? "user-1" : null)),
    isExternalRep: vi.fn(async () => false),
    validateRepToken: vi.fn(async (t: string) => t === "token-valido-123"),
    ...over,
  };
}

const req = (headers: Record<string, string> = {}) =>
  new Request("http://localhost/api/tts", { method: "POST", headers });

describe("autenticação das rotas de IA (/api/tts, /api/transcribe-chunk)", () => {
  it("bloqueia requisição sem autenticação (401)", async () => {
    expect(await authorizeAiRequest(req(), deps())).toMatchObject({ ok: false, status: 401 });
  });

  it("libera usuário interno com sessão válida", async () => {
    const r = await authorizeAiRequest(req({ authorization: `Bearer ${JWT_OK}` }), deps());
    expect(r).toEqual({ ok: true, via: "sessao", subject: "user-1" });
  });

  it("bloqueia sessão inválida, expirada ou malformada", async () => {
    for (const authorization of [
      `Bearer ${JWT_EXPIRADO}`,
      "Bearer token-sem-pontos",
      "Basic abc",
      "Bearer ",
    ]) {
      expect(await authorizeAiRequest(req({ authorization }), deps())).toMatchObject({
        ok: false,
        status: 401,
      });
    }
  });

  it("representante externo (portal) com sessão é bloqueado (403)", async () => {
    const r = await authorizeAiRequest(
      req({ authorization: `Bearer ${JWT_OK}` }),
      deps({ isExternalRep: vi.fn(async () => true) }),
    );
    expect(r).toMatchObject({ ok: false, status: 403 });
  });

  it("página pública /r/$token: token válido libera, inválido/expirado bloqueia", async () => {
    expect(
      await authorizeAiRequest(req({ "x-rep-token": "token-valido-123" }), deps()),
    ).toMatchObject({ ok: true, via: "token_representante" });
    expect(
      await authorizeAiRequest(req({ "x-rep-token": "token-expirado-1" }), deps()),
    ).toMatchObject({ ok: false, status: 401 });
    expect(await authorizeAiRequest(req({ "x-rep-token": "curto" }), deps())).toMatchObject({
      ok: false,
      status: 401,
    });
  });

  it("sessão expirada + token público válido ainda libera a página pública", async () => {
    const r = await authorizeAiRequest(
      req({ authorization: `Bearer ${JWT_EXPIRADO}`, "x-rep-token": "token-valido-123" }),
      deps(),
    );
    expect(r).toMatchObject({ ok: true, via: "token_representante" });
  });

  it("falha na verificação bloqueia (fail-closed) sem detalhar o erro", async () => {
    const r = await authorizeAiRequest(
      req({ authorization: `Bearer ${JWT_OK}` }),
      deps({
        verifySession: vi.fn(async () => {
          throw new Error("rede caiu: segredo-interno");
        }),
      }),
    );
    expect(r).toEqual({ ok: false, status: 401, error: "Não autenticado." });
  });
});

describe("rotas de IA: autenticação antes da chave e sem vazar credenciais", () => {
  for (const arquivo of ["src/routes/api/tts.ts", "src/routes/api/transcribe-chunk.ts"]) {
    it(arquivo, () => {
      const src = readFileSync(arquivo, "utf8");
      const iAuth = src.indexOf("authorizeAiRequest(request)");
      const iKey = src.indexOf('process.env["LOVABLE_API_KEY"]');
      expect(iAuth).toBeGreaterThan(-1);
      expect(iKey).toBeGreaterThan(iAuth);
      // Resposta de erro não repassa o corpo bruto do provedor nem a chave.
      expect(src).not.toMatch(/error:\s*`[^`]*\$\{detail\}/);
      expect(src).not.toMatch(/Response\.json\([^)]*key/);
    });
  }
});
