import { describe, expect, it } from "vitest";
import { collectReferences, generateMessageId } from "./message-id";

describe("message-id", () => {
  it("gera um Message-ID único no formato <uuid@domínio>", () => {
    const a = generateMessageId("chamados.poolflux.app");
    const b = generateMessageId("chamados.poolflux.app");
    expect(a).toMatch(/^<[0-9a-f-]{36}@chamados\.poolflux\.app>$/);
    expect(a).not.toBe(b);
  });

  it("une References + In-Reply-To sem duplicar", () => {
    const refs = collectReferences("<msg-2@x>", "<msg-1@x> <msg-2@x>");
    expect(refs).toEqual(["<msg-1@x>", "<msg-2@x>"]);
  });

  it("ignora valores ausentes", () => {
    expect(collectReferences(null, undefined)).toEqual([]);
    expect(collectReferences("<only@x>", null)).toEqual(["<only@x>"]);
  });
});
