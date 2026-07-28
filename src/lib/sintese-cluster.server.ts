/**
 * Motor de consolidação v2 — clustering SEMÂNTICO por tema, lente a lente.
 *
 * Regras estruturais (não negociáveis):
 * - Agrupa por TEMA, nunca por nome de campo.
 * - Convergência = tema sustentado por >= corte fontes, com palavras diferentes.
 * - Divergência = posições opostas/em tensão sobre o MESMO objeto.
 * - Específico = tema de uma única fonte que não entrou em convergência nem divergência.
 * - Um tema aparece em UM único bloco: zero duplicação.
 * - Toda fala citada tem de sustentar AQUELE ponto (vem dos highlights das fontes do ponto).
 */
import { LENTE_DEF, LENTES, toValues, type Lente } from "@/lib/insight-lentes";
import type {
  FonteInput,
  FonteRef,
  ItemConvergencia,
  ItemDivergencia,
  ItemEspecifico,
  LenteResultado,
  SinteseResultado,
} from "@/lib/sintese-engine";
import { corteMaioria } from "@/lib/sintese-engine";

const MODEL = "google/gemini-3.6-flash";

function ref(f: FonteInput): FonteRef {
  return { id: f.id, nome: f.pessoa || f.titulo, regiao: f.regiao, perfil: f.perfil_carteira, tipo: f.tipo };
}

function norm(s: string) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

type LenteInput = {
  lente: Lente;
  fontes: FonteInput[];
  payload: { fonte: string; fonteId: string; regiao: string | null; perfil: string | null; leituras: Record<string, string[]>; highlights: string[] }[];
};

function montarInput(lente: Lente, fontes: FonteInput[]): LenteInput {
  const def = LENTE_DEF[lente];
  const payload = fontes
    .map(f => {
      const l = f.lentes[lente];
      const leituras: Record<string, string[]> = {};
      for (const campo of def.campos) {
        const vals = toValues((l?.sintese_campos ?? {})[campo.key]);
        if (vals.length) leituras[campo.label] = vals;
      }
      if (l?.leitura_estrategica) leituras["Leitura estratégica"] = [l.leitura_estrategica];
      return {
        fonte: f.pessoa || f.titulo,
        fonteId: f.id,
        regiao: f.regiao,
        perfil: f.perfil_carteira,
        leituras,
        highlights: l?.highlights ?? [],
      };
    })
    .filter(p => Object.keys(p.leituras).length || p.highlights.length);
  return { lente, fontes, payload };
}

function prompt(input: LenteInput, corte: number): string {
  const def = LENTE_DEF[input.lente];
  return `Você recebe as leituras de ${input.payload.length} fontes sobre a lente "${def.label}" (${def.descricao}).

Sua tarefa é ANALISAR e SINTETIZAR, não listar. Agrupe por TEMA, nunca por nome de campo.

Definições obrigatórias:
- convergencias: um tema afirmado por pelo menos ${corte} fontes, MESMO COM PALAVRAS DIFERENTES (equivalência semântica, não textual). Cada convergência é UMA frase sintetizada que resume o tema (máx. 140 caracteres), com as fontes que a sustentam.
- divergencias: fontes que afirmam coisas OPOSTAS ou em tensão sobre o MESMO objeto. Uma divergência = um objeto em disputa, com as posições atribuídas. Não crie divergência só porque as fontes deram respostas diferentes em campos diferentes.
- especificos: tema que aparece em UMA só fonte e não tem equivalente nas demais.

Regras absolutas:
1. Um tema aparece em UM ÚNICO bloco. Se entrou em convergência ou divergência, NÃO pode reaparecer em específico.
2. Nunca invente. Todo item cita os fonteId de origem, que devem existir na entrada.
3. Cada "fala" deve ser um highlight literal das fontes que sustentam AQUELE ponto específico. Se nenhum highlight sustentar o ponto, use null. Nunca repita a mesma fala em pontos diferentes.
4. Nunca cite valores monetários absolutos — use percentuais, faixas ou faróis.
5. Seja econômico: no máximo 8 convergências, 6 divergências e 8 específicos por lente. Específicos devem ser poucos e realmente únicos.

Entrada (JSON):
${JSON.stringify(input.payload).slice(0, 90000)}

Retorne SOMENTE JSON neste formato:
{
 "convergencias": [{"tema":"frase sintetizada","fonteIds":["..."],"fala_representativa":"highlight literal ou null","fala_fonteId":"id da fonte da fala ou null"}],
 "divergencias": [{"objeto":"o objeto em disputa","posicoes":[{"fonteId":"...","resumo":"posição em 1 frase","fala":"highlight literal ou null"}]}],
 "especificos": [{"tema":"...","fonteId":"..."}],
 "acao_convergente": {"texto":"ação prática convergente ou null","fonteIds":["..."]}
}`;
}

async function chamarIA(body: string, key: string): Promise<any | null> {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body,
  });
  if (res.status === 429) throw new Error("Limite de uso IA atingido. Tente novamente em instantes.");
  if (res.status === 402) throw new Error("Créditos de IA esgotados. Adicione créditos na workspace.");
  if (!res.ok) return null;
  const json = await res.json();
  try {
    return JSON.parse(json.choices?.[0]?.message?.content ?? "{}");
  } catch {
    return null;
  }
}

export async function clusterizar(fontes: FonteInput[], corteOverride?: number): Promise<SinteseResultado | null> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key || !fontes.length) return null;

  const total = fontes.length;
  const corte = corteOverride && corteOverride > 0 ? corteOverride : corteMaioria(total);
  const refs = new Map(fontes.map(f => [f.id, ref(f)]));

  const resultados = await Promise.all(
    LENTES.map(async lente => {
      const input = montarInput(lente, fontes);
      if (!input.payload.length) return [lente, vazio()] as const;
      const parsed = await chamarIA(
        JSON.stringify({
          model: MODEL,
          messages: [
            { role: "system", content: "Você é analista sênior de inteligência comercial e retorna somente JSON válido." },
            { role: "user", content: prompt(input, corte) },
          ],
          response_format: { type: "json_object" },
        }),
        key,
      );
      if (!parsed) return [lente, vazio()] as const;
      return [lente, mapear(parsed, refs, total, corte)] as const;
    }),
  );

  const lentes: Record<string, LenteResultado> = {};
  let cFortes = 0;
  let cDiv = 0;
  let cEsp = 0;
  for (const [lente, r] of resultados) {
    lentes[lente] = r;
    cFortes += r.convergencia.length;
    cDiv += r.divergencia.length;
    cEsp += r.especifico.length;
  }

  if (cFortes === 0 && cDiv === 0 && cEsp === 0) return null;

  return {
    lentes,
    meta: {
      total_fontes: total,
      corte,
      regioes: [...new Set(fontes.map(f => (f.regiao ?? "").trim()).filter(Boolean))],
      fontes: fontes.map(ref),
      convergencias_fortes: cFortes,
      divergencias: cDiv,
      especificos: cEsp,
      motor: "ia_v2",
    },
  };
}

function vazio(): LenteResultado {
  return { convergencia: [], divergencia: [], especifico: [], acao_convergente: null };
}

function mapear(parsed: any, refs: Map<string, FonteRef>, total: number, corte: number): LenteResultado {
  const usadas = new Set<string>();
  const temasUsados = new Set<string>();

  const convergencia: ItemConvergencia[] = [];
  for (const c of Array.isArray(parsed?.convergencias) ? parsed.convergencias : []) {
    const texto = String(c?.tema ?? "").trim();
    if (!texto) continue;
    const fontes = [...new Set((Array.isArray(c?.fonteIds) ? c.fonteIds : []).map(String))]
      .map(id => refs.get(id as string))
      .filter(Boolean) as FonteRef[];
    if (fontes.length < Math.min(corte, 2)) continue;
    const fala = typeof c?.fala_representativa === "string" && c.fala_representativa.trim() ? c.fala_representativa.trim() : null;
    if (fala && usadas.has(norm(fala))) continue;
    if (fala) usadas.add(norm(fala));
    temasUsados.add(norm(texto));
    const perfis = new Set(fontes.map(f => norm(f.perfil ?? "")).filter(Boolean));
    const falaFonte = refs.get(String(c?.fala_fonteId ?? "")) ?? fontes[0];
    convergencia.push({
      texto,
      campo: "tema",
      peso: fontes.length,
      total,
      fala_representativa: fala,
      fontes,
      reforcada: perfis.size >= 2,
      evidencias: fala ? [{ fonteId: falaFonte?.id ?? "", fonte: falaFonte?.nome ?? "", regiao: falaFonte?.regiao ?? null, fala }] : [],
    });
  }

  const divergencia: ItemDivergencia[] = [];
  for (const d of Array.isArray(parsed?.divergencias) ? parsed.divergencias : []) {
    const tema = String(d?.objeto ?? d?.tema ?? "").trim();
    const posicoes = (Array.isArray(d?.posicoes) ? d.posicoes : [])
      .map((p: any) => {
        const r = refs.get(String(p?.fonteId ?? ""));
        if (!r) return null;
        const fala = typeof p?.fala === "string" && p.fala.trim() && !usadas.has(norm(p.fala)) ? p.fala.trim() : null;
        if (fala) usadas.add(norm(fala));
        return {
          posicao: String(p?.resumo ?? p?.posicao ?? "").trim(),
          campo: "tema",
          fonte: r.nome,
          fonteId: r.id,
          regiao: r.regiao,
          fala,
        };
      })
      .filter((p: any) => p && p.posicao);
    if (!tema || posicoes.length < 2) continue;
    temasUsados.add(norm(tema));
    divergencia.push({ tema, posicoes });
  }

  const especifico: ItemEspecifico[] = [];
  for (const e of Array.isArray(parsed?.especificos) ? parsed.especificos : []) {
    const texto = String(e?.tema ?? e?.texto ?? "").trim();
    const r = refs.get(String(e?.fonteId ?? ""));
    if (!texto || !r) continue;
    const n = norm(texto);
    if (temasUsados.has(n)) continue;
    if ([...temasUsados].some(t => t.includes(n) || n.includes(t))) continue;
    temasUsados.add(n);
    especifico.push({ texto, campo: "tema", fonte: r.nome, fonteId: r.id, regiao: r.regiao });
  }

  convergencia.sort((a, b) => b.peso - a.peso);

  const acaoTexto = String(parsed?.acao_convergente?.texto ?? "").trim();
  const acaoFontes = (Array.isArray(parsed?.acao_convergente?.fonteIds) ? parsed.acao_convergente.fonteIds : [])
    .map((id: any) => refs.get(String(id)))
    .filter(Boolean) as FonteRef[];
  const acao =
    acaoTexto && acaoTexto.toLowerCase() !== "null"
      ? { texto: acaoTexto, peso: acaoFontes.length || convergencia[0]?.peso || 1, fontes: acaoFontes.length ? acaoFontes : (convergencia[0]?.fontes ?? []) }
      : convergencia[0]
        ? { texto: convergencia[0].texto, peso: convergencia[0].peso, fontes: convergencia[0].fontes }
        : null;

  return { convergencia: convergencia.slice(0, 8), divergencia: divergencia.slice(0, 6), especifico: especifico.slice(0, 8), acao_convergente: acao };
}
