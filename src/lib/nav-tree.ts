// Árvore canônica do menu — usada pelo AppShell, pelo controle de acesso
// (Admin → Permissões) e pelo bloqueio de rotas.

export type NavLeaf = {
  key: string;
  label: string;
  to: string;
  /** prefixos adicionais de rota que pertencem a este item */
  match?: string[];
  /** visível apenas para o gestor master */
  masterOnly?: boolean;
};


export type NavGroup = {
  key: string;
  label: string;
  /** grupo sem filhos aponta direto para uma rota */
  to?: string;
  match?: string[];
  children: NavLeaf[];
  adminOnly?: boolean;
};

export const NAV_TREE: NavGroup[] = [
  { key: "home", label: "Home", to: "/home", children: [] },
  {
    key: "performance",
    label: "Performance",
    children: [
      {
        key: "performance.reps",
        label: "Performance Reps",
        to: "/representantes/performance",
        match: ["/clientes-bi", "/clientes-bi-batch"],
      },
      { key: "performance.bi-clientes", label: "BI Clientes", to: "/performance/bi-clientes" },
    ],
  },
  {
    key: "imersoes",
    label: "Imersões",
    children: [
      { key: "analises.visao-rep-2", label: "Visão Reps", to: "/visao-rep-2" },
      { key: "analises.visao-imersao-2", label: "Visão Imersões em Campo", to: "/visao-imersao-2" },
      { key: "analises.sintese-tipos", label: "Visões Consolidadas", to: "/sintese/tipos" },
    ],
  },
  {
    key: "precos",
    label: "Preços",
    children: [
      { key: "price.mapa", label: "Mapa de Preços", to: "/price/mapa" },
      { key: "price.simulador", label: "Simulador, R$ + Características", to: "/price/simulador" },
      { key: "price.comparativos", label: "Comparativos", to: "/price/comparativos" },
    ],
  },
  {
    key: "mapa-acoes",
    label: "Mapa de Ações",
    to: "/mapa-acoes",
    children: [],
  },
  {
    key: "inputs-relatorios",
    label: "Inputs e Relatórios",
    children: [
      { key: "inputs.imersoes", label: "Imersões em Campo", to: "/imersoes" },
      { key: "inputs.fontes", label: "Fontes de Insight", to: "/fontes" },
      { key: "inputs.entrevistas", label: "Entrevistas", to: "/entrevistas" },
      { key: "inputs.forms", label: "Forms", to: "/forms" },
    ],
  },
  {
    key: "dados-mercado",
    label: "Dados de Mercado",
    children: [
      { key: "price.tabelas", label: "Tabelas", to: "/price/tabelas" },
      { key: "price.competidores", label: "Competidores", to: "/price/competidores" },
    ],
  },
  {
    key: "bases",
    label: "Bases",
    children: [
      { key: "representantes.lista", label: "Representantes", to: "/representantes" },
      { key: "clientes.lista", label: "Clientes", to: "/clientes" },
      { key: "bases.roteiros", label: "Roteiros", to: "/roteiros" },
      { key: "bases.produtos", label: "Produtos", to: "/produtos" },
      { key: "bases.familias", label: "Famílias", to: "/familias" },
    ],
  },
  {
    key: "ferramentas",
    label: "Ferramentas",
    children: [
      { key: "ferramentas.gerador-performance", label: "Gerador de Performance", to: "/admin/gerador-performance" },
      { key: "ferramentas.transcricao", label: "Transcrição", to: "/ferramentas/transcricao" },
      { key: "ferramentas.tarefas", label: "Gestão de Tarefas", to: "/tarefas" },
      { key: "ferramentas.manuais", label: "Manuais", to: "/manuais" },
      { key: "ferramentas.tabela-precos", label: "Tabela de Preços", to: "/price/tabelas" },
    ],
  },
  {
    key: "admin",
    label: "Admin",
    adminOnly: true,
    children: [
      { key: "admin.auditoria-seguranca", label: "Auditoria de Segurança", to: "/admin/auditoria-seguranca" },
      { key: "admin.conformidade", label: "Conformidade e Aceites", to: "/admin/conformidade" },
      { key: "admin.mfa", label: "Meu MFA", to: "/admin/mfa" },
      { key: "admin.mfa-politica", label: "Política de MFA", to: "/admin/mfa-politica" },
      { key: "admin.mfa-recuperacao", label: "Recuperação de MFA", to: "/admin/mfa-recuperacao" },
      { key: "admin.lgpd", label: "LGPD e Expurgo", to: "/admin/lgpd" },
      { key: "admin.criterios-seguranca", label: "Critérios de Segurança", to: "/admin/criterios-seguranca" },
      { key: "admin.backup", label: "Backup", to: "/admin/backup" },
      { key: "admin.central-mensagens", label: "Central de Mensagens", to: "/admin/central-mensagens" },
      { key: "admin.usuarios", label: "Usuários", to: "/admin/usuarios" },
      { key: "admin.agentes", label: "Agentes", to: "/agentes" },
      { key: "admin.permissoes", label: "Permissões", to: "/admin/permissoes" },
    ],
  },
];

/** Rotas sempre liberadas (fluxos obrigatórios / institucionais) */
export const ALWAYS_ALLOWED = [
  "/home",
  "/aceite-termos",
  "/termos-de-uso",
  "/nda",
  "/empresas",
  "/admin/mfa",
];

export const ALL_NAV_KEYS: string[] = NAV_TREE.flatMap(g => [g.key, ...g.children.map(c => c.key)]);

function matchesPath(pathname: string, to: string, extra?: string[]) {
  const candidates = [to, ...(extra ?? [])];
  return candidates.some(p => pathname === p || pathname.startsWith(p + "/"));
}

/**
 * Resolve o nav_key exigido para uma rota.
 * Retorna null quando a rota não é controlada por permissão.
 */
export function navKeyForPath(pathname: string): { groupKey: string; itemKey: string | null } | null {
  if (ALWAYS_ALLOWED.some(p => pathname === p || pathname.startsWith(p + "/"))) return null;

  let best: { groupKey: string; itemKey: string | null; len: number } | null = null;
  for (const g of NAV_TREE) {
    if (g.to && matchesPath(pathname, g.to, g.match)) {
      if (!best || g.to.length > best.len) best = { groupKey: g.key, itemKey: null, len: g.to.length };
    }
    for (const c of g.children) {
      const all = [c.to, ...(c.match ?? [])];
      for (const p of all) {
        if (matchesPath(pathname, p) && (!best || p.length > best.len)) {
          best = { groupKey: g.key, itemKey: c.key, len: p.length };
        }
      }
    }
  }
  return best ? { groupKey: best.groupKey, itemKey: best.itemKey } : null;
}

/** Gestor master: único usuário com acesso a áreas com valores brutos. */
export const MASTER_EMAIL = "felipe@poolbranding.com.br";
