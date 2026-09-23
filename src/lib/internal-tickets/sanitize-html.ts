import DOMPurify from "isomorphic-dompurify";

/**
 * Sanitização do HTML recebido por e-mail (respostas inbound) antes de
 * persistir/renderizar na linha do tempo do ticket.
 *
 * Usa isomorphic-dompurify (não sanitize-html): a cadeia
 * sanitize-html -> htmlparser2 -> entities quebra o build de produção deste
 * projeto (Vite 8 + rolldown resolve `entities/decode` para a cópia raiz do
 * pacote, que não tem esse subpath export, em vez da cópia aninhada em
 * sanitize-html/node_modules — parece bug do resolver do rolldown com
 * exports condicionais aninhados). dompurify já era dependência transitiva
 * comprovadamente compatível com este build (usada por outra lib do
 * projeto), por isso a troca.
 */
DOMPurify.addHook("afterSanitizeAttributes", (node) => {
  if (node.tagName === "A") {
    node.setAttribute("rel", "noopener noreferrer");
    node.setAttribute("target", "_blank");
  }
});

export function sanitizeInboundHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
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
    ],
    ALLOWED_ATTR: ["href", "title", "target", "rel"],
    ALLOWED_URI_REGEXP: /^(?:https?|mailto):/i,
  });
}
