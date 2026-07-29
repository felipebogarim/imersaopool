/**
 * Testes do endpoint público de download de backups.
 *
 * O download é a outra porta por onde metadados/arquivos poderiam vazar entre
 * empresas: ele usa credencial de serviço e, por isso, precisa recusar qualquer
 * chamada sem a chave correta antes de tocar no Storage.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { verifyApiKey } from "./backup-shared.server";

const KEY = "chave-de-teste";

function req(headers: Record<string, string> = {}) {
  return new Request("https://exemplo.test/api/public/backup-download", {
    method: "POST",
    headers,
  });
}

describe("backup-download: autorização do chamador", () => {
  beforeEach(() => {
    process.env.SUPABASE_PUBLISHABLE_KEY = KEY;
  });

  it("recusa chamada sem chave", async () => {
    const res = verifyApiKey(req());
    expect(res?.status).toBe(401);
  });

  it("recusa chave incorreta", async () => {
    const res = verifyApiKey(req({ apikey: "errada" }));
    expect(res?.status).toBe(401);
  });

  it("recusa quando o servidor não tem chave configurada", async () => {
    delete process.env.SUPABASE_PUBLISHABLE_KEY;
    const res = verifyApiKey(req({ apikey: "qualquer" }));
    expect(res?.status).toBe(401);
  });

  it("aceita a chave correta (header apikey ou x-api-key)", async () => {
    expect(verifyApiKey(req({ apikey: KEY }))).toBeNull();
    expect(verifyApiKey(req({ "x-api-key": KEY }))).toBeNull();
  });
});
