import { LENTE_DEF, LENTES, toValues, type Lente, type SinteseCampos } from "@/lib/insight-lentes";

export type FonteInput = {
  id: string;
  tipo: string;
  titulo: string;
  pessoa: string | null;
  regiao: string | null;
  perfil_carteira: string | null;
  lentes: Record<string, { leitura_estrategica: string | null; sintese_campos: SinteseCampos; highlights: string[] }>;
};

export type FonteRef = { id: string; nome: string; regiao: string | null; perfil: string | null; tipo: string };

export type Evidencia = { fonteId: string; fonte: string; regiao: string | null; fala: string };

export type ItemConvergencia = {
  texto: string;
  campo: string;
  peso: number;
  total: number;
  fala_representativa: string | null;
  fontes: FonteRef[];
  reforcada: boolean;
  evidencias?: Evidencia[];
};
export type ItemDivergencia = {
  tema: string;
  posicoes: { posicao: string; campo: string; fonte: string; fonteId: string; regiao: string | null; fala: string | null }[];
};
export type ItemEspecifico = { texto: string; campo: string; fonte: string; fonteId: string; regiao: string | null };

export type LenteResultado = {
  convergencia: ItemConvergencia[];
  divergencia: ItemDivergencia[];
  especifico: ItemEspecifico[];
  acao_convergente: { texto: string; peso: number; fontes: FonteRef[] } | null;
};

export type SinteseResultado = {
  lentes: Record<string, LenteResultado>;
  meta: {
    total_fontes: number;
    corte: number;
    regioes: string[];
    fontes: FonteRef[];
    convergencias_fortes: number;
    divergencias: number;
    especificos: number;
    motor?: string;
    origem?: string;
    arquivo?: string;
  };
};


const STOP = new Set([
  "para","com","que","dos","das","the","and","por","uma","como","mais","não","nao","tem","são","sao","está","esta",
  "pela","pelo","este","essa","esse","isso","muito","sobre","entre","quando","porque","também","tambem","cliente","clientes",
]);

export function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(s: string): Set<string> {
  return new Set(
    norm(s)
      .split(" ")
      .filter(t => t.length >= 4 && !STOP.has(t)),
  );
}

function similar(a: string, b: string): boolean {
  const na = norm(a);
  const nb = norm(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.includes(nb) || nb.includes(na)) return true;
  const ta = tokens(a);
  const tb = tokens(b);
  if (!ta.size || !tb.size) return false;
  let inter = 0;
  ta.forEach(t => { if (tb.has(t)) inter++; });
  const jac = inter / (ta.size + tb.size - inter);
  return jac >= 0.45;
}

type Entry = { texto: string; fonte: FonteRef; fala: string | null; campo: string };
type Grupo = { textos: string[]; entradas: Entry[]; campo: string };

function agrupar(entradas: Entry[]): Grupo[] {
  const grupos: Grupo[] = [];
  for (const e of entradas) {
    const g = grupos.find(x => x.textos.some(t => similar(t, e.texto)));
    if (g) {
      g.textos.push(e.texto);
      g.entradas.push(e);
    } else {
      grupos.push({ textos: [e.texto], entradas: [e], campo: e.campo });
    }
  }
  return grupos;
}

function fonteRef(f: FonteInput): FonteRef {
  return {
    id: f.id,
    nome: f.pessoa || f.titulo,
    regiao: f.regiao,
    perfil: f.perfil_carteira,
    tipo: f.tipo,
  };
}

function fontesUnicas(entradas: Entry[]): FonteRef[] {
  const seen = new Map<string, FonteRef>();
  for (const e of entradas) if (!seen.has(e.fonte.id)) seen.set(e.fonte.id, e.fonte);
  return [...seen.values()];
}

function textoRepresentativo(g: Grupo): string {
  // O texto mais curto que ainda carrega o sentido é o mais legível no painel.
  return [...g.textos].sort((a, b) => a.length - b.length)[Math.min(1, g.textos.length - 1)] ?? g.textos[0];
}

export function corteMaioria(total: number): number {
  return Math.max(2, Math.ceil(total / 2));
}

export function consolidar(fontes: FonteInput[], corteOverride?: number): SinteseResultado {
  const total = fontes.length;
  const corte = corteOverride && corteOverride > 0 ? corteOverride : corteMaioria(total);
  const lentes: Record<string, LenteResultado> = {};
  let cFortes = 0;
  let cDiv = 0;
  let cEsp = 0;

  for (const lente of LENTES) {
    const def = LENTE_DEF[lente];
    const porCampo = new Map<string, Entry[]>();

    for (const f of fontes) {
      const l = f.lentes[lente];
      if (!l) continue;
      const ref = fonteRef(f);
      const fala = l.highlights?.[0] ?? null;
      for (const campo of def.campos) {
        if (campo.key === "evidencia") continue;
        const vals = toValues((l.sintese_campos ?? {})[campo.key]);
        for (const v of vals) {
          const arr = porCampo.get(campo.key) ?? [];
          arr.push({ texto: v, fonte: ref, fala, campo: campo.key });
          porCampo.set(campo.key, arr);
        }
      }
    }

    const convergencia: ItemConvergencia[] = [];
    const especifico: ItemEspecifico[] = [];
    const divergencia: ItemDivergencia[] = [];
    const gruposPorCampo = new Map<string, Grupo[]>();

    for (const [campo, entradas] of porCampo) {
      const grupos = agrupar(entradas);
      gruposPorCampo.set(campo, grupos);
      const def_campo = def.campos.find(c => c.key === campo);

      for (const g of grupos) {
        const refs = fontesUnicas(g.entradas);
        const peso = refs.length;
        if (peso >= corte && peso >= 2) {
          const perfis = new Set(refs.map(r => norm(r.perfil ?? "")).filter(Boolean));
          convergencia.push({
            texto: textoRepresentativo(g),
            campo,
            peso,
            total,
            fala_representativa: g.entradas.find(e => e.fala)?.fala ?? null,
            fontes: refs,
            reforcada: perfis.size >= 2,
          });
        } else if (peso === 1) {
          const e = g.entradas[0];
          especifico.push({ texto: e.texto, campo, fonte: e.fonte.nome, fonteId: e.fonte.id, regiao: e.fonte.regiao });
        }
      }

      // Divergência em campo de opinião: grupos distintos = leituras distintas.
      if (def_campo?.opiniao && grupos.length >= 2) {
        divergencia.push({
          tema: def_campo.label,
          posicoes: grupos.slice(0, 6).map(g => {
            const e = g.entradas[0];
            return {
              posicao: textoRepresentativo(g),
              campo,
              fonte: e.fonte.nome,
              fonteId: e.fonte.id,
              regiao: e.fonte.regiao,
              fala: e.fala,
            };
          }),
        });
      }
    }

    // Divergência por oposição de campos (mesmo objeto lido de formas opostas).
    for (const [a, b] of def.oposicoes ?? []) {
      const ga = gruposPorCampo.get(a) ?? [];
      const gb = gruposPorCampo.get(b) ?? [];
      for (const x of ga) {
        for (const y of gb) {
          if (!x.textos.some(t => y.textos.some(u => similar(t, u)))) continue;
          const ex = x.entradas[0];
          const ey = y.entradas[0];
          if (ex.fonte.id === ey.fonte.id) continue;
          divergencia.push({
            tema: textoRepresentativo(x),
            posicoes: [
              { posicao: `${def.campos.find(c => c.key === a)?.label}: ${ex.texto}`, campo: a, fonte: ex.fonte.nome, fonteId: ex.fonte.id, regiao: ex.fonte.regiao, fala: ex.fala },
              { posicao: `${def.campos.find(c => c.key === b)?.label}: ${ey.texto}`, campo: b, fonte: ey.fonte.nome, fonteId: ey.fonte.id, regiao: ey.fonte.regiao, fala: ey.fala },
            ],
          });
        }
      }
    }

    convergencia.sort((x, y) => y.peso - x.peso);

    let acao: LenteResultado["acao_convergente"] = null;
    if (def.acaoCampo) {
      const grupos = (gruposPorCampo.get(def.acaoCampo) ?? []).map(g => ({ g, refs: fontesUnicas(g.entradas) }));
      grupos.sort((a, b) => b.refs.length - a.refs.length);
      const top = grupos[0];
      if (top && top.refs.length >= 2) {
        acao = { texto: textoRepresentativo(top.g), peso: top.refs.length, fontes: top.refs };
      }
    }
    if (!acao && convergencia[0]) {
      acao = { texto: convergencia[0].texto, peso: convergencia[0].peso, fontes: convergencia[0].fontes };
    }

    cFortes += convergencia.length;
    cDiv += divergencia.length;
    cEsp += especifico.length;

    lentes[lente] = { convergencia, divergencia: divergencia.slice(0, 12), especifico, acao_convergente: acao };
  }

  const regioes = [...new Set(fontes.map(f => (f.regiao ?? "").trim()).filter(Boolean))];

  return {
    lentes,
    meta: {
      total_fontes: total,
      corte,
      regioes,
      fontes: fontes.map(fonteRef),
      convergencias_fortes: cFortes,
      divergencias: cDiv,
      especificos: cEsp,
    },
  };
}

export type LenteKey = Lente;
