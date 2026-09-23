import { describe, expect, it } from "vitest";
import {
  buildReplyAddress,
  buildReplyToken,
  extractReplyToken,
  parseReplyToken,
} from "./reply-address";

const SECRET = "test-secret";
const DOMAIN = "chamados.poolflux.app";

describe("reply-address", () => {
  it("gera um endereço no formato reply+<ticketId>.<assinatura>@<domínio>", () => {
    const address = buildReplyAddress("11111111-1111-1111-1111-111111111111", SECRET, DOMAIN);
    expect(address).toMatch(
      /^reply\+11111111-1111-1111-1111-111111111111\.[0-9a-f]{24}@chamados\.poolflux\.app$/,
    );
  });

  it("extrai e valida o token de um endereço gerado por ela mesma", () => {
    const ticketId = "22222222-2222-2222-2222-222222222222";
    const address = buildReplyAddress(ticketId, SECRET, DOMAIN);
    const token = extractReplyToken(address);
    expect(token).not.toBeNull();
    const result = parseReplyToken(token!, SECRET);
    expect(result).toEqual({ valid: true, ticketId });
  });

  it("rejeita token com assinatura adulterada", () => {
    const ticketId = "33333333-3333-3333-3333-333333333333";
    const token = buildReplyToken(ticketId, SECRET);
    const tampered = token.slice(0, -1) + (token.at(-1) === "0" ? "1" : "0");
    expect(parseReplyToken(tampered, SECRET)).toEqual({ valid: false, ticketId: null });
  });

  it("rejeita token assinado com outro segredo", () => {
    const ticketId = "44444444-4444-4444-4444-444444444444";
    const token = buildReplyToken(ticketId, "outro-segredo");
    expect(parseReplyToken(token, SECRET)).toEqual({ valid: false, ticketId: null });
  });

  it("rejeita token malformado (sem separador)", () => {
    expect(parseReplyToken("sem-ponto-nenhum", SECRET)).toEqual({ valid: false, ticketId: null });
  });

  it("extractReplyToken devolve null para endereço fora do padrão reply+", () => {
    expect(extractReplyToken("suporte@poolflux.app")).toBeNull();
  });
});
