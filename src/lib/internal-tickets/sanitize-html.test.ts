import { describe, expect, it } from "vitest";
import { sanitizeInboundHtml } from "./sanitize-html";

describe("sanitizeInboundHtml", () => {
  it("mantém tags permitidas e remove scripts/handlers", () => {
    const out = sanitizeInboundHtml(
      '<p onclick="x()">Olá <b>mundo</b></p><script>alert(1)</script><img src=x onerror="alert(2)">',
    );
    expect(out).toBe("<p>Olá <b>mundo</b></p>");
  });

  it("restringe href a http(s)/mailto", () => {
    expect(sanitizeInboundHtml('<a href="javascript:alert(1)">x</a>')).not.toContain("javascript");
    expect(sanitizeInboundHtml('<a href="java&#115;cript:alert(1)">x</a>')).not.toContain("href");
    expect(sanitizeInboundHtml('<a href=" JaVa\tScript:1">x</a>')).not.toContain("href");
    expect(sanitizeInboundHtml('<a href="https://a.com/?q=1&b=2" onclick="x">x</a>')).toBe(
      '<a href="https://a.com/?q=1&amp;b=2" rel="noopener noreferrer" target="_blank">x</a>',
    );
  });

  it("escapa texto solto e tags não fechadas", () => {
    expect(sanitizeInboundHtml("1 < 2 & <b")).toBe("1 &lt; 2 &amp; &lt;b");
    expect(sanitizeInboundHtml("a &amp; b")).toBe("a &amp; b");
  });
});
