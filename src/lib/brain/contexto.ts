// Contexto da tela já resolvido pelo servidor → texto para o prompt (lógica pura).
// Só entra no prompt o que foi casado com a carteira do escopo; o resto é descartado.

import { normalizarNome, type ClienteCarteira } from "./carteira";
import type { ContextoTela } from "./page-context";

export type ContextoResolvido = { texto: string | null; rotulo: string | null };

const limpar = (s: string) => s.replace(/[\r\n`]+/g, " ").slice(0, 120);

/** Clientes do escopo com o nome informado (e do representante, quando informado). */
export function casarCliente(
  carteira: readonly ClienteCarteira[],
  nome: string | null | undefined,
  repId?: string | null,
): ClienteCarteira[] {
  const alvo = normalizarNome(nome);
  if (!alvo) return [];
  return carteira.filter((c) => c.nomeNorm === alvo && (!repId || c.representanteId === repId));
}

export function textoDoContexto(
  ctx: ContextoTela | null | undefined,
  clientes: readonly ClienteCarteira[],
  extra?: string | null,
): ContextoResolvido {
  if (!ctx) return { texto: null, rotulo: null };
  const linhas: string[] = [];
  let rotulo: string | null = ctx.area ? limpar(ctx.area) : null;
  if (ctx.area) linhas.push(`Área da tela: ${limpar(ctx.area)}.`);
  if (ctx.filtros) {
    const f = Object.entries(ctx.filtros)
      .map(([k, v]) => `${limpar(k)}=${limpar(v)}`)
      .join("; ");
    if (f) linhas.push(`Filtros na URL (informados pela interface): ${f}.`);
  }
  if (extra) linhas.push(extra);
  if (clientes.length === 1) {
    const c = clientes[0];
    linhas.push(
      `Cliente em foco: ${c.nome} (cliente_id=${c.id}; representante ${c.representante}; categoria ${c.categoria ?? "—"}; período ${c.periodoLabel ?? "—"}). Quando o usuário disser "este cliente", é este. Use detalhar_cliente com esse cliente_id.`,
    );
    rotulo = c.nome;
  } else if (clientes.length > 1) {
    linhas.push(
      `Cliente em foco aparece em mais de uma carteira: ${clientes
        .map((c) => `${c.nome} — ${c.representante} (cliente_id=${c.id})`)
        .join("; ")}. Pergunte qual antes de detalhar.`,
    );
    rotulo = clientes[0].nome;
  } else if (ctx.tipo !== "area") {
    linhas.push(
      "O registro aberto na tela não foi localizado na carteira vigente do seu escopo; não presuma dados dele.",
    );
  }
  if (!linhas.length) return { texto: null, rotulo };
  return {
    texto: `CONTEXTO DA TELA (validado pelo servidor; serve só para interpretar a pergunta e não amplia acesso):\n${linhas.join("\n")}`,
    rotulo,
  };
}
