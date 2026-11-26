// Contexto da tela para o assistente (lógica pura). O navegador só INDICA onde o usuário está;
// o servidor valida cada identificador contra o escopo antes de usar (nunca amplia acesso).

import { z } from "zod";

export const contextoTelaSchema = z.object({
  tipo: z.enum(["area", "cliente_linha", "cliente_cadastro", "cliente_nome", "imersao"]),
  area: z.string().trim().max(80).optional(),
  rowId: z.string().uuid().optional(),
  clientId: z.string().uuid().optional(),
  immersionId: z.string().uuid().optional(),
  repId: z.string().uuid().optional(),
  nome: z.string().trim().max(200).optional(),
  filtros: z
    .record(z.string().max(40), z.string().max(120))
    .refine((f) => Object.keys(f).length <= 8)
    .optional(),
});

export type ContextoTela = z.infer<typeof contextoTelaSchema>;

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const re = (p: string) => new RegExp(`^${p.replace(/:id/g, `(${UUID})`)}/?$`, "i");

const AREAS: Array<[RegExp, string]> = [
  [/^\/performance\/metas/, "Metas"],
  [/^\/performance\/reps/, "Performance Reps"],
  [/^\/performance\/bi-clientes/, "BI Clientes"],
  [/^\/representantes\/performance/, "Performance de representantes"],
  [/^\/representantes/, "Representantes"],
  [/^\/clientes/, "Clientes"],
  [/^\/imersoes/, "Imersões"],
  [/^\/bi-diretor/, "BI Diretor"],
  [/^\/visao-imersao-2/, "Visão Imersões em Campo"],
  [/^\/visao-rep-2/, "Visão Reps"],
  [/^\/ferramentas\/acoes-reps/, "Ações Reps"],
  [/^\/tarefas/, "Gestão de Tarefas"],
  [/^\/price/, "Preços"],
  [/^\/home/, "Home"],
];

const ABAS_PORTAL: Record<string, string> = {
  metas: "Metas da carteira",
  agenda: "Guia de Agenda",
  acoes_sugeridas: "Ações Sugeridas",
  calendario: "Calendário de Ações",
  solicitacoes: "Solicitações",
};

/** Filtros visíveis na URL (somente texto simples, sem identificadores longos). */
function filtrosDaUrl(search: Record<string, unknown>): Record<string, string> | undefined {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(search ?? {})) {
    if (Object.keys(out).length >= 8 || k === "tab") continue;
    if (!/^[a-zA-Z_][\w-]{0,39}$/.test(k)) continue;
    const s = Array.isArray(v) ? v.join(", ") : typeof v === "object" ? null : String(v ?? "");
    if (!s || s.length > 120 || /[\r\n]/.test(s)) continue;
    out[k] = s;
  }
  return Object.keys(out).length ? out : undefined;
}

function decodificar(s: string) {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

export function contextoDaRota(
  pathname: string,
  search: Record<string, unknown> = {},
): ContextoTela | null {
  const p = pathname.replace(/\/+$/, "") || "/";
  let m: RegExpMatchArray | null;

  if (p.startsWith("/portal-rep")) {
    if ((m = p.match(re("/portal-rep/metas/:id")))) {
      return { tipo: "cliente_linha", rowId: m[1], area: "Metas do cliente" };
    }
    const aba = typeof search.tab === "string" ? search.tab : "metas";
    return { tipo: "area", area: `Portal do Representante · ${ABAS_PORTAL[aba] ?? "Carteira"}` };
  }
  if ((m = p.match(re("/performance/metas/:id")))) {
    return { tipo: "cliente_linha", rowId: m[1], area: "Metas do cliente" };
  }
  if ((m = p.match(re("/clientes/:id")))) {
    return { tipo: "cliente_cadastro", clientId: m[1], area: "Cadastro de cliente" };
  }
  if ((m = p.match(new RegExp(`^/clientes-bi(?:/comparar)?/(${UUID})/([^/]+)$`, "i")))) {
    return {
      tipo: "cliente_nome",
      repId: m[1],
      nome: decodificar(m[2]).slice(0, 200),
      area: "BI do cliente",
    };
  }
  if ((m = p.match(re("/imersoes/:id")))) {
    return { tipo: "imersao", immersionId: m[1], area: "Imersão" };
  }
  const area = AREAS.find(([r]) => r.test(p))?.[1];
  if (!area) return null;
  const view = search.view === "bi" ? " · BI Metas" : "";
  return { tipo: "area", area: area + view, filtros: filtrosDaUrl(search) };
}

/** Sugestões de perguntas para o contexto atual. */
export function sugestoesDoContexto(
  c: ContextoTela | null,
  iface: "plataforma" | "portal",
): string[] {
  switch (c?.tipo) {
    case "cliente_linha":
    case "cliente_cadastro":
    case "cliente_nome":
      return [
        "Resuma a situação deste cliente",
        "Este cliente mantém a categoria até dezembro?",
        "Quais portfólios deste cliente estão abaixo da meta?",
        "Como este cliente evoluiu nos últimos períodos?",
      ];
    case "imersao":
      return [
        "Resuma o cliente desta imersão",
        "Quais indicadores deste cliente merecem atenção?",
        "O que o Brain Comercial sabe sobre este cliente?",
      ];
    default:
      break;
  }
  const area = c?.area ?? "";
  if (/Metas/.test(area)) {
    return iface === "portal"
      ? [
          "Quais clientes meus estão abaixo da meta?",
          "Quanto falta para meus clientes Gold manterem a categoria?",
        ]
      : [
          "Quais clientes estão com menor atingimento?",
          "Clientes Gold em risco de cair de categoria",
          "Resumo das metas por representante",
        ];
  }
  if (/Performance|BI/.test(area)) {
    return [
      "Resumo da carteira por representante",
      "Top 10 clientes por média mensal de compras",
      "Clientes com oportunidade de subir para Black",
    ];
  }
  return iface === "portal"
    ? [
        "Resumo da minha carteira",
        "Quais clientes meus estão em risco de cair de categoria?",
        "Quais clientes têm o menor atingimento?",
      ]
    : [
        "Resumo da carteira por representante",
        "Quais clientes Gold estão em risco de cair de categoria?",
        "Top 10 clientes por média mensal de compras",
      ];
}
