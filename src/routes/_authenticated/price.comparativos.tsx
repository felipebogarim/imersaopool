import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  BarChart3,
  Search,
  Upload,
  SlidersHorizontal,
  MoreVertical,
  ChevronDown,
  LayoutGrid,
  ListOrdered,
  Table2,
  CircleDot,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { ImportarDadosDialog } from "@/components/price/ImportarDadosDialog";
import {
  CATEGORIAS,
  CELL_FAROL_CLASS,
  CELL_FAROL_LABEL,
  DEFAULT_CB_WEIGHTS,
  FAMILIAS,
  LEVEL_CLASS,
  LEVEL_DESCRIPTION,
  LEVEL_LABEL,
  PRICE_AVAILABILITY_LABEL,
  PRICE_FAROL_CLASS,
  PRICE_FAROL_LABEL,
  STATUS_CLASS,
  STATUS_LABEL,
  attributesFor,
  cbCategoria,
  costBenefit,
  faixaTextual,
  formatBRL,
  formatPctDiff,
  formatSpec,
  priceFarol,
  scoreEquivalence,
  type EquivalenceLevel,
  type EquivalenceStatus,
} from "@/lib/price-comparativos-core";
import {
  fetchEquivalences,
  fetchProducts,
  fetchRules,
  loadProducts,
  type LoadedProduct,
} from "@/lib/price-comparativos-data";

export const Route = createFileRoute("/_authenticated/price/comparativos")({
  head: () => ({
    meta: [
      { title: "Comparativos | Price — PoolFlux" },
      {
        name: "description",
        content:
          "Compare produtos equivalentes, analise diferenças técnicas e avalie o posicionamento de preços entre marcas.",
      },
      { property: "og:title", content: "Comparativos | Price — PoolFlux" },
      {
        property: "og:description",
        content:
          "Comparação técnica e de preços entre produtos equivalentes de diferentes marcas.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ComparativosPage,
});

type Modo = "ranking" | "cards" | "tecnica";

type LinhaRanking = {
  produto: LoadedProduct;
  score: number | null;
  level: EquivalenceLevel;
  status: EquivalenceStatus;
  equivalenceId: string | null;
  atributos: ReturnType<typeof scoreEquivalence>["atributos"];
  semelhancas: string[];
  diferencas: string[];
  impactos: string[];
  cobertura: number;
  precoDiff: number | null;
  precoDiffPct: number | null;
  custoBeneficio: number | null;
};

function ComparativosPage() {
  const qc = useQueryClient();
  const isAdmin = useIsAdmin();
  const podeEditar = !!isAdmin;

  const [familia, setFamilia] = useState("Fitas e Fontes");
  const [categoria, setCategoria] = useState("Fitas LED");
  const [busca, setBusca] = useState("");
  const [baseId, setBaseId] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  const [modo, setModo] = useState<Modo>("ranking");
  const [marcasSel, setMarcasSel] = useState<string[]>([]);
  const [nivelSel, setNivelSel] = useState<EquivalenceLevel | "todos">("todos");
  const [statusSel, setStatusSel] = useState<EquivalenceStatus | "todos">("todos");
  const [proxMin, setProxMin] = useState("");
  const [precoMax, setPrecoMax] = useState("");
  const [incluirIncompativeis, setIncluirIncompativeis] = useState(false);
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [ordem, setOrdem] = useState<
    "proximidade" | "menor_preco" | "maior_preco" | "custo_beneficio" | "eficiencia" | "marca"
  >("proximidade");

  // ---------- Dados ----------
  const produtosBase = useQuery({
    queryKey: ["price-comparativos", "base", familia, categoria, busca],
    queryFn: () => fetchProducts({ familia, categoria, onlyBase: true, busca, limit: 200 }),
  });

  const rules = useQuery({
    queryKey: ["price-comparativos", "rules", familia, categoria],
    queryFn: () => fetchRules(familia, categoria),
  });

  const contexto = useQuery({
    enabled: !!baseId,
    queryKey: ["price-comparativos", "contexto", baseId, familia, categoria],
    queryFn: async () => {
      const todos = await fetchProducts({ familia, categoria, limit: 2000 });
      const carregados = await loadProducts(todos);
      const base = carregados.find((p) => p.id === baseId) ?? null;
      const equivalencias = baseId ? await fetchEquivalences(baseId) : [];
      return { carregados, base, equivalencias };
    },
  });

  const attrs = attributesFor(categoria);
  const attrNames = useMemo(
    () => Object.fromEntries(attrs.map((a) => [a.key, a.name])),
    [attrs],
  );

  const linhas: LinhaRanking[] = useMemo(() => {
    const base = contexto.data?.base;
    const regras = rules.data ?? [];
    if (!base || !regras.length) return [];
    const equivMap = new Map(
      (contexto.data?.equivalencias ?? []).map((e) => [e.compared_product_id, e]),
    );
    return (contexto.data?.carregados ?? [])
      .filter((p) => p.id !== base.id && p.marca !== base.marca)
      .map((p) => {
        const r = scoreEquivalence(base.product, p.product, regras, attrNames);
        const stored = equivMap.get(p.id);
        const precoBase = base.product.preco;
        const preco = p.product.preco;
        const cb = costBenefit(base.product, p.product, r.score, r.cobertura, DEFAULT_CB_WEIGHTS);
        return {
          produto: p,
          score: r.score,
          level: stored?.manually_edited ? stored.equivalence_level : r.level,
          status: (stored?.status ?? "em_analise") as EquivalenceStatus,
          equivalenceId: stored?.id ?? null,
          atributos: r.atributos,
          semelhancas: r.semelhancas,
          diferencas: r.diferencas,
          impactos: r.impactos,
          cobertura: r.cobertura,
          precoDiff: precoBase != null && preco != null ? preco - precoBase : null,
          precoDiffPct:
            precoBase != null && preco != null && precoBase > 0
              ? ((preco - precoBase) / precoBase) * 100
              : null,
          custoBeneficio: cb.valor,
        };
      });
  }, [contexto.data, rules.data, attrNames]);

  const marcasDisponiveis = useMemo(
    () => Array.from(new Set(linhas.map((l) => l.produto.marca))).sort(),
    [linhas],
  );

  const filtradas = useMemo(() => {
    let out = linhas;
    if (marcasSel.length) out = out.filter((l) => marcasSel.includes(l.produto.marca));
    if (nivelSel !== "todos") out = out.filter((l) => l.level === nivelSel);
    if (statusSel !== "todos") out = out.filter((l) => l.status === statusSel);
    if (!incluirIncompativeis)
      out = out.filter((l) => l.level !== "incompativel" && l.status !== "incompativel");
    const pm = Number(proxMin);
    if (proxMin && Number.isFinite(pm)) out = out.filter((l) => (l.score ?? 0) >= pm);
    const px = Number(precoMax.replace(",", "."));
    if (precoMax && Number.isFinite(px))
      out = out.filter((l) => l.produto.product.preco != null && l.produto.product.preco <= px);

    const cmp: Record<typeof ordem, (a: LinhaRanking, b: LinhaRanking) => number> = {
      proximidade: (a, b) => (b.score ?? -1) - (a.score ?? -1),
      menor_preco: (a, b) => (a.produto.product.preco ?? Infinity) - (b.produto.product.preco ?? Infinity),
      maior_preco: (a, b) => (b.produto.product.preco ?? -1) - (a.produto.product.preco ?? -1),
      custo_beneficio: (a, b) => (b.custoBeneficio ?? -1) - (a.custoBeneficio ?? -1),
      eficiencia: (a, b) =>
        (b.produto.product.specs["eficiencia"]?.value_numeric ?? -1) -
        (a.produto.product.specs["eficiencia"]?.value_numeric ?? -1),
      marca: (a, b) => a.produto.marca.localeCompare(b.produto.marca),
    };
    return [...out].sort(cmp[ordem]);
  }, [linhas, marcasSel, nivelSel, statusSel, proxMin, precoMax, incluirIncompativeis, ordem]);

  const base = contexto.data?.base ?? null;

  const indicadores = useMemo(() => {
    const precos = linhas
      .map((l) => l.produto.product.preco)
      .filter((p): p is number => p != null && p > 0);
    const maisProximo = [...linhas].sort((a, b) => (b.score ?? -1) - (a.score ?? -1))[0] ?? null;
    const maisBarato =
      [...linhas]
        .filter((l) => l.produto.product.preco != null)
        .sort((a, b) => (a.produto.product.preco ?? 0) - (b.produto.product.preco ?? 0))[0] ?? null;
    const melhorCb =
      [...linhas].sort((a, b) => (b.custoBeneficio ?? -1) - (a.custoBeneficio ?? -1))[0] ?? null;
    return {
      total: linhas.length,
      diretos: linhas.filter((l) => l.level === "direto").length,
      aproximados: linhas.filter((l) => l.level === "aproximado").length,
      alternativos: linhas.filter((l) => l.level === "alternativo").length,
      incompativeis: linhas.filter((l) => l.level === "incompativel").length,
      insuficientes: linhas.filter((l) => l.level === "insuficiente").length,
      marcas: new Set(linhas.map((l) => l.produto.marca)).size,
      menorPreco: precos.length ? Math.min(...precos) : null,
      maiorPreco: precos.length ? Math.max(...precos) : null,
      precoMedio: precos.length ? precos.reduce((a, b) => a + b, 0) / precos.length : null,
      emAnalise: linhas.filter((l) => l.status === "em_analise").length,
      validados: linhas.filter((l) => l.status === "validado").length,
      maisProximo,
      maisBarato,
      melhorCb,
    };
  }, [linhas]);

  const comparados = filtradas.filter((l) => selecionados.includes(l.produto.id)).slice(0, 4);

  function toggleSelecionado(id: string) {
    setSelecionados((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length >= 4 ? prev : [...prev, id],
    );
  }

  function limparFiltros() {
    setMarcasSel([]);
    setNivelSel("todos");
    setStatusSel("todos");
    setProxMin("");
    setPrecoMax("");
    setIncluirIncompativeis(false);
  }

  const ultimaAtualizacao = useMemo(() => {
    const datas = (contexto.data?.carregados ?? []).map((p) => p.updated_at).filter(Boolean);
    if (!datas.length) return null;
    return new Date(datas.sort().slice(-1)[0]).toLocaleDateString("pt-BR");
  }, [contexto.data]);

  // ---------- Render ----------
  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-6">
        {/* Cabeçalho */}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">COMPARATIVOS</h2>
            <p className="text-sm text-muted-foreground max-w-2xl">
              Compare produtos equivalentes, analise diferenças técnicas e avalie o posicionamento
              de preços entre marcas.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {ultimaAtualizacao && (
              <span className="text-xs text-muted-foreground">
                Atualizado em {ultimaAtualizacao}
              </span>
            )}
            <Button variant="outline" onClick={() => setBaseId(null)}>
              Nova comparação
            </Button>
            <Button onClick={() => setImportOpen(true)}>
              <Upload className="h-4 w-4 mr-1" /> Importar dados
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" aria-label="Mais ações">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => qc.invalidateQueries({ queryKey: ["price-comparativos"] })}>
                  Recarregar dados
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSelecionados([])}>
                  Limpar seleção de comparação
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem disabled>Comparações salvas (em construção)</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Estado inicial */}
        {!baseId && (
          <div className="surface rounded-xl p-6 sm:p-10 space-y-6">
            <div className="text-center space-y-2">
              <BarChart3 className="h-10 w-10 mx-auto text-muted-foreground" />
              <h3 className="text-lg font-semibold">COMPARATIVOS DE PRODUTOS</h3>
              <p className="text-sm text-muted-foreground max-w-xl mx-auto">
                Compare produtos tecnicamente equivalentes, entenda diferenças de especificação e
                analise o posicionamento de preços entre marcas.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 max-w-3xl mx-auto">
              <div className="space-y-1">
                <Label>Família</Label>
                <Select
                  value={familia}
                  onValueChange={(v) => {
                    setFamilia(v);
                    setCategoria((CATEGORIAS[v] ?? ["Geral"])[0]);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FAMILIAS.map((f) => (
                      <SelectItem key={f} value={f}>
                        {f}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Categoria</Label>
                <Select value={categoria} onValueChange={setCategoria}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(CATEGORIAS[familia] ?? ["Geral"]).map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Buscar produto base</Label>
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pl-8"
                    placeholder="Código, SKU, referência ou descrição"
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="max-w-3xl mx-auto">
              {produtosBase.isLoading ? (
                <div className="space-y-2">
                  {[0, 1, 2].map((i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : produtosBase.data?.length ? (
                <div className="rounded-lg border border-border divide-y divide-border max-h-80 overflow-y-auto">
                  {produtosBase.data.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setBaseId(p.id)}
                      className="w-full text-left px-4 py-2.5 hover:bg-muted/50 transition flex items-center justify-between gap-3"
                    >
                      <span className="min-w-0">
                        <span className="block text-sm font-medium truncate">
                          {p.descricao ?? p.nome}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {p.marca} · {p.sku ?? p.referencia ?? "sem código"}
                        </span>
                      </span>
                      <Badge variant="outline">Iniciar comparação</Badge>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-border p-8 text-center space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Nenhum produto base cadastrado nesta categoria.
                  </p>
                  <Button variant="outline" onClick={() => setImportOpen(true)}>
                    <Upload className="h-4 w-4 mr-1" /> Importar dados
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Painel de comparação */}
        {baseId && (
          <div className="space-y-6">
            {contexto.isLoading || rules.isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-64 w-full" />
              </div>
            ) : !base ? (
              <div className="surface rounded-xl p-8 text-center text-sm text-muted-foreground">
                Produto base não encontrado.
              </div>
            ) : (
              <>
                {/* 1. Filtros */}
                <Collapsible open={filtrosAbertos} onOpenChange={setFiltrosAbertos}>
                  <div className="surface rounded-xl">
                    <CollapsibleTrigger className="w-full flex items-center justify-between p-4">
                      <span className="flex items-center gap-2 text-sm font-medium">
                        <SlidersHorizontal className="h-4 w-4" /> Filtros
                        {(marcasSel.length > 0 ||
                          nivelSel !== "todos" ||
                          statusSel !== "todos" ||
                          proxMin ||
                          precoMax) && <Badge variant="secondary">ativos</Badge>}
                      </span>
                      <ChevronDown
                        className={cn("h-4 w-4 transition", filtrosAbertos && "rotate-180")}
                      />
                    </CollapsibleTrigger>
                    <CollapsibleContent className="px-4 pb-4 space-y-4">
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <div className="space-y-1">
                          <Label>Classificação</Label>
                          <Select
                            value={nivelSel}
                            onValueChange={(v) => setNivelSel(v as EquivalenceLevel | "todos")}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="todos">Todas</SelectItem>
                              {(Object.keys(LEVEL_LABEL) as EquivalenceLevel[]).map((l) => (
                                <SelectItem key={l} value={l}>
                                  {LEVEL_LABEL[l]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label>Status</Label>
                          <Select
                            value={statusSel}
                            onValueChange={(v) => setStatusSel(v as EquivalenceStatus | "todos")}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="todos">Todos</SelectItem>
                              <SelectItem value="em_analise">Em análise</SelectItem>
                              <SelectItem value="validado">Validado</SelectItem>
                              <SelectItem value="incompativel">Incompatível</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label>Proximidade mínima</Label>
                          <Input
                            inputMode="numeric"
                            placeholder="0 a 100"
                            value={proxMin}
                            onChange={(e) => setProxMin(e.target.value)}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label>Preço máximo</Label>
                          <Input
                            inputMode="decimal"
                            placeholder="R$"
                            value={precoMax}
                            onChange={(e) => setPrecoMax(e.target.value)}
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Marcas concorrentes</Label>
                        <div className="flex flex-wrap gap-2">
                          {marcasDisponiveis.map((m) => {
                            const ativo = marcasSel.includes(m);
                            return (
                              <button
                                key={m}
                                onClick={() =>
                                  setMarcasSel((prev) =>
                                    ativo ? prev.filter((x) => x !== m) : [...prev, m],
                                  )
                                }
                                className={cn(
                                  "px-3 py-1 rounded-full border text-xs transition",
                                  ativo
                                    ? "border-primary bg-primary/10 text-primary"
                                    : "border-border text-muted-foreground hover:text-foreground",
                                )}
                              >
                                {m}
                              </button>
                            );
                          })}
                        </div>
                        <div className="flex flex-wrap items-center gap-3 pt-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setMarcasSel(marcasDisponiveis)}
                          >
                            Selecionar todas
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => setMarcasSel([])}>
                            Limpar seleção
                          </Button>
                          <label className="flex items-center gap-2 text-xs">
                            <Checkbox
                              checked={incluirIncompativeis}
                              onCheckedChange={(v) => setIncluirIncompativeis(!!v)}
                            />
                            Incluir incompatíveis
                          </label>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={limparFiltros}>
                          Limpar filtros
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            localStorage.setItem(
                              "price-comparativos-filtros",
                              JSON.stringify({ marcasSel, nivelSel, statusSel, proxMin, precoMax }),
                            );
                            toast.success("Combinação de filtros salva neste navegador");
                          }}
                        >
                          Salvar combinação
                        </Button>
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>

                {/* 2. Produto de referência */}
                <div className="surface rounded-xl p-4 sm:p-5 space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge>{base.marca}</Badge>
                        <span className="text-xs text-muted-foreground">
                          {base.familia} · {base.categoria}
                          {base.tipo ? ` · ${base.tipo}` : ""}
                        </span>
                      </div>
                      <h3 className="text-base font-semibold mt-1">{base.descricao ?? base.nome}</h3>
                      <p className="text-xs text-muted-foreground">
                        Código {base.sku ?? "—"} · Referência {base.referencia ?? "—"} · Fonte{" "}
                        {base.source_file ?? "não informada"}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-muted-foreground">Preço de referência</div>
                      <div className="text-lg font-semibold">
                        {base.product.preco != null
                          ? formatBRL(base.product.preco)
                          : PRICE_AVAILABILITY_LABEL[
                              base.product.precoDisponibilidade ?? "nao_informado"
                            ]}
                      </div>
                    </div>
                  </div>
                  <Separator />
                  <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-4">
                    {attrs.map((a) => (
                      <div key={a.key} className="flex items-baseline justify-between gap-2 text-sm">
                        <span className="text-muted-foreground">{a.name}</span>
                        <span className="font-medium text-right">
                          {formatSpec(base.product.specs[a.key], a.unit)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 3. Indicadores */}
                <div className="grid gap-3 grid-cols-2 md:grid-cols-4 xl:grid-cols-6">
                  {[
                    { label: "Equivalentes encontrados", valor: indicadores.total, acao: () => setNivelSel("todos") },
                    { label: "Equivalentes diretos", valor: indicadores.diretos, acao: () => setNivelSel("direto") },
                    { label: "Aproximados", valor: indicadores.aproximados, acao: () => setNivelSel("aproximado") },
                    { label: "Alternativos", valor: indicadores.alternativos, acao: () => setNivelSel("alternativo") },
                    {
                      label: "Incompatíveis",
                      valor: indicadores.incompativeis,
                      acao: () => {
                        setIncluirIncompativeis(true);
                        setNivelSel("incompativel");
                      },
                    },
                    { label: "Dados insuficientes", valor: indicadores.insuficientes, acao: () => setNivelSel("insuficiente") },
                    { label: "Marcas analisadas", valor: indicadores.marcas },
                    { label: "Menor preço", valor: formatBRL(indicadores.menorPreco), acao: () => setOrdem("menor_preco") },
                    { label: "Maior preço", valor: formatBRL(indicadores.maiorPreco), acao: () => setOrdem("maior_preco") },
                    { label: "Preço médio", valor: formatBRL(indicadores.precoMedio) },
                    { label: "Itens em análise", valor: indicadores.emAnalise, acao: () => setStatusSel("em_analise") },
                    { label: "Itens validados", valor: indicadores.validados, acao: () => setStatusSel("validado") },
                  ].map((ind) => (
                    <button
                      key={ind.label}
                      onClick={ind.acao}
                      disabled={!ind.acao}
                      className={cn(
                        "surface rounded-xl p-3 text-left transition",
                        ind.acao && "hover:border-primary/40",
                      )}
                    >
                      <div className="text-[11px] text-muted-foreground leading-tight">
                        {ind.label}
                      </div>
                      <div className="text-lg font-semibold">{ind.valor}</div>
                    </button>
                  ))}
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  {[
                    { label: "Tecnicamente mais próximo", l: indicadores.maisProximo, extra: (x: LinhaRanking) => `${x.score?.toFixed(1) ?? "—"} de 100` },
                    { label: "Mais barato", l: indicadores.maisBarato, extra: (x: LinhaRanking) => formatBRL(x.produto.product.preco) },
                    { label: "Melhor custo-benefício", l: indicadores.melhorCb, extra: (x: LinhaRanking) => cbCategoria(x.custoBeneficio) },
                  ].map((c) => (
                    <div key={c.label} className="surface rounded-xl p-4">
                      <div className="text-xs text-muted-foreground">{c.label}</div>
                      {c.l ? (
                        <>
                          <div className="text-sm font-semibold mt-1">
                            {c.l.produto.marca} · {c.l.produto.referencia ?? c.l.produto.sku ?? "—"}
                          </div>
                          <div className="text-xs text-muted-foreground">{c.extra(c.l)}</div>
                        </>
                      ) : (
                        <div className="text-sm text-muted-foreground mt-1">Sem dados</div>
                      )}
                    </div>
                  ))}
                </div>

                {/* 4/5. Modos */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex gap-1 rounded-lg border border-border p-1">
                    {[
                      { v: "ranking" as const, icon: ListOrdered, label: "Ranking" },
                      { v: "cards" as const, icon: LayoutGrid, label: "Cards" },
                      { v: "tecnica" as const, icon: Table2, label: "Tabela técnica" },
                    ].map((m) => (
                      <button
                        key={m.v}
                        onClick={() => setModo(m.v)}
                        className={cn(
                          "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition",
                          modo === m.v
                            ? "bg-primary/10 text-primary"
                            : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        <m.icon className="h-4 w-4" />
                        {m.label}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground">Ordenar por</Label>
                    <Select value={ordem} onValueChange={(v) => setOrdem(v as typeof ordem)}>
                      <SelectTrigger className="w-56">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="proximidade">Maior proximidade</SelectItem>
                        <SelectItem value="menor_preco">Menor preço</SelectItem>
                        <SelectItem value="maior_preco">Maior preço</SelectItem>
                        <SelectItem value="custo_beneficio">Melhor custo-benefício</SelectItem>
                        <SelectItem value="eficiencia">Maior eficiência</SelectItem>
                        <SelectItem value="marca">Marca</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {modo === "ranking" && (
                  <RankingTabela
                    linhas={filtradas}
                    base={base}
                    selecionados={selecionados}
                    onToggle={toggleSelecionado}
                    podeEditar={podeEditar}
                  />
                )}

                {modo === "cards" && (
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {filtradas.map((l) => (
                      <CardProduto
                        key={l.produto.id}
                        linha={l}
                        selecionado={selecionados.includes(l.produto.id)}
                        onToggle={() => toggleSelecionado(l.produto.id)}
                      />
                    ))}
                    {!filtradas.length && (
                      <div className="col-span-full surface rounded-xl p-8 text-center text-sm text-muted-foreground">
                        Nenhum equivalente atende aos filtros selecionados.
                      </div>
                    )}
                  </div>
                )}

                {modo === "tecnica" && (
                  <TabelaTecnica base={base} linhas={filtradas.slice(0, 8)} attrs={attrs} />
                )}

                {/* 6. Comparação lado a lado */}
                {comparados.length >= 1 && (
                  <div className="surface rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold">
                        Comparação lado a lado ({comparados.length + 1} produtos)
                      </h3>
                      <Button variant="ghost" size="sm" onClick={() => setSelecionados([])}>
                        Limpar
                      </Button>
                    </div>
                    <TabelaTecnica base={base} linhas={comparados} attrs={attrs} destaque />
                  </div>
                )}

                {/* 7. Comparação de preços */}
                <ComparacaoPrecos base={base} linhas={filtradas} />

                {/* 8. Análise automática */}
                {comparados.length > 0 && (
                  <div className="grid gap-3 lg:grid-cols-2">
                    {comparados.map((l) => (
                      <div key={l.produto.id} className="surface rounded-xl p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="text-sm font-semibold">
                            {l.produto.marca} · {l.produto.referencia ?? l.produto.sku ?? "—"}
                          </div>
                          <Badge variant="outline" className={LEVEL_CLASS[l.level]}>
                            {LEVEL_LABEL[l.level]}
                          </Badge>
                        </div>
                        <AnaliseBloco titulo="Semelhanças técnicas" itens={l.semelhancas} />
                        <AnaliseBloco titulo="Diferenças relevantes" itens={l.diferencas} />
                        <AnaliseBloco
                          titulo="Impacto na aplicação"
                          itens={l.impactos}
                          vazio="Sem impacto identificado com os dados disponíveis."
                        />
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        <ImportarDadosDialog
          open={importOpen}
          onOpenChange={setImportOpen}
          podeEditar={podeEditar}
        />
      </div>
    </TooltipProvider>
  );
}

// ============ Subcomponentes ============

function AnaliseBloco({
  titulo,
  itens,
  vazio = "Sem dados suficientes para concluir.",
}: {
  titulo: string;
  itens: string[];
  vazio?: string;
}) {
  return (
    <div>
      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        {titulo}
      </div>
      {itens.length ? (
        <ul className="mt-1 space-y-1">
          {itens.slice(0, 5).map((t, i) => (
            <li key={i} className="text-sm flex gap-2">
              <CircleDot className="h-3.5 w-3.5 mt-1 shrink-0 text-muted-foreground" />
              <span>{t}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground mt-1">{vazio}</p>
      )}
    </div>
  );
}

function ProximidadeCelula({ score }: { score: number | null }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="w-32 space-y-1">
          <div className="flex items-center gap-1 text-xs">
            <span className="font-medium">{score != null ? `${score.toFixed(1)}%` : "—"}</span>
            <Info className="h-3 w-3 text-muted-foreground" />
          </div>
          <Progress value={score ?? 0} className="h-1.5" />
        </div>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">
        <p className="text-xs">
          {faixaTextual(score)}. O índice soma o peso de cada atributo comparado, aplicando as
          tolerâncias configuradas e penalizando dados ausentes.
        </p>
      </TooltipContent>
    </Tooltip>
  );
}

function RankingTabela({
  linhas,
  base,
  selecionados,
  onToggle,
  podeEditar,
}: {
  linhas: LinhaRanking[];
  base: LoadedProduct;
  selecionados: string[];
  onToggle: (id: string) => void;
  podeEditar: boolean;
}) {
  if (!linhas.length) {
    return (
      <div className="surface rounded-xl p-8 text-center text-sm text-muted-foreground">
        Nenhum equivalente atende aos filtros selecionados.
      </div>
    );
  }
  return (
    <div className="surface rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader className="sticky top-0 bg-card z-10">
            <TableRow>
              <TableHead className="w-10" />
              <TableHead className="w-12">#</TableHead>
              <TableHead className="min-w-[140px]">Marca</TableHead>
              <TableHead className="min-w-[200px]">Produto</TableHead>
              <TableHead>Código</TableHead>
              <TableHead>Proximidade</TableHead>
              <TableHead>Classificação</TableHead>
              <TableHead className="text-right">Preço</TableHead>
              <TableHead className="text-right">Diferença</TableHead>
              <TableHead className="text-right">Eficiência</TableHead>
              <TableHead>Custo-benefício</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {linhas.map((l, i) => {
              const pf = priceFarol(base.product.preco, l.produto.product.preco);
              return (
                <TableRow key={l.produto.id}>
                  <TableCell>
                    <Checkbox
                      checked={selecionados.includes(l.produto.id)}
                      onCheckedChange={() => onToggle(l.produto.id)}
                      aria-label="Adicionar à comparação"
                    />
                  </TableCell>
                  <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                  <TableCell className="font-medium">{l.produto.marca}</TableCell>
                  <TableCell className="max-w-[280px] truncate text-sm">{l.produto.nome}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {l.produto.referencia ?? l.produto.sku ?? "—"}
                  </TableCell>
                  <TableCell>
                    <ProximidadeCelula score={l.score} />
                  </TableCell>
                  <TableCell>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge variant="outline" className={LEVEL_CLASS[l.level]}>
                          {LEVEL_LABEL[l.level]}
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p className="text-xs">{LEVEL_DESCRIPTION[l.level]}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className={cn("px-2 py-0.5 rounded text-xs", PRICE_FAROL_CLASS[pf])}>
                      {l.produto.product.preco != null
                        ? formatBRL(l.produto.product.preco)
                        : PRICE_AVAILABILITY_LABEL[
                            l.produto.product.precoDisponibilidade ?? "nao_informado"
                          ]}
                    </span>
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {formatPctDiff(l.precoDiffPct)}
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {formatSpec(l.produto.product.specs["eficiencia"], "lm/W")}
                  </TableCell>
                  <TableCell className="text-sm">
                    {l.custoBeneficio != null
                      ? `${l.custoBeneficio.toFixed(0)} · ${cbCategoria(l.custoBeneficio)}`
                      : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={STATUS_CLASS[l.status]}>
                      {STATUS_LABEL[l.status]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" aria-label="Ações">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onToggle(l.produto.id)}>
                          Adicionar à comparação
                        </DropdownMenuItem>
                        <DropdownMenuItem disabled={!podeEditar}>
                          Editar comparativo
                        </DropdownMenuItem>
                        <DropdownMenuItem disabled>Histórico</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem disabled>Gerar PDF</DropdownMenuItem>
                        <DropdownMenuItem disabled>Compartilhar por e-mail</DropdownMenuItem>
                        <DropdownMenuItem disabled>Compartilhar por WhatsApp</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem disabled={!podeEditar} className="text-destructive">
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function CardProduto({
  linha,
  selecionado,
  onToggle,
}: {
  linha: LinhaRanking;
  selecionado: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="surface rounded-xl p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <Badge variant="secondary">{linha.produto.marca}</Badge>
          <div className="text-sm font-medium mt-1 truncate">{linha.produto.nome}</div>
          <div className="text-xs text-muted-foreground font-mono">
            {linha.produto.referencia ?? linha.produto.sku ?? "—"}
          </div>
        </div>
        <Badge variant="outline" className={LEVEL_CLASS[linha.level]}>
          {LEVEL_LABEL[linha.level]}
        </Badge>
      </div>
      <ProximidadeCelula score={linha.score} />
      <div className="flex items-center justify-between text-sm">
        <span className="font-semibold">{formatBRL(linha.produto.product.preco)}</span>
        <span className="text-muted-foreground">{formatPctDiff(linha.precoDiffPct)}</span>
      </div>
      <div className="text-xs space-y-1">
        <div className="text-muted-foreground uppercase tracking-wide">Semelhanças</div>
        {linha.semelhancas.slice(0, 3).map((s, i) => (
          <div key={i} className="truncate">
            {s}
          </div>
        ))}
        {!linha.semelhancas.length && <div className="text-muted-foreground">—</div>}
        <div className="text-muted-foreground uppercase tracking-wide pt-1">Diferenças</div>
        {linha.diferencas.slice(0, 3).map((s, i) => (
          <div key={i} className="truncate">
            {s}
          </div>
        ))}
        {!linha.diferencas.length && <div className="text-muted-foreground">—</div>}
      </div>
      <div className="flex items-center justify-between pt-1">
        <Badge variant="outline" className={STATUS_CLASS[linha.status]}>
          {STATUS_LABEL[linha.status]}
        </Badge>
        <label className="flex items-center gap-2 text-xs">
          <Checkbox checked={selecionado} onCheckedChange={onToggle} />
          Adicionar à comparação
        </label>
      </div>
    </div>
  );
}

function TabelaTecnica({
  base,
  linhas,
  attrs,
  destaque,
}: {
  base: LoadedProduct;
  linhas: LinhaRanking[];
  attrs: { key: string; name: string; unit?: string }[];
  destaque?: boolean;
}) {
  if (!linhas.length) {
    return (
      <div className="surface rounded-xl p-8 text-center text-sm text-muted-foreground">
        Selecione ao menos um produto para comparar.
      </div>
    );
  }
  return (
    <div className={cn(!destaque && "surface rounded-xl", "overflow-hidden")}>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="sticky left-0 bg-card min-w-[160px]">Atributo</TableHead>
              <TableHead className="min-w-[160px]">{base.marca} (referência)</TableHead>
              {linhas.map((l) => (
                <TableHead key={l.produto.id} className="min-w-[160px]">
                  {l.produto.marca}
                  <span className="block text-[11px] font-normal text-muted-foreground">
                    {l.produto.referencia ?? l.produto.sku ?? "—"}
                  </span>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {attrs.map((a) => (
              <TableRow key={a.key}>
                <TableCell className="sticky left-0 bg-card text-sm text-muted-foreground">
                  {a.name}
                </TableCell>
                <TableCell className="text-sm font-medium">
                  {formatSpec(base.product.specs[a.key], a.unit)}
                </TableCell>
                {linhas.map((l) => {
                  const cmp = l.atributos.find((x) => x.attributeKey === a.key);
                  const farol = cmp?.farol ?? "sem_dado";
                  return (
                    <TableCell key={l.produto.id}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 px-2 py-0.5 rounded text-sm",
                              CELL_FAROL_CLASS[farol],
                            )}
                          >
                            <CircleDot className="h-3 w-3" />
                            {formatSpec(l.produto.product.specs[a.key], a.unit)}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p className="text-xs font-medium">{CELL_FAROL_LABEL[farol]}</p>
                          <p className="text-xs text-muted-foreground">
                            {cmp?.descricao ?? "Informação não disponível."}
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
            <TableRow>
              <TableCell className="sticky left-0 bg-card text-sm text-muted-foreground">
                Preço
              </TableCell>
              <TableCell className="text-sm font-medium">{formatBRL(base.product.preco)}</TableCell>
              {linhas.map((l) => {
                const pf = priceFarol(base.product.preco, l.produto.product.preco);
                return (
                  <TableCell key={l.produto.id}>
                    <span className={cn("px-2 py-0.5 rounded text-sm", PRICE_FAROL_CLASS[pf])}>
                      {formatBRL(l.produto.product.preco)}
                    </span>
                    <span className="block text-[11px] text-muted-foreground">
                      {PRICE_FAROL_LABEL[pf]}
                    </span>
                  </TableCell>
                );
              })}
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function ComparacaoPrecos({ base, linhas }: { base: LoadedProduct; linhas: LinhaRanking[] }) {
  const dados = [
    { nome: `${base.marca} (ref.)`, preco: base.product.preco, ref: true, porMetro: base.product.precoPorMetro },
    ...linhas
      .slice(0, 12)
      .map((l) => ({
        nome: l.produto.marca,
        preco: l.produto.product.preco,
        ref: false,
        porMetro: l.produto.product.precoPorMetro,
      })),
  ].filter((d) => d.preco != null) as {
    nome: string;
    preco: number;
    ref: boolean;
    porMetro: number | null;
  }[];

  if (dados.length < 2) {
    return (
      <div className="surface rounded-xl p-6 text-sm text-muted-foreground">
        Comparação de preços indisponível: é preciso ter preço informado na referência e em pelo
        menos um concorrente. Preço ausente não é tratado como zero.
      </div>
    );
  }

  const max = Math.max(...dados.map((d) => d.preco));
  return (
    <div className="surface rounded-xl p-4 space-y-4">
      <h3 className="text-sm font-semibold">Comparação de preços</h3>
      <div className="space-y-2">
        {dados.map((d, i) => {
          const pf = d.ref ? "proximo" : priceFarol(base.product.preco, d.preco);
          return (
            <div key={i} className="flex items-center gap-3">
              <span className="w-32 shrink-0 text-xs truncate">{d.nome}</span>
              <div className="flex-1 h-5 rounded bg-muted overflow-hidden">
                <div
                  className={cn("h-full rounded", PRICE_FAROL_CLASS[pf])}
                  style={{ width: `${(d.preco / max) * 100}%` }}
                />
              </div>
              <span className="w-28 shrink-0 text-right text-xs font-medium">
                {formatBRL(d.preco)}
              </span>
              <span className="w-28 shrink-0 text-right text-[11px] text-muted-foreground">
                {d.porMetro != null ? `${formatBRL(d.porMetro)}/m` : "—"}
              </span>
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
        {(Object.keys(PRICE_FAROL_LABEL) as (keyof typeof PRICE_FAROL_LABEL)[]).map((k) => (
          <span key={k} className="flex items-center gap-1">
            <span className={cn("h-2.5 w-2.5 rounded-sm", PRICE_FAROL_CLASS[k])} />
            {PRICE_FAROL_LABEL[k]}
          </span>
        ))}
      </div>
    </div>
  );
}
