// Renderizador markdown leve para conteúdo verbatim de relatórios.
// Preserva hierarquia: subtítulos, bullets, listas numeradas e citações.
import { Fragment, type ReactNode } from "react";

function inline(text: string, keyBase: string): ReactNode[] {
  const parts: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const tok = m[0];
    const key = `${keyBase}-i${i++}`;
    if (tok.startsWith("**")) parts.push(<strong key={key}>{tok.slice(2, -2)}</strong>);
    else if (tok.startsWith("`")) parts.push(<code key={key} className="text-[0.85em] bg-muted px-1 rounded">{tok.slice(1, -1)}</code>);
    else parts.push(<em key={key}>{tok.slice(1, -1)}</em>);
    last = m.index + tok.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

export function MarkdownView({ markdown, className = "" }: { markdown: string; className?: string }) {
  const lines = (markdown ?? "").split(/\r?\n/);
  const blocks: ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  let quote: string[] = [];
  let para: string[] = [];
  let k = 0;

  const flushList = () => {
    if (!list) return;
    const items = list.items;
    blocks.push(
      list.ordered ? (
        <ol key={`l${k++}`} className="list-decimal pl-5 space-y-1 text-sm leading-relaxed">
          {items.map((it, i) => <li key={i}>{inline(it, `l${k}-${i}`)}</li>)}
        </ol>
      ) : (
        <ul key={`l${k++}`} className="list-disc pl-5 space-y-1 text-sm leading-relaxed">
          {items.map((it, i) => <li key={i}>{inline(it, `l${k}-${i}`)}</li>)}
        </ul>
      ),
    );
    list = null;
  };
  const flushQuote = () => {
    if (!quote.length) return;
    blocks.push(
      <blockquote key={`q${k++}`} className="border-l-4 border-primary/60 pl-4 py-1 my-1 italic text-sm leading-relaxed">
        {quote.map((q, i) => <p key={i}>{inline(q, `q${k}-${i}`)}</p>)}
      </blockquote>,
    );
    quote = [];
  };
  const flushPara = () => {
    if (!para.length) return;
    const text = para.join(" ");
    blocks.push(<p key={`p${k++}`} className="text-sm leading-relaxed">{inline(text, `p${k}`)}</p>);
    para = [];
  };
  const flushAll = () => { flushList(); flushQuote(); flushPara(); };

  for (const raw of lines) {
    const line = raw.replace(/\s+$/, "");
    if (!line.trim()) { flushAll(); continue; }

    const h = line.match(/^(#{2,5})\s+(.*)$/);
    if (h) {
      flushAll();
      const level = h[1].length;
      const cls = level <= 3 ? "text-base font-semibold mt-3" : "text-sm font-semibold mt-2";
      blocks.push(<p key={`h${k++}`} className={cls}>{inline(h[2], `h${k}`)}</p>);
      continue;
    }
    if (/^\s*(?:[-*_]\s*){3,}$/.test(line)) { flushAll(); blocks.push(<hr key={`hr${k++}`} className="my-2 border-border" />); continue; }

    const bq = line.match(/^\s*>\s?(.*)$/);
    if (bq) { flushList(); flushPara(); quote.push(bq[1]); continue; }

    const bullet = line.match(/^\s*[-*•]\s+(.*)$/);
    const num = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (bullet || num) {
      flushQuote(); flushPara();
      const ordered = !!num;
      const item = (bullet ? bullet[1] : num![1]).trim();
      // Citação isolada em bullet vira citação destacada
      if (!ordered && /^["“][^"”]+["”]\s*$/.test(item)) {
        flushList();
        quote.push(item.replace(/^["“]|["”]$/g, ""));
        continue;
      }
      if (!list || list.ordered !== ordered) { flushList(); list = { ordered, items: [] }; }
      list.items.push(item);
      continue;
    }

    if (/^\s*["“][^"”]+["”][.!?]?\s*$/.test(line)) {
      flushList(); flushPara();
      quote.push(line.trim().replace(/^["“]|["”][.!?]?$/g, ""));
      continue;
    }

    flushList(); flushQuote();
    para.push(line.trim());
  }
  flushAll();

  return <div className={`space-y-2 ${className}`}>{blocks.map((b, i) => <Fragment key={i}>{b}</Fragment>)}</div>;
}
