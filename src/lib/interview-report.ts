import jsPDF from "jspdf";
import { supabase } from "@/integrations/supabase/client";
import { CLASSIFICACOES, TIPOS_EMPRESA } from "@/lib/interview-questions";

const CLASSIF = Object.fromEntries(CLASSIFICACOES.map((c) => [c.value, c.label]));
const TIPO = Object.fromEntries(TIPOS_EMPRESA.map((t) => [t.value, t.label]));

// Paleta editorial — alinhada à identidade poolFlux (dark navy + cyan elétrico)
export type ReportTheme = "dark" | "light";
type RGB = [number, number, number];

let BG: RGB = [6, 14, 26]; // background principal (near-black navy)
let SURFACE: RGB = [14, 26, 44]; // cartões / superfícies elevadas
let SURFACE_SOFT: RGB = [20, 36, 58];
let NAVY: RGB = [10, 20, 44];
let NAVY_SOFT: RGB = [180, 210, 235];
let CYAN: RGB = [0, 229, 255]; // primária
let CYAN_DEEP: RGB = [90, 220, 240];
let CORAL: RGB = [0, 229, 255]; // acentos remapeados para o cyan da marca
let INK: RGB = [232, 240, 250]; // texto principal
let MUTED: RGB = [130, 150, 175];
let HAIRLINE: RGB = [30, 50, 78];
let CREAM: RGB = [6, 14, 26]; // background das páginas
let HIGHLIGHT: RGB = [12, 40, 58]; // fundo de callouts

function applyTheme(theme: ReportTheme) {
  if (theme === "light") {
    BG = [255, 255, 255];
    SURFACE = [244, 248, 252];
    SURFACE_SOFT = [232, 240, 248];
    NAVY = [10, 20, 44];
    NAVY_SOFT = [60, 90, 120];
    CYAN = [0, 150, 180];
    CYAN_DEEP = [0, 120, 150];
    CORAL = [0, 150, 180];
    INK = [17, 24, 39];
    MUTED = [100, 116, 139];
    HAIRLINE = [205, 218, 230];
    CREAM = [255, 255, 255];
    HIGHLIGHT = [226, 243, 248];
    return;
  }
  BG = [6, 14, 26];
  SURFACE = [14, 26, 44];
  SURFACE_SOFT = [20, 36, 58];
  NAVY = [10, 20, 44];
  NAVY_SOFT = [180, 210, 235];
  CYAN = [0, 229, 255];
  CYAN_DEEP = [90, 220, 240];
  CORAL = [0, 229, 255];
  INK = [232, 240, 250];
  MUTED = [130, 150, 175];
  HAIRLINE = [30, 50, 78];
  CREAM = [6, 14, 26];
  HIGHLIGHT = [12, 40, 58];
}


import {
  drawCover,
  drawIntervieweePage,
  loadCoverImage,
  DEFAULT_TITULO,
  type CoverFields,
  type CoverTemplate,
  type IntervieweePageFields,
} from "./interview-cover";

export type ExportInterviewOptions = {
  cover?: Partial<CoverFields>;
  intervieweePage?: (IntervieweePageFields & { include: boolean; template?: CoverTemplate }) | null;
};


// Frases-destaque por entrevistado + ordem de capítulo.
// Chave: primeiro nome (lowercase, sem acento) do entrevistado.
const HIGHLIGHTS_BY_INTERVIEWEE: Record<string, Record<number, string[]>> = {
  salton: {
    1: [
      "A Standard precisa de um portfólio maior. Aí ela vai performar.",
      "Light designers, especificadores, projetos remunerados por RT e grandes contas de projeto: isso é um outro mercado, um baita mercado. É um volume que a gente não tem noção e que a gente não está surfando.",
    ],
    2: [
      "Tudo o que veio para a FIT10 nos últimos tempos está tecnicamente muito bom, em fluxo e em tudo o que entrega.",
    ],
    3: [
      "Não existia especificação de Usina. Hoje já chega projeto de arquiteto especificado com Usina.",
      "No caso da Interlight, é preço combinado com entrega.",
    ],
    4: [
      "A gente tem a Power Lume vendendo um perfil igual, super bom, por 20% mais barato.",
    ],
    5: [
      "O arquiteto gosta de ficar sabendo dos lançamentos e especifica, mas quem manda é o vendedor da loja.",
    ],
    6: [
      "Tem um cenário grande de marcenaria aqui no Rio Grande do Sul que a gente não está surfando. Se tiver uma fita para esses clientes, nesse tipo de negociação, aí funciona.",
    ],
    7: [
      "O principal concorrente da Newline é a própria Newline. Temos tudo para ganhar o jogo.",
    ],
  },
};

function getHighlightsFor(nome: string | null | undefined, ordem: number): string[] {
  if (!nome) return [];
  const key = nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .split(/\s+/)[0];
  return HIGHLIGHTS_BY_INTERVIEWEE[key]?.[ordem] ?? [];
}

export async function exportInterviewPdf(
  interviewId: string,

  optsOrCover?: ExportInterviewOptions | Partial<CoverFields>,
) {
  // Backwards-compat: se receber apenas CoverFields, trata como { cover }
  const opts: ExportInterviewOptions =
    optsOrCover && ("cover" in optsOrCover || "intervieweePage" in optsOrCover)
      ? (optsOrCover as ExportInterviewOptions)
      : { cover: optsOrCover as Partial<CoverFields> | undefined };
  const coverOverride = opts.cover;

  const { data: interview } = await supabase
    .from("interviews")
    .select("*")
    .eq("id", interviewId)
    .maybeSingle();
  if (!interview) throw new Error("Entrevista não encontrada");

  const [capsRes, respRes, notesRes, roteiroRes] = await Promise.all([
    interview.roteiro_id
      ? supabase
          .from("capitulos")
          .select("id, ordem, codigo, titulo, campos_matriz, lente_default, pergunta_abertura")
          .eq("roteiro_id", interview.roteiro_id)
          .order("ordem")
      : Promise.resolve({ data: [] as any[] }),
    supabase
      .from("sessao_capitulos")
      .select("capitulo_id, resposta_texto, leitura_estrategica, sintese")
      .eq("sessao_id", interviewId),
    supabase
      .from("session_notes")
      .select("author_name, content, created_at")
      .eq("entity_type", "interview")
      .eq("entity_id", interviewId)
      .order("created_at"),
    interview.roteiro_id
      ? supabase.from("roteiros").select("nome").eq("id", interview.roteiro_id).maybeSingle()
      : Promise.resolve({ data: null as any }),
  ]);

  const capitulos = capsRes.data ?? [];
  const respostas = respRes.data ?? [];
  const notes = notesRes.data ?? [];
  const roteiroNome = (roteiroRes as any)?.data?.nome ?? null;

  // Empresa "logada" (aparece como marca no topo do sumário)
  let activeCompanyName: string | null = null;
  try {
    const { data: u } = await supabase.auth.getUser();
    const uid = u.user?.id;
    if (uid) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("active_company_id")
        .eq("id", uid)
        .maybeSingle();
      if (profile?.active_company_id) {
        const { data: c } = await supabase
          .from("companies")
          .select("nome")
          .eq("id", profile.active_company_id)
          .maybeSingle();
        activeCompanyName = c?.nome ?? null;
      }
    }
  } catch {
    /* opcional */
  }

  const respByCap = new Map(respostas.map((r: any) => [r.capitulo_id, r]));

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 56;
  const maxW = pageW - margin * 2;
  let y = margin;

  const setFill = (c: [number, number, number]) => doc.setFillColor(c[0], c[1], c[2]);
  const setText = (c: [number, number, number]) => doc.setTextColor(c[0], c[1], c[2]);
  const setDraw = (c: [number, number, number]) => doc.setDrawColor(c[0], c[1], c[2]);

  // Sanitiza markdown vindo de relatórios (asteriscos, sublinhados, marcadores),
  // evitando que "**bold**" apareça literalmente no PDF.
  const ACCENT_CORRECTIONS: Record<string, string> = {
    acao: "ação",
    acoes: "ações",
    adequacao: "adequação",
    aderencia: "aderência",
    analise: "análise",
    anotacao: "anotação",
    anotacoes: "anotações",
    apendice: "apêndice",
    aplicacao: "aplicação",
    argumentacao: "argumentação",
    atencao: "atenção",
    ativacao: "ativação",
    automacao: "automação",
    avaliacao: "avaliação",
    basica: "básica",
    basicas: "básicas",
    basico: "básico",
    basicos: "básicos",
    capitulo: "capítulo",
    capitulos: "capítulos",
    citacao: "citação",
    citacoes: "citações",
    classificacao: "classificação",
    comunicacao: "comunicação",
    conclusao: "conclusão",
    consideracao: "consideração",
    consideracoes: "considerações",
    conteudo: "conteúdo",
    conteudos: "conteúdos",
    concorrencia: "concorrência",
    concorrencias: "concorrências",
    contribuicao: "contribuição",
    cotacao: "cotação",
    criterio: "critério",
    criterios: "critérios",
    critica: "crítica",
    criticas: "críticas",
    critico: "crítico",
    criticos: "críticos",
    decisao: "decisão",
    decisoes: "decisões",
    defensavel: "defensável",
    descricao: "descrição",
    diferenca: "diferença",
    diferencas: "diferenças",
    diferenciacao: "diferenciação",
    dificil: "difícil",
    dificeis: "difíceis",
    diagnostico: "diagnóstico",
    distribuicao: "distribuição",
    dominio: "domínio",
    economica: "econômica",
    economicas: "econômicas",
    economico: "econômico",
    economicos: "econômicos",
    eficiencia: "eficiência",
    enfase: "ênfase",
    especificacao: "especificação",
    especificacoes: "especificações",
    estrategia: "estratégia",
    estrategias: "estratégias",
    estrategica: "estratégica",
    estrategicas: "estratégicas",
    estrategico: "estratégico",
    estrategicos: "estratégicos",
    evidencia: "evidência",
    evidencias: "evidências",
    execucao: "execução",
    experiencia: "experiência",
    experiencias: "experiências",
    exposicao: "exposição",
    facil: "fácil",
    faceis: "fáceis",
    familia: "família",
    familias: "famílias",
    frequencia: "frequência",
    gestao: "gestão",
    historico: "histórico",
    hipotese: "hipótese",
    hipoteses: "hipóteses",
    informacao: "informação",
    informacoes: "informações",
    instalacao: "instalação",
    integracao: "integração",
    inteligencia: "inteligência",
    intencao: "intenção",
    lideranca: "liderança",
    logica: "lógica",
    manutencao: "manutenção",
    media: "média",
    metodo: "método",
    metrica: "métrica",
    metricas: "métricas",
    necessario: "necessário",
    necessaria: "necessária",
    necessarios: "necessários",
    necessarias: "necessárias",
    negociacao: "negociação",
    negociacoes: "negociações",
    nivel: "nível",
    niveis: "níveis",
    numero: "número",
    numeros: "números",
    objecao: "objeção",
    objecoes: "objeções",
    observacao: "observação",
    observacoes: "observações",
    ocorrencia: "ocorrência",
    ocorrencias: "ocorrências",
    operacao: "operação",
    operacoes: "operações",
    opiniao: "opinião",
    opinioes: "opiniões",
    pagina: "página",
    paginas: "páginas",
    padrao: "padrão",
    padroes: "padrões",
    percepcao: "percepção",
    percepcoes: "percepções",
    periodo: "período",
    periodos: "períodos",
    politica: "política",
    politicas: "políticas",
    possivel: "possível",
    possiveis: "possíveis",
    potencia: "potência",
    pratica: "prática",
    praticas: "práticas",
    pratico: "prático",
    praticos: "práticos",
    preco: "preço",
    precos: "preços",
    precificacao: "precificação",
    presenca: "presença",
    primario: "primário",
    prioritaria: "prioritária",
    prioritarias: "prioritárias",
    prioritario: "prioritário",
    prioritarios: "prioritários",
    priorizacao: "priorização",
    producao: "produção",
    proximo: "próximo",
    proximos: "próximos",
    proxima: "próxima",
    proximas: "próximas",
    publico: "público",
    publicos: "públicos",
    publica: "pública",
    publicas: "públicas",
    rapida: "rápida",
    rapidas: "rápidas",
    rapido: "rápido",
    rapidos: "rápidos",
    reativacao: "reativação",
    recomendacao: "recomendação",
    recomendacoes: "recomendações",
    referencia: "referência",
    referencias: "referências",
    relacao: "relação",
    relacoes: "relações",
    relatorio: "relatório",
    relatorios: "relatórios",
    restricao: "restrição",
    revisao: "revisão",
    saudacoes: "saudações",
    secundaria: "secundária",
    secundarias: "secundárias",
    secundario: "secundário",
    secundarios: "secundários",
    secao: "seção",
    secoes: "seções",
    sequencia: "sequência",
    servico: "serviço",
    servicos: "serviços",
    sessao: "sessão",
    sessoes: "sessões",
    sintese: "síntese",
    sinteses: "sínteses",
    situacao: "situação",
    situacoes: "situações",
    solucao: "solução",
    solucoes: "soluções",
    sugestao: "sugestão",
    sugestoes: "sugestões",
    tecnica: "técnica",
    tecnicas: "técnicas",
    tecnico: "técnico",
    tecnicos: "técnicos",
    tendencia: "tendência",
    tendencias: "tendências",
    unico: "único",
    unica: "única",
    usuario: "usuário",
    usuarios: "usuários",
    validacao: "validação",
    versao: "versão",
    visao: "visão",
    nao: "não",
  };

  const applyCase = (source: string, replacement: string) => {
    if (source === source.toUpperCase()) return replacement.toUpperCase();
    if (source[0] === source[0].toUpperCase()) {
      return replacement.charAt(0).toUpperCase() + replacement.slice(1);
    }
    return replacement;
  };

  const applyPortugueseAccents = (text: string): string => {
    const letter = "A-Za-zÀ-ÖØ-öø-ÿ";
    return Object.entries(ACCENT_CORRECTIONS)
      .sort(([a], [b]) => b.length - a.length)
      .reduce((out, [source, replacement]) => {
        const re = new RegExp(`(^|[^${letter}])(${source})(?=$|[^${letter}])`, "gi");
        return out.replace(re, (_full, prefix: string, word: string) => `${prefix}${applyCase(word, replacement)}`);
      }, text);
  };

  const md = (s?: string | null): string => {
    if (!s) return "";
    return applyPortugueseAccents(String(s)
      .replace(/\r\n?/g, "\n")
      .replace(/`{1,3}([^`]+)`{1,3}/g, "$1")
      .replace(/\*\*\*([^*]+)\*\*\*/g, "$1")
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/(?<!\w)_([^_\n]+)_(?!\w)/g, "$1")
      .replace(/(?<!\w)\*([^*\n]+)\*(?!\w)/g, "$1")
      .replace(/^\s{0,3}#{1,6}\s+/gm, "")
      .replace(/^\s{0,3}[-*+]\s+/gm, "• ")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim());
  };

  // Condensa um texto para ~ratio do tamanho original, mantendo as frases
  // mais informativas na ordem original (síntese mais objetiva).
  const condense = (s?: string | null, ratio = 0.5): string => {
    const src = (s ?? "").trim();
    if (!src) return "";
    const sentences = src
      .split(/(?<=[.!?;])\s+(?=[A-ZÀ-ÖØ-Þ0-9"“(])/)
      .map((t) => t.trim())
      .filter(Boolean);
    if (sentences.length <= 2) return src;

    const budget = Math.max(160, Math.round(src.length * ratio));
    const stop = new Set([
      "a","o","as","os","de","da","do","das","dos","e","em","um","uma","que","para",
      "com","por","no","na","nos","nas","se","ao","à","às","aos","é","são","ou","mas",
      "como","mais","menos","muito","também","já","ser","está","foi","essa","esse",
      "isso","este","esta","seu","sua","seus","suas","nao","não","há","pelo","pela",
    ]);
    const freq = new Map<string, number>();
    const words = (t: string) =>
      t.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter((w) => w.length > 3 && !stop.has(w));
    for (const sen of sentences) for (const w of words(sen)) freq.set(w, (freq.get(w) ?? 0) + 1);

    const scored = sentences.map((text, i) => {
      const ws = words(text);
      const base = ws.reduce((acc, w) => acc + (freq.get(w) ?? 0), 0) / Math.max(1, ws.length);
      // leve preferência pelas primeiras frases (abertura costuma trazer o retrato geral)
      const position = i === 0 ? 1.25 : i < 3 ? 1.08 : 1;
      return { i, text, score: base * position };
    });

    const picked = new Set<number>();
    let len = 0;
    for (const s of [...scored].sort((a, b) => b.score - a.score)) {
      if (len && len + s.text.length + 1 > budget) continue;
      picked.add(s.i);
      len += s.text.length + 1;
      if (len >= budget) break;
    }
    if (!picked.size) picked.add(0);
    return sentences.filter((_, i) => picked.has(i)).join(" ").trim();
  };


  const contentBottom = () => pageH - margin - 44;

  const ensure = (n: number) => {
    if (y + n > contentBottom()) {
      addContentPage();
    }
  };

  const write = (
    text: string,
    size = 10,
    style: "normal" | "bold" | "italic" = "normal",
    color: [number, number, number] = INK,
    opts: { width?: number; x?: number; lineHeight?: number } = {},
  ) => {
    doc.setFont("helvetica", style);
    doc.setFontSize(size);
    setText(color);
    const w = opts.width ?? maxW;
    const x = opts.x ?? margin;
    const lh = opts.lineHeight ?? size * 1.35;
    const lines = doc.splitTextToSize(applyPortugueseAccents(text || "—"), w);
    for (const l of lines) {
      ensure(lh);
      doc.text(l, x, y);
      y += lh;
    }
  };
  // ————————————————————————— CAPA (modelo "Visão de Mercado") —————————————————————————
  // Paleta específica da capa — replica fiel da referência
  const coverImg = await loadCoverImage();
  const coverFields: CoverFields = {
    data:
      coverOverride?.data ??
      (interview.data_entrevista
        ? new Date(interview.data_entrevista).toLocaleDateString("pt-BR", {
            month: "long",
            year: "numeric",
          })
        : new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" })),
    titulo: coverOverride?.titulo ?? DEFAULT_TITULO,
    entrevistado: coverOverride?.entrevistado ?? interview.entrevistado_nome ?? "—",
    modelo: coverOverride?.modelo ?? roteiroNome ?? "—",
    template: coverOverride?.template,
  };
  drawCover(doc, coverImg, coverFields);

  // ————————————————————————— PÁGINA DE APRESENTAÇÃO DO ENTREVISTADO —————————————————————————
  const includeInterviewee = !!opts.intervieweePage?.include;
  if (includeInterviewee) {
    doc.addPage();
    await drawIntervieweePage(doc, coverImg, {
      photoDataUrl: opts.intervieweePage?.photoDataUrl ?? null,
      name: opts.intervieweePage?.name || interview.entrevistado_nome || "—",
      template: opts.intervieweePage?.template ?? coverOverride?.template,
    });


  }
  const headerStartPage = includeInterviewee ? 3 : 2;





  // ————————————————————————— PÁGINA DE ABERTURA / SUMÁRIO —————————————————————————
  const addContentPage = () => {
    doc.addPage();
    setFill(CREAM);
    doc.rect(0, 0, pageW, pageH, "F");
    // faixa lateral
    setFill(NAVY);
    doc.rect(0, 0, 6, pageH, "F");
    setFill(CYAN);
    doc.rect(0, 0, 6, 120, "F");
    y = margin + 10;
  };


  const writeCalloutBlock = (label: string, value?: string | null) => {
    const text = md(value);
    if (!text) return;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);
    const lineH = 16;
    const lines = doc.splitTextToSize(text, maxW - 40);
    let index = 0;
    let continued = false;

    while (index < lines.length) {
      ensure(70);
      const headerH = 44;
      let availableLines = Math.floor((contentBottom() - y - headerH - 12) / lineH);
      if (availableLines < 1) {
        addContentPage();
        availableLines = Math.floor((contentBottom() - y - headerH - 12) / lineH);
      }

      const chunk = lines.slice(index, index + Math.max(1, availableLines));
      const blockH = headerH + chunk.length * lineH + 12;

      setFill(HIGHLIGHT);
      doc.roundedRect(margin, y, maxW, blockH, 6, 6, "F");
      setFill(CYAN);
      doc.rect(margin, y, 4, blockH, "F");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      setText(CYAN_DEEP);
      doc.text(continued ? `${label} · CONTINUAÇÃO` : label, margin + 20, y + 22, {
        charSpace: 1.5,
      });

      doc.setFont("helvetica", "normal");
      doc.setFontSize(12);
      setText(INK);
      let ly = y + 44;
      for (const line of chunk) {
        doc.text(line, margin + 20, ly);
        ly += lineH;
      }

      index += chunk.length;
      y += blockH + 20;
      continued = true;
      if (index < lines.length) addContentPage();
    }
  };

  const FIELD_LABELS: Record<string, string> = {
    acao_sugerida: "Ação sugerida",
    ameaca: "Ameaça",
    argumento_usado: "Argumento usado",
    categorias_onde_ganha: "Categorias onde ganha",
    checou_tabela: "Checou tabela",
    concorrente: "Concorrente",
    criterio_declarado: "Critério declarado",
    criterio_revelado: "Critério revelado",
    cuidado: "Cuidado",
    decisao_mencionada: "Decisão mencionada",
    evidencia: "Evidência",
    impacto_relatado: "Impacto relatado",
    motivo: "Motivo",
    o_que_funciona: "O que funciona",
    o_que_nao_funciona: "O que não funciona",
    objecao: "Objeção",
    oportunidade: "Oportunidade",
    percepcao_preco: "Percepção de preço",
    produto: "Produto",
    qualidade_argumento: "Qualidade do argumento",
    sinal_autonomia: "Sinal de autonomia",
    sinal_de_conflito: "Sinal de conflito",
    skus_adormecidos: "SKUs adormecidos",
    top_of_mind: "Top of mind",
    valor_defensavel: "Valor defensável",
    percepcao_marca: "Percepção de marca",
    relato_livre: "Relato livre",
    evidencias: "Evidências",
  };
  const prettyLabel = (key: string) =>
    FIELD_LABELS[key] ?? applyPortugueseAccents(key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()));

  const writeMatrixField = (label: string, value?: string | null) => {
    const text = md(value) || "—";
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    const lineH = 13;
    const lines = doc.splitTextToSize(text, maxW - 24);
    let index = 0;
    let continued = false;

    while (index < lines.length) {
      ensure(52);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      const rawLabel = `${prettyLabel(label)}${continued ? " (continuação)" : ""}`
        .toUpperCase();

      const labelLines = doc.splitTextToSize(rawLabel, maxW - 24).slice(0, 2);
      const labelH = 18 + labelLines.length * 11;
      let availableLines = Math.floor((contentBottom() - y - labelH - 12) / lineH);
      if (availableLines < 1) {
        addContentPage();
        availableLines = Math.floor((contentBottom() - y - labelH - 12) / lineH);
      }

      const chunk = lines.slice(index, index + Math.max(1, availableLines));
      const rowH = Math.max(42, labelH + chunk.length * lineH + 12);

      setFill(CORAL);
      doc.rect(margin, y + 4, 3, rowH - 8, "F");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      setText(INK);
      let labelY = y + 16;
      for (const line of labelLines) {
        doc.text(line, margin + 12, labelY, { charSpace: 0.8 });
        labelY += 11;
      }

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      setText(INK);
      let ly = y + labelH;
      for (const line of chunk) {
        doc.text(line, margin + 12, ly);
        ly += lineH;
      }

      y += rowH + 4;
      setDraw(HAIRLINE);
      doc.setLineWidth(0.3);
      doc.line(margin, y, margin + maxW, y);
      y += 4;
      index += chunk.length;
      continued = true;
      if (index < lines.length) addContentPage();
    }
  };

  addContentPage();

  // Marca da empresa "logada" (equivalente ao logo newline da referência)
  const brandName = (activeCompanyName || "").trim();
  if (brandName) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(34);
    setText(INK);
    doc.text(brandName, margin, y + 12);
    y += 30;
  } else {
    y += 6;
  }

  // Linha decorativa curta em cyan
  setDraw(CYAN);
  doc.setLineWidth(2.5);
  doc.line(margin, y + 8, margin + 44, y + 8);
  y += 28;

  // Cartão elevado com título do sumário
  const cardTop = y;
  const cardH = 150;
  setFill(SURFACE);
  doc.roundedRect(margin, cardTop, maxW, cardH, 10, 10, "F");
  setDraw(HAIRLINE);
  doc.setLineWidth(0.5);
  doc.roundedRect(margin, cardTop, maxW, cardH, 10, 10, "S");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  setText(CYAN);
  doc.text("SUMÁRIO EXECUTIVO", margin + 28, cardTop + 46, { charSpace: 2 });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(26);
  setText(INK);
  doc.text("O que esta entrevista apresenta", margin + 28, cardTop + 88);

  y = cardTop + cardH + 32;

  // Sumário Executivo (opcional) — vem do ingest do "Relatório final"
  const sumario = ((interview.respostas as any)?.__sumario_executivo__ ?? null) as
    | {
        sintese_geral?: string;
        sinais_prioritarios?: Array<{ key: string; value: string }>;
        risco_estrategico?: string;
        agenda_prioritaria?: Array<{ key: string; value: string }>;
        sintese_final?: string;
      }
    | null;
  const hasSumario = !!(
    sumario &&
    (sumario.sintese_geral ||
      sumario.risco_estrategico ||
      sumario.sintese_final ||
      sumario.sinais_prioritarios?.length ||
      sumario.agenda_prioritaria?.length)
  );

  // Navegação
  if (capitulos.length) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    setText(CYAN);
    doc.text("NAVEGAÇÃO", margin, y, { charSpace: 2 });
    y += 8;
    setDraw(HAIRLINE);
    doc.setLineWidth(0.5);
    doc.line(margin, y, margin + maxW, y);
    y += 16;

    const navItems: Array<{ ordem: string; titulo: string; lente?: string | null }> = [];
    if (hasSumario) navItems.push({ ordem: "00", titulo: "Sumário executivo" });
    for (const cap of capitulos as any[]) {
      navItems.push({
        ordem: String(cap.ordem).padStart(2, "0"),
        titulo: cap.titulo,
        lente: cap.lente_default,
      });
    }

    navItems.forEach((item) => {
      ensure(34);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      setText(CYAN);
      doc.text(item.ordem, margin, y + 4);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      setText(INK);
      doc.text(applyPortugueseAccents(item.titulo), margin + 44, y);

      if (item.lente) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        setText(MUTED);
        doc.text(`lente · ${prettyLabel(String(item.lente)).toLowerCase()}`, margin + 44, y + 12, { charSpace: 0.5 });
      }

      setDraw(HAIRLINE);
      doc.setLineWidth(0.3);
      doc.line(margin, y + 22, margin + maxW, y + 22);
      y += 30;
    });
  }



  // ————————————————————————— PANORAMA (dashboard visual) —————————————————————————
  const totalCaps = capitulos.length;
  const capsRespondidos = capitulos.filter((c: any) => {
    const r: any = respByCap.get(c.id);
    return !!(
      r?.leitura_estrategica?.trim() ||
      r?.resposta_texto?.trim() ||
      (r?.sintese && Object.values(r.sintese as Record<string, string>).some((v) => v?.trim()))
    );
  }).length;
  const pctRespondidos = totalCaps ? Math.round((capsRespondidos / totalCaps) * 100) : 0;
  let campoTotal = 0;
  let campoFilled = 0;
  for (const c of capitulos as any[]) {
    const campos: string[] = Array.isArray(c.campos_matriz) ? c.campos_matriz : [];
    const r: any = respByCap.get(c.id);
    const s = (r?.sintese ?? {}) as Record<string, string>;
    campoTotal += campos.length;
    for (const k of campos) if (s[k]?.trim()) campoFilled++;
  }

  if (totalCaps) {
    addContentPage();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    setText(CYAN_DEEP);
    doc.text("PANORAMA", margin, y, { charSpace: 2 });
    y += 32;
    write("Sinais em foco.", 28, "bold", INK);
    y += 4;
    setDraw(CORAL);
    doc.setLineWidth(3);
    doc.line(margin, y, margin + 48, y);
    y += 28;

    if (hasSumario) {
      // Modelo novo — três cards: Sumário Executivo · Capítulos · Tabelas
      // Layout: coluna esquerda com número grande + eyebrow empilhados;
      // coluna direita com a headline centralizada verticalmente.
      const drawStatCard = (
        big: string,
        eyebrow: string,
        headline: string,
        variant: "surface" | "navy",
        eyebrowPos: "above" | "below",
      ) => {
        const cardH = 160;
        ensure(cardH + 16);
        const top = y;
        if (variant === "surface") {
          setFill(SURFACE);
          doc.roundedRect(margin, top, maxW, cardH, 10, 10, "F");
          setDraw(HAIRLINE);
          doc.setLineWidth(0.5);
          doc.roundedRect(margin, top, maxW, cardH, 10, 10, "S");
        } else {
          setFill(NAVY);
          doc.roundedRect(margin, top, maxW, cardH, 10, 10, "F");
          setFill(CORAL);
          doc.roundedRect(margin, top, 8, cardH, 10, 10, "F");
          doc.rect(margin + 4, top, 4, cardH, "F");
        }

        // Coluna esquerda: número grande + eyebrow empilhados
        const leftPad = 32;
        const colLeftX = margin + leftPad;
        const colLeftW = 200;

        // Auto-fit do número grande
        doc.setFont("helvetica", "bold");
        let bigSize = 64;
        doc.setFontSize(bigSize);
        while (doc.getTextWidth(big) > colLeftW - 8 && bigSize > 32) {
          bigSize -= 4;
          doc.setFontSize(bigSize);
        }

        const eyebrowSize = 8;
        const eyebrowGap = 10;
        const stackH = bigSize + eyebrowGap + eyebrowSize;
        const stackTop = top + (cardH - stackH) / 2;

        const eyebrowColor = variant === "navy" ? [160, 205, 220] as [number, number, number] : CYAN_DEEP;

        if (eyebrowPos === "above") {
          doc.setFont("helvetica", "bold");
          doc.setFontSize(eyebrowSize);
          setText(eyebrowColor);
          doc.text(eyebrow.toUpperCase(), colLeftX, stackTop + eyebrowSize, { charSpace: 2 });
          doc.setFont("helvetica", "bold");
          doc.setFontSize(bigSize);
          setText(CYAN);
          doc.text(big, colLeftX, stackTop + eyebrowSize + eyebrowGap + bigSize * 0.85);
        } else {
          doc.setFont("helvetica", "bold");
          doc.setFontSize(bigSize);
          setText(CYAN);
          doc.text(big, colLeftX, stackTop + bigSize * 0.85);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(eyebrowSize);
          setText(eyebrowColor);
          doc.text(eyebrow.toUpperCase(), colLeftX, stackTop + bigSize + eyebrowGap + eyebrowSize, { charSpace: 2 });
        }

        // Coluna direita: headline
        const tx = margin + leftPad + colLeftW + 24;
        const tw = maxW - (tx - margin) - 24;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(15);
        setText(variant === "navy" ? [255, 255, 255] : INK);
        const lines = doc.splitTextToSize(headline, tw);
        const lineH = 20;
        const blockH = Math.min(lines.length, 3) * lineH;
        let ly = top + (cardH - blockH) / 2 + 14;
        for (const line of lines.slice(0, 3)) {
          doc.text(line, tx, ly);
          ly += lineH;
        }
        y = top + cardH + 16;
      };

      drawStatCard("1", "Sumário executivo", "Tudo resumido em uma página.", "surface", "below");
      drawStatCard(
        `${totalCaps} de ${totalCaps}`,
        "Capítulos",
        "Permitem acesso a uma visão mais detalhada e organizada por assuntos.",
        "navy",
        "above",
      );
      drawStatCard(
        `${campoFilled}`,
        "Tabelas",
        "Sintetizam as principais ideias de cada capítulo.",
        "surface",
        "below",
      );

    } else {
      // Modelo antigo (compatibilidade retroativa) — cobertura + tabelas
      const cardTop = y;
      const cardH = 240;
      setFill(SURFACE);
      doc.roundedRect(margin, cardTop, maxW, cardH, 10, 10, "F");
      setDraw(HAIRLINE);
      doc.setLineWidth(0.5);
      doc.roundedRect(margin, cardTop, maxW, cardH, 10, 10, "S");

      const ringCx = margin + 130;
      const ringCy = cardTop + cardH / 2;
      const ringR = 78;
      setDraw(HAIRLINE);
      doc.setLineWidth(10);
      doc.circle(ringCx, ringCy, ringR, "S");
      setDraw(CYAN);
      doc.setLineWidth(10);
      const steps = 96;
      const filledSteps = Math.round((pctRespondidos / 100) * steps);
      for (let i = 0; i < filledSteps; i++) {
        const a1 = -Math.PI / 2 + (i / steps) * Math.PI * 2;
        const a2 = -Math.PI / 2 + ((i + 1) / steps) * Math.PI * 2;
        doc.line(
          ringCx + Math.cos(a1) * ringR,
          ringCy + Math.sin(a1) * ringR,
          ringCx + Math.cos(a2) * ringR,
          ringCy + Math.sin(a2) * ringR,
        );
      }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(36);
      setText(INK);
      const pctStr = `${pctRespondidos}%`;
      const pctW = doc.getTextWidth(pctStr);
      doc.text(pctStr, ringCx - pctW / 2, ringCy + 6);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      setText(MUTED);
      const subStr = "COBERTURA";
      const subW = doc.getTextWidth(subStr);
      doc.text(subStr, ringCx - subW / 2, ringCy + 22, { charSpace: 1.2 });

      const txtX = margin + 250;
      const txtW = maxW - 270;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      setText(CYAN_DEEP);
      doc.text("DE COBERTURA DOS CAPÍTULOS", txtX, cardTop + 60, { charSpace: 1.5 });
      doc.setFont("helvetica", "bold");
      doc.setFontSize(20);
      setText(INK);
      const t1 = doc.splitTextToSize(
        `${capsRespondidos} de ${totalCaps} capítulos com leitura estratégica registrada nesta sessão.`,
        txtW,
      );
      let t1y = cardTop + 88;
      for (const l of t1.slice(0, 4)) {
        doc.text(l, txtX, t1y);
        t1y += 26;
      }
      y = cardTop + cardH + 20;

      if (campoFilled) {
        const c2Top = y;
        const c2H = 200;
        ensure(c2H + 20);
        setFill(NAVY);
        doc.roundedRect(margin, c2Top, maxW, c2H, 10, 10, "F");
        setFill(CORAL);
        doc.roundedRect(margin, c2Top, 8, c2H, 10, 10, "F");
        doc.rect(margin + 4, c2Top, 4, c2H, "F");

        const bigStr = `${campoFilled}`;
        doc.setFont("helvetica", "bold");
        let bigSize = 120;
        doc.setFontSize(bigSize);
        while (doc.getTextWidth(bigStr) > 170 && bigSize > 56) {
          bigSize -= 8;
          doc.setFontSize(bigSize);
        }
        setText(CYAN);
        doc.text(bigStr, margin + 40, c2Top + c2H / 2 + 40);
        const bigW = doc.getTextWidth(bigStr);

        const tx2 = margin + 40 + bigW + 30;
        const tw2 = maxW - (tx2 - margin) - 20;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        setText([160, 205, 220]);
        doc.text("TABELAS PREENCHIDAS", tx2, c2Top + 60, { charSpace: 1.5 });
        doc.setFont("helvetica", "bold");
        doc.setFontSize(22);
        setText([255, 255, 255]);
        const t2 = doc.splitTextToSize(
          "tabelas com sínteses das principais percepções",
          tw2,
        );
        let t2y = c2Top + 92;
        for (const l of t2.slice(0, 4)) {
          doc.text(l, tx2, t2y);
          t2y += 26;
        }
        y = c2Top + c2H + 20;
      }
    }
  }

  // ————————————————————————— SUMÁRIO EXECUTIVO (página única) —————————————————————————
  if (hasSumario && sumario) {
    addContentPage();

    // Watermark "00" à direita
    doc.setFont("helvetica", "bold");
    doc.setFontSize(130);
    setText([20, 34, 54]);
    const wm = "00";
    const wmW = doc.getTextWidth(wm);
    doc.text(wm, pageW - margin - wmW + 24, 178);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    setText(CYAN_DEEP);
    doc.text("00", margin, y, { charSpace: 2 });
    y += 22;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(26);
    setText(INK);
    doc.text("Sumário executivo", margin, y);
    y += 8;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    setText(MUTED);
    doc.text("Síntese geral", margin, y + 10, { charSpace: 1.2 });
    y += 18;
    setDraw(CORAL);
    doc.setLineWidth(2);
    doc.line(margin, y, margin + 48, y);
    y += 18;

    // Budget de altura para caber em uma página
    const bottomLimit = pageH - margin - 44;
    const available = bottomLimit - y;

    type Block =
      | { kind: "text"; label: string; text: string }
      | { kind: "chips"; label: string; items: Array<{ key: string; value: string }> };
    const blocks: Block[] = [];
    if (sumario.sintese_geral)
      blocks.push({ kind: "text", label: "Síntese geral", text: condense(sumario.sintese_geral, 0.5) });

    if (sumario.sinais_prioritarios?.length)
      blocks.push({ kind: "chips", label: "Sinais prioritários", items: sumario.sinais_prioritarios });
    if (sumario.risco_estrategico)
      blocks.push({ kind: "text", label: "Risco estratégico", text: sumario.risco_estrategico });
    if (sumario.agenda_prioritaria?.length)
      blocks.push({ kind: "chips", label: "Agenda prioritária", items: sumario.agenda_prioritaria });
    if (sumario.sintese_final)
      blocks.push({ kind: "text", label: "Síntese final", text: sumario.sintese_final });

    // Escolhe escala tipográfica (tenta grande, reduz se não couber)
    const humanize = (k: string) =>
      k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

    const scales = [
      { body: 10.5, chipVal: 9.5, label: 8, gap: 12, blockPad: 12, lineH: 13.5, chipLineH: 12 },
      { body: 9.5, chipVal: 8.5, label: 7.5, gap: 8, blockPad: 10, lineH: 12, chipLineH: 11 },
      { body: 8.5, chipVal: 7.5, label: 7, gap: 6, blockPad: 8, lineH: 11, chipLineH: 10 },
      { body: 7.5, chipVal: 7, label: 6.5, gap: 4, blockPad: 6, lineH: 10, chipLineH: 9.5 },
    ];

    const innerW = maxW - 24;
    const measure = (s: typeof scales[number]) => {
      let total = 0;
      for (const b of blocks) {
        const labelH = s.label + 8;
        if (b.kind === "text") {
          doc.setFont("helvetica", "normal");
          doc.setFontSize(s.body);
          const lines = doc.splitTextToSize(md(b.text), innerW);
          total += labelH + lines.length * s.lineH + s.blockPad * 2 + s.gap;
        } else {
          doc.setFont("helvetica", "normal");
          doc.setFontSize(s.chipVal);
          let h = labelH + 4;
          for (const it of b.items) {
            const vl = doc.splitTextToSize(md(it.value), innerW);
            h += s.label + 4 + vl.length * s.chipLineH + 6;
          }
          total += h + s.blockPad * 2 + s.gap;
        }
      }
      return total;
    };

    let chosen = scales[0];
    for (const s of scales) {
      if (measure(s) <= available) {
        chosen = s;
        break;
      }
      chosen = s;
    }

    type Row = { h: number; draw: (yy: number) => void; keepWithNext?: boolean };

    for (const b of blocks) {
      // 1) transforma o bloco em linhas atômicas mensuráveis
      const rows: Row[] = [];
      rows.push({
        h: chosen.label + 10,
        keepWithNext: true,
        draw: (yy) => {
          doc.setFont("helvetica", "bold");
          doc.setFontSize(chosen.label);
          setText(CYAN);
          doc.text(b.label.toUpperCase(), margin + 12, yy + chosen.label + 2, { charSpace: 1.3 });
        },
      });

      if (b.kind === "text") {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(chosen.body);
        const lines = doc.splitTextToSize(md(b.text), innerW);
        for (const line of lines) {
          rows.push({
            h: chosen.lineH,
            draw: (yy) => {
              doc.setFont("helvetica", "normal");
              doc.setFontSize(chosen.body);
              setText(INK);
              doc.text(line, margin + 12, yy + chosen.lineH);
            },
          });
        }
      } else {
        for (const it of b.items) {
          rows.push({
            h: chosen.label + 4,
            keepWithNext: true,
            draw: (yy) => {
              doc.setFont("helvetica", "bold");
              doc.setFontSize(chosen.label);
              setText(CYAN_DEEP);
              doc.text(humanize(it.key).toUpperCase(), margin + 12, yy + chosen.label, {
                charSpace: 1.1,
              });
            },
          });
          doc.setFont("helvetica", "normal");
          doc.setFontSize(chosen.chipVal);
          const vl = doc.splitTextToSize(md(it.value), innerW);
          for (const line of vl) {
            rows.push({
              h: chosen.chipLineH,
              draw: (yy) => {
                doc.setFont("helvetica", "normal");
                doc.setFontSize(chosen.chipVal);
                setText(INK);
                doc.text(line, margin + 12, yy + chosen.chipLineH);
              },
            });
          }
          rows.push({ h: 6, draw: () => {} });
        }
      }

      // 2) desenha paginando: nunca ultrapassa o rodapé
      let i = 0;
      let freshPage = false;
      while (i < rows.length) {
        const startY = y;
        const limit = contentBottom();
        let h = 4;
        const seg: Row[] = [];
        while (i < rows.length && startY + h + rows[i].h + 6 <= limit) {
          h += rows[i].h;
          seg.push(rows[i]);
          i++;
        }
        // evita rótulo órfão no fim da página: devolve linhas presas à seguinte
        while (seg.length && seg[seg.length - 1].keepWithNext && i < rows.length) {
          const last = seg.pop()!;
          h -= last.h;
          i--;
        }
        if (!seg.length) {
          if (freshPage) {
            // linha maior que uma página inteira: desenha mesmo assim para não travar
            h += rows[i].h;
            seg.push(rows[i]);
            i++;
          } else {
            addContentPage();
            freshPage = true;
            continue;
          }
        }
        freshPage = false;

        const blockH = h + 4;
        setFill(SURFACE);
        doc.roundedRect(margin, startY, maxW, blockH, 6, 6, "F");
        setFill(CORAL);
        doc.rect(margin, startY + 4, 3, blockH - 8, "F");

        let yy = startY;
        for (const r of seg) {
          r.draw(yy);
          yy += r.h;
        }

        y = startY + blockH + chosen.gap;
        if (i < rows.length) {
          addContentPage();
          freshPage = true;
        }
      }
    }
  }



  // ————————————————————————— CAPÍTULOS —————————————————————————
  for (const cap of capitulos) {
    addContentPage();
    const r: any = respByCap.get(cap.id);

    // Watermark do número — desenhado PRIMEIRO, como fundo, sem colidir com o header
    doc.setFont("helvetica", "bold");
    doc.setFontSize(130);
    setText([20, 34, 54]);
    const wmStr = String(cap.ordem).padStart(2, "0");
    const wmW = doc.getTextWidth(wmStr);
    doc.text(wmStr, pageW - margin - wmW + 24, 178);

    // Eyebrow
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    setText(CYAN_DEEP);
    doc.text(`CAPÍTULO ${String(cap.ordem).padStart(2, "0")}`, margin, y, { charSpace: 2 });
    y += 34;

    // Título — largura reduzida para não invadir o watermark à direita
    doc.setFont("helvetica", "bold");
    doc.setFontSize(26);
    setText(INK);
    const titleW = maxW - 140;
      const tl = doc.splitTextToSize(applyPortugueseAccents(cap.titulo), titleW);
    for (const l of tl) {
      ensure(32);
      doc.text(l, margin, y);
      y += 32;
    }
    y += 6;

    // Lente — texto simples em cyan
    if (cap.lente_default) {
      const badge = `LENTE · ${prettyLabel(String(cap.lente_default)).toUpperCase()}`;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      setText(CYAN);
      doc.text(badge, margin, y + 10, { charSpace: 1.2 });
      y += 22;
    }

    setDraw(CORAL);
    doc.setLineWidth(2);
    doc.line(margin, y, margin + 48, y);
    y += 22;

    // Pergunta de abertura omitida a pedido — o relatório vai direto para as percepções.


    // Leitura estratégica — destaque em bloco cyan
    if (r?.leitura_estrategica?.trim())
      writeCalloutBlock("LEITURA ESTRATÉGICA", r.leitura_estrategica);

    // Evidência / anotações
    if (r?.resposta_texto?.trim()) {
      ensure(30);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      setText(MUTED);
      write("EVIDÊNCIA · ANOTAÇÕES DE CAMPO", 8, "bold", MUTED);
      y += 2;
      setDraw(HAIRLINE);
      doc.setLineWidth(0.5);
      doc.line(margin, y, margin + 60, y);
      y += 12;
      write(md(r.resposta_texto), 11, "normal", INK);
      y += 12;
    }

    // Síntese objetiva — grid de campos (sempre inicia em nova página)
    const campos: string[] = Array.isArray(cap.campos_matriz) ? cap.campos_matriz : [];
    const sintese = (r?.sintese ?? {}) as Record<string, string>;
    const hasSintese = campos.some((c) => (sintese[c] ?? "").toString().trim().length > 0);
    if (campos.length && hasSintese) {
      addContentPage();
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      setText(MUTED);
      write("SÍNTESE OBJETIVA", 8, "bold", MUTED);
      y += 2;
      setDraw(HAIRLINE);
      doc.setLineWidth(0.5);
      doc.line(margin, y, margin + 60, y);
      y += 10;

      for (const c of campos) {
        if ((sintese[c] ?? "").toString().trim().length > 0) writeMatrixField(c, sintese[c]);
      }
    }

    // ————— HIGHLIGHTS (frases-destaque por capítulo) — fica na mesma página se couber —————
    const fromSintese = Array.isArray((sintese as any)?.highlights)
      ? ((sintese as any).highlights as any[]).map((s) => String(s)).filter(Boolean)
      : [];
    const highlights = fromSintese.length
      ? fromSintese
      : getHighlightsFor(interview.entrevistado_nome, cap.ordem);
    if (highlights.length) {
      // Estima altura necessária: painel + frases quebradas
      const panelHEstimate = 110;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(14);
      let quotesH = 0;
      for (const q of highlights) {
        const text = applyPortugueseAccents(`“${q.replace(/^["“”]|["“”]$/g, "")}”`);
        const lines = doc.splitTextToSize(text, maxW);
        quotesH += lines.length * 22 + 16;
      }
      const needed = panelHEstimate + 24 + quotesH;
      ensure(needed);

      // Painel escuro com título grande
      const panelH = 110;
      setFill(SURFACE);
      doc.roundedRect(margin, y, maxW, panelH, 10, 10, "F");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(38);
      setText(CYAN);
      doc.text("HIGHLIGHTS", margin + 24, y + 58);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      setText(INK);
      doc.text(
        highlights.length > 1
          ? `Os ${highlights.length} principais destaques da percepção`
          : "Principal destaque da percepção",
        margin + 24,
        y + 82,
      );

      y += panelH + 24;

      // Frases (aspas curvas), espaçadas — mesmas margens laterais da síntese objetiva.
      const quoteX = margin;
      const quoteW = maxW;
      const quoteFontSize = 14;
      const quoteLineH = 22;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(quoteFontSize);
      setText(INK);
      for (const q of highlights) {
        const text = applyPortugueseAccents(`“${q.replace(/^["“”]|["“”]$/g, "")}”`);
        const lines = doc.splitTextToSize(text, quoteW);
        ensure(lines.length * quoteLineH + 18);
        for (const l of lines) {
          doc.text(l, quoteX, y);
          y += quoteLineH;
        }
        y += 16;
      }
    }
  }


  // ————————————————————————— ANOTAÇÕES —————————————————————————
  if (notes.length) {
    addContentPage();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    setText(CYAN_DEEP);
    doc.text("APÊNDICE", margin, y, { charSpace: 2 });
    y += 18;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(28);
    setText(INK);
    doc.text("Anotações da sessão", margin, y);
    y += 12;
    setDraw(CORAL);
    doc.setLineWidth(3);
    doc.line(margin, y, margin + 48, y);
    y += 24;

    for (const n of notes) {
      ensure(50);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      setText(MUTED);
      doc.text(
        `${new Date(n.created_at).toLocaleString("pt-BR")}  ·  ${n.author_name ?? "—"}`.toUpperCase(),
        margin,
        y,
        { charSpace: 1 },
      );
      y += 14;
      write(md(n.content), 11, "normal", INK);
      y += 12;
      setDraw(HAIRLINE);
      doc.setLineWidth(0.3);
      doc.line(margin, y, margin + maxW, y);
      y += 12;
    }
  }

  if (interview.observacoes) {
    addContentPage();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    setText(CYAN_DEEP);
    doc.text("OBSERVAÇÕES", margin, y, { charSpace: 2 });
    y += 18;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(24);
    setText(INK);
    doc.text("Notas do entrevistador", margin, y);
    y += 12;
    setDraw(CORAL);
    doc.setLineWidth(3);
    doc.line(margin, y, margin + 48, y);
    y += 24;
    write(md(interview.observacoes), 11, "normal", INK);
  }

  // ————————————————————————— HEADER / FOOTER ——————————————————————
  const total = doc.getNumberOfPages();
  for (let p = headerStartPage; p <= total; p++) {
    doc.setPage(p);
    // header sutil
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    setText(MUTED);
    doc.text("RELATÓRIO - VISÃO DE MERCADO", margin, 30, { charSpace: 1.5 });
    setText(INK);
    doc.text((interview.entrevistado_nome ?? "").toUpperCase(), pageW - margin, 30, {
      align: "right",
      charSpace: 1.2,
    });
    setDraw(HAIRLINE);
    doc.setLineWidth(0.4);
    doc.line(margin, 38, pageW - margin, 38);

    // footer
    setDraw(HAIRLINE);
    doc.line(margin, pageH - 32, pageW - margin, pageH - 32);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    setText(MUTED);
    doc.text("Inteligência de mercado · confidencial", margin, pageH - 18);
    doc.setFont("helvetica", "bold");
    setText(INK);
    doc.text(
      `${String(p).padStart(2, "0")} / ${String(total).padStart(2, "0")}`,
      pageW - margin,
      pageH - 18,
      { align: "right" },
    );
  }

  const safe = (interview.entrevistado_nome || "entrevista")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  doc.save(`entrevista-${safe}.pdf`);
}
