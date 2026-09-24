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
  it("gera endereço sintaticamente válido, compacto e abaixo do limite do local-part", () => {
    const address = buildReplyAddress("11111111-1111-4111-8111-111111111111", SECRET, DOMAIN);
    expect(address).toMatch(
      /^r\+11111111111141118111111111111111\.[0-9a-f]{24}@chamados\.poolflux\.app$/,
    );
    const [localPart, domain] = address.split("@");
    expect(localPart).toHaveLength(59);
    expect(localPart.length).toBeLessThanOrEqual(64);
    expect(domain).toBe(DOMAIN);
    expect(address).toHaveLength(81);
  });

  it("faz round-trip e reconstrói o UUID canônico", () => {
    const ticketId = "22222222-2222-4222-8222-222222222222";
    const address = buildReplyAddress(ticketId, SECRET, DOMAIN);
    const token = extractReplyToken(address);
    expect(token).not.toBeNull();
    const result = parseReplyToken(token!, SECRET);
    expect(result).toEqual({ valid: true, ticketId });
  });

  it("rejeita token com assinatura adulterada", () => {
    const ticketId = "33333333-3333-4333-8333-333333333333";
    const token = buildReplyToken(ticketId, SECRET);
    const tampered = token.slice(0, -1) + (token.at(-1) === "0" ? "1" : "0");
    expect(parseReplyToken(tampered, SECRET)).toEqual({ valid: false, ticketId: null });
  });

  it("rejeita token assinado com outro segredo", () => {
    const ticketId = "44444444-4444-4444-8444-444444444444";
    const token = buildReplyToken(ticketId, "outro-segredo");
    expect(parseReplyToken(token, SECRET)).toEqual({ valid: false, ticketId: null });
  });

  it("rejeita token malformado (sem separador)", () => {
    expect(parseReplyToken("sem-ponto-nenhum", SECRET)).toEqual({ valid: false, ticketId: null });
  });

  it("rejeita UUID compacto malformado", () => {
    expect(parseReplyToken(`nao-e-uuid.${"a".repeat(24)}`, SECRET)).toEqual({
      valid: false,
      ticketId: null,
    });
  });

  it("extractReplyToken devolve null para endereço fora do padrão r+", () => {
    expect(extractReplyToken("suporte@poolflux.app")).toBeNull();
  });

  it("rejeita ticketId que não seja UUID no builder", () => {
    expect(() => buildReplyAddress("ticket-curto", SECRET, DOMAIN)).toThrow("ticketId inválido");
  });
});
