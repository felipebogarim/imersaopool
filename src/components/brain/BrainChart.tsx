// Gráfico de barras horizontais para respostas do Brain (série única: sem legenda; o título nomeia).
// Recebe o JSON de um bloco ```grafico; formato inválido = não renderiza (o texto/tabela continua).

import { z } from "zod";

const schema = z.object({
  titulo: z.string().max(120).optional(),
  unidade: z.string().max(10).optional(),
  itens: z
    .array(z.object({ rotulo: z.string().max(80), valor: z.number().finite() }))
    .min(1)
    .max(12),
});

export type GraficoBrain = z.infer<typeof schema>;

export function parseGrafico(json: string): GraficoBrain | null {
  try {
    const r = schema.safeParse(JSON.parse(json));
    return r.success ? r.data : null;
  } catch {
    return null;
  }
}

function formatar(v: number, unidade?: string) {
  if (unidade === "R$") return `R$ ${v.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`;
  if (unidade === "%") return `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
  return `${v.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}${unidade ? ` ${unidade}` : ""}`;
}

export function BrainChart({ g }: { g: GraficoBrain }) {
  const max = Math.max(...g.itens.map((i) => Math.abs(i.valor)), 0) || 1;
  return (
    <figure className="my-2 rounded-md border bg-background p-3">
      {g.titulo && <figcaption className="mb-2 text-xs font-semibold">{g.titulo}</figcaption>}
      <div className="space-y-1.5">
        {g.itens.map((i, k) => {
          const pct = Math.max(1, (Math.abs(i.valor) / max) * 100);
          const valor = formatar(i.valor, g.unidade);
          return (
            <div
              key={k}
              className="group grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-2 text-[11px]"
              title={`${i.rotulo}: ${valor}`}
            >
              <span className="truncate text-muted-foreground">{i.rotulo}</span>
              <span className="h-2 rounded-r-[4px] bg-muted/40">
                <span
                  className="block h-2 rounded-r-[4px] bg-primary/80 transition-colors group-hover:bg-primary"
                  style={{ width: `${pct}%` }}
                />
              </span>
              <span className="tabular-nums text-foreground">{valor}</span>
            </div>
          );
        })}
      </div>
    </figure>
  );
}
