// Markdown das respostas do Brain: reaproveita o MarkdownView e acrescenta tabelas.
import type { ReactNode } from "react";
import { MarkdownView } from "@/components/MarkdownView";
import { BrainChart, parseGrafico } from "./BrainChart";

const ehLinhaTabela = (l: string) => /^\s*\|.*\|\s*$/.test(l);
const ehSeparador = (l: string) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(l);
const celulas = (l: string) =>
  l
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim().replace(/\*\*/g, ""));

export function BrainMarkdown({ markdown }: { markdown: string }) {
  const linhas = markdown.split(/\r?\n/);
  const blocos: ReactNode[] = [];
  let texto: string[] = [];
  const flush = () => {
    if (texto.join("").trim()) {
      blocos.push(<MarkdownView key={`t${blocos.length}`} markdown={texto.join("\n")} />);
    }
    texto = [];
  };
  for (let i = 0; i < linhas.length; i++) {
    // Bloco ```grafico {json}``` (durante o streaming, só renderiza quando o bloco fecha).
    if (/^\s*```\s*grafico\s*$/i.test(linhas[i])) {
      const fim = linhas.findIndex((l, k) => k > i && /^\s*```\s*$/.test(l));
      if (fim < 0) break;
      flush();
      const g = parseGrafico(linhas.slice(i + 1, fim).join("\n"));
      if (g) blocos.push(<BrainChart key={`g${blocos.length}`} g={g} />);
      i = fim;
      continue;
    }
    if (ehLinhaTabela(linhas[i]) && i + 1 < linhas.length && ehSeparador(linhas[i + 1])) {
      flush();
      const cab = celulas(linhas[i]);
      const corpo: string[][] = [];
      i += 2;
      while (i < linhas.length && ehLinhaTabela(linhas[i])) corpo.push(celulas(linhas[i++]));
      i--;
      blocos.push(
        <div key={`tb${blocos.length}`} className="my-2 overflow-x-auto rounded-md border">
          <table className="w-full text-xs">
            <thead className="bg-muted/60">
              <tr>
                {cab.map((c, j) => (
                  <th key={j} className="px-2 py-1.5 text-left font-semibold whitespace-nowrap">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {corpo.map((r, k) => (
                <tr key={k} className="border-t">
                  {r.map((c, j) => (
                    <td
                      key={j}
                      className={`px-2 py-1 ${/^[-R$\d.,%\s]+$/.test(c) ? "text-right tabular-nums whitespace-nowrap" : ""}`}
                    >
                      {c}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }
    // Títulos "# " viram "## " (o MarkdownView trata a partir de ##).
    texto.push(linhas[i].replace(/^#\s+/, "## "));
  }
  flush();
  return <div className="space-y-2">{blocos}</div>;
}
