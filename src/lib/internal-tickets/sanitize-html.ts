/**
 * Sanitização do HTML recebido por e-mail (respostas inbound) antes de
 * persistir/renderizar na linha do tempo do ticket.
 *
 * Allowlist por tokenização, sem DOM. Não usar DOMPurify/isomorphic-dompurify
 * aqui: este código roda no Cloudflare Worker, onde não existe `window`; o
 * build "browser" do isomorphic-dompurify faz `purify.sanitize.bind(purify)` no
 * carregamento do módulo e `sanitize` é undefined sem DOM
 * ("Cannot read properties of undefined (reading 'bind')").
 *
 * Só tags da allowlist sobrevivem, sem atributos (exceto href/title em <a>,
 * com href restrito a http(s)/mailto). Todo o resto vira texto escapado.
 */
const ALLOWED_TAGS = new Set([
  "p",
  "br",
  "b",
  "strong",
  "i",
  "em",
  "u",
  "ul",
  "ol",
  "li",
  "blockquote",
  "a",
  "span",
  "div",
  "table",
  "thead",
  "tbody",
  "tr",
  "td",
  "th",
]);
const VOID_TAGS = new Set(["br"]);
const DROP_WITH_CONTENT = "script|style|iframe|object|embed|noscript|template|svg|math|head|title";

const DROP_BLOCK_RE = new RegExp(
  `<(${DROP_WITH_CONTENT})\\b[^>]*>[\\s\\S]*?(?:</\\1\\s*>|$)`,
  "gi",
);
const COMMENT_RE = /<!--[\s\S]*?(?:-->|$)/g;
const TAG_RE = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)((?:"[^"]*"|'[^']*'|[^'">])*)>/g;
const ATTR_RE = /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

function escapeText(s: string): string {
  return s
    .replace(/&(?!(?:[a-zA-Z][a-zA-Z0-9]{1,31}|#\d{1,7}|#[xX][0-9a-fA-F]{1,6});)/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeAttr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);?/gi, (_, h) =>
      String.fromCodePoint(Math.min(parseInt(h, 16), 0x10ffff)),
    )
    .replace(/&#(\d+);?/g, (_, d) => String.fromCodePoint(Math.min(parseInt(d, 10), 0x10ffff)))
    .replace(/&colon;/gi, ":")
    .replace(/&(?:tab|newline);/gi, "")
    .replace(/&amp;/gi, "&");
}

function safeHref(raw: string): string | null {
  // eslint-disable-next-line no-control-regex
  const value = decodeEntities(raw).replace(/[\u0000- \u007f-\u009f]+/g, "");
  return /^(?:https?|mailto):/i.test(value) ? decodeEntities(raw).trim() : null;
}

function renderOpenTag(name: string, attrSource: string): string {
  if (name !== "a") return `<${name}>`;
  let href: string | null = null;
  let title: string | null = null;
  for (const m of attrSource.matchAll(ATTR_RE)) {
    const key = m[1].toLowerCase();
    const val = m[2] ?? m[3] ?? m[4] ?? "";
    if (key === "href" && href === null) href = safeHref(val);
    else if (key === "title" && title === null) title = decodeEntities(val);
  }
  let out = "<a";
  if (href) out += ` href="${escapeAttr(href)}"`;
  if (title) out += ` title="${escapeAttr(title)}"`;
  return `${out} rel="noopener noreferrer" target="_blank">`;
}

export function sanitizeInboundHtml(html: string): string {
  const src = html.replace(COMMENT_RE, "").replace(DROP_BLOCK_RE, "");
  let out = "";
  let last = 0;
  for (const m of src.matchAll(TAG_RE)) {
    out += escapeText(src.slice(last, m.index));
    last = m.index + m[0].length;
    const closing = m[1] === "/";
    const name = m[2].toLowerCase();
    if (!ALLOWED_TAGS.has(name)) continue;
    if (closing) {
      if (!VOID_TAGS.has(name)) out += `</${name}>`;
    } else {
      out += renderOpenTag(name, m[3]);
    }
  }
  out += escapeText(src.slice(last));
  return out;
}
