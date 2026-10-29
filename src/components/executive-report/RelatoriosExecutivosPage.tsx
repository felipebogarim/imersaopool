import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/EmptyState";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import {
  FileText,
  Search,
  MoreVertical,
  Mail,
  MessageCircle,
  Link as LinkIcon,
  CheckCircle2,
  Clock,
  Compass,
  ArrowRight,
  ExternalLink,
  Building2,
  AlertCircle,
} from "lucide-react";
import {
  EMPTY_LIST_FILTERS,
  matchesListFilters,
  reportClientId,
  reportListMeta,
  type ListClient,
  type ListRep,
  type ReportListFilters,
  type ReportListMeta,
} from "@/lib/visao-imersao-2-list";
import {
  partnerKindLabel,
  readPartner,
} from "@/lib/visao-imersao-2-partner";

interface ExecSummary {
  id: string;
  immersion_report_id: string;
  status: string;
  report_title: string | null;
  current_version: number;
  created_at: string;
  updated_at: string;
}

export function RelatoriosExecutivosPage() {
  const navigate = useNavigate();

  // 1. Busca todos os relatórios criados na visão de imersão comercial
  const { data: reports = [], isLoading: isLoadingReports } = useQuery({
    queryKey: ["vi2-reports"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("field_immersion_v2_reports")
        .select("id, client_name, visit_date, source_filename, content_markdown, structured_data, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  // 2. Busca registros persistidos de relatórios executivos para mapear status (fechado, revisão, versão)
  const { data: execReports = [], isLoading: isLoadingExec } = useQuery({
    queryKey: ["executive-reports-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("executive_reports")
        .select("id, immersion_report_id, status, report_title, current_version, created_at, updated_at");
      if (error) {
        console.warn("[RelatoriosExecutivos] Erro ao carregar executive_reports:", error);
        return [];
      }
      return (data ?? []) as ExecSummary[];
    },
  });

  const execByImmersionId = useMemo(() => {
    const map = new Map<string, ExecSummary>();
    for (const ex of execReports) {
      if (ex.immersion_report_id) {
        map.set(ex.immersion_report_id, ex);
      }
    }
    return map;
  }, [execReports]);

  // 3. Filtros canônicos da lista de visão de imersão comercial
  const [listFilters, setListFilters] = useState<ReportListFilters>(EMPTY_LIST_FILTERS);
  const [statusFiltro, setStatusFiltro] = useState<string>("");

  const { data: listReps = [] } = useQuery({
    queryKey: ["vi2-list-reps"],
    queryFn: async () => {
      const { data } = await supabase.from("representatives").select("nome, representacao, regiao");
      return (data ?? []) as ListRep[];
    },
  });

  const resolvedIds = useMemo(
    () => Array.from(new Set((reports as any[]).map((r) => reportClientId(r.structured_data)).filter(Boolean))),
    [reports],
  );

  const { data: listClients = [] } = useQuery({
    queryKey: ["vi2-list-clients", resolvedIds],
    enabled: resolvedIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("clients")
        .select("id, categoria, representatives:representative_id (nome, representacao, regiao)")
        .in("id", resolvedIds);
      return (data ?? []) as unknown as ListClient[];
    },
  });

  const rowsMeta = useMemo(() => {
    const byId = new Map(listClients.map((c) => [c.id, c]));
    return (reports as any[]).map((r) => {
      const exec = execByImmersionId.get(r.id);
      return {
        r,
        exec,
        meta: reportListMeta(r, byId, listReps),
      };
    });
  }, [reports, listClients, listReps, execByImmersionId]);

  const filteredRows = useMemo(() => {
    return rowsMeta.filter(({ r, exec, meta }) => {
      if (!matchesListFilters(r, meta, listFilters)) return false;
      if (statusFiltro) {
        if (statusFiltro === "closed" && exec?.status !== "closed") return false;
        if (statusFiltro === "review" && exec?.status !== "review") return false;
        if (statusFiltro === "pending" && !!exec) return false;
        if (statusFiltro === "has_exec" && !exec) return false;
      }
      return true;
    });
  }, [rowsMeta, listFilters, statusFiltro]);

  const filterOptions = useMemo(() => {
    const uniq = (pick: (m: ReportListMeta) => string) =>
      Array.from(new Set(rowsMeta.map((x) => pick(x.meta)).filter(Boolean))).sort((a, b) =>
        a.localeCompare(b, "pt-BR"),
      );
    return {
      representante: uniq((m) => m.representante),
      regiao: uniq((m) => m.regiao),
      categoria: uniq((m) => m.categoria),
    };
  }, [rowsMeta]);

  function linkExecutivo(r: any) {
    return `${window.location.origin}/visao-imersao-2/${r.id}/executivo`;
  }

  function linkVisaoImersao(r: any) {
    return `${window.location.origin}/visao-imersao-2/${r.id}`;
  }

  function resumoExecutivo(r: any, meta: ReportListMeta) {
    const dt = r.visit_date ? new Date(`${r.visit_date}T00:00:00`).toLocaleDateString("pt-BR") : "—";
    const rep = meta.representante ? ` · Rep: ${meta.representante}` : "";
    return `Relatório Executivo · ${r.client_name}${rep} · ${dt}\n${linkExecutivo(r)}`;
  }

  function compartilharEmail(r: any, meta: ReportListMeta) {
    const subject = `Relatório Executivo · ${r.client_name}${meta.representante ? ` - ${meta.representante}` : ""}`;
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(resumoExecutivo(r, meta))}`;
  }

  function compartilharWhats(r: any, meta: ReportListMeta) {
    window.open(`https://wa.me/?text=${encodeURIComponent(resumoExecutivo(r, meta))}`, "_blank");
  }

  const isLoading = isLoadingReports || isLoadingExec;
  const hasActiveFilters = Boolean(
    listFilters.busca ||
      listFilters.dataDe ||
      listFilters.dataAte ||
      listFilters.representante ||
      listFilters.regiao ||
      listFilters.categoria ||
      statusFiltro,
  );

  return (
    <div>
      <PageHeader
        title="Relatórios Executivos"
        subtitle="Sínteses executivas e camadas de decisão geradas a partir das imersões comerciais em campo"
        actions={
          <Button asChild variant="outline" size="sm">
            <Link to="/visao-imersao-2">
              <Compass className="mr-1.5 h-4 w-4" />
              Visão Imersões em Campo
            </Link>
          </Button>
        }
      />

      <div className="p-4 sm:p-8 space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
            <Clock className="mr-2 h-4 w-4 animate-spin" />
            Carregando relatórios executivos...
          </div>
        ) : reports.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="Nenhum relatório de imersão encontrado"
            description="Os relatórios executivos são gerados a partir das imersões cadastradas na Visão de Imersão Comercial."
            action={
              <Button asChild>
                <Link to="/visao-imersao-2">
                  <Compass className="mr-1.5 h-4 w-4" />
                  Ir para Visão Imersão Comercial
                </Link>
              </Button>
            }
          />
        ) : (
          <div className="space-y-3">
            {/* Barra de Filtros idêntica à Visão de Imersão Comercial */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-[220px] flex-1">
                <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={listFilters.busca}
                  onChange={(e) => setListFilters((f) => ({ ...f, busca: e.target.value }))}
                  placeholder="Pesquisar por nome ou palavra-chave"
                  className="pl-8"
                  aria-label="Pesquisar relatórios"
                />
              </div>

              {(["representante", "regiao", "categoria"] as const).map((k) => (
                <select
                  key={k}
                  value={listFilters[k]}
                  onChange={(e) => setListFilters((f) => ({ ...f, [k]: e.target.value }))}
                  className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                  aria-label={`Filtrar por ${k === "regiao" ? "região" : k}`}
                >
                  <option value="">
                    {k === "representante"
                      ? "Todos os representantes"
                      : k === "regiao"
                      ? "Todas as regiões"
                      : "Todas as categorias"}
                  </option>
                  {filterOptions[k].map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              ))}

              <select
                value={statusFiltro}
                onChange={(e) => setStatusFiltro(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                aria-label="Filtrar por status executivo"
              >
                <option value="">Todos os status executivos</option>
                <option value="closed">Fechado</option>
                <option value="review">Em revisão</option>
                <option value="has_exec">Com relatório estruturado</option>
                <option value="pending">Pendente / Não estruturado</option>
              </select>

              <Input
                type="date"
                value={listFilters.dataDe}
                onChange={(e) => setListFilters((f) => ({ ...f, dataDe: e.target.value }))}
                className="h-9 w-[140px]"
                aria-label="Data da visita a partir de"
                title="Data da visita: de"
              />
              <Input
                type="date"
                value={listFilters.dataAte}
                onChange={(e) => setListFilters((f) => ({ ...f, dataAte: e.target.value }))}
                className="h-9 w-[140px]"
                aria-label="Data da visita até"
                title="Data da visita: até"
              />

              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setListFilters(EMPTY_LIST_FILTERS);
                    setStatusFiltro("");
                  }}
                >
                  Limpar
                </Button>
              )}

              <span className="text-xs text-muted-foreground ml-auto">
                {filteredRows.length} de {rowsMeta.length} {rowsMeta.length === 1 ? "relatório" : "relatórios"}
              </span>
            </div>

            {/* Lista de Relatórios Executivos */}
            <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
              {filteredRows.length === 0 ? (
                <li className="bg-card p-6 text-center text-sm text-muted-foreground">
                  Nenhum relatório encontrado com os filtros atuais.
                </li>
              ) : (
                filteredRows.map(({ r, exec, meta }) => {
                  const partner = readPartner(r.structured_data);
                  const isClosed = exec?.status === "closed";
                  const isReview = exec?.status === "review";

                  return (
                    <li
                      key={r.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card p-4 hover:bg-muted/30 transition-colors"
                    >
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate font-semibold text-base text-foreground">
                            {r.client_name}
                          </p>

                          {partner && (
                            <Badge variant="secondary" className="text-[10px]">
                              Parceiro · {partnerKindLabel(partner)}
                            </Badge>
                          )}

                          {isClosed ? (
                            <Badge
                              variant="outline"
                              className="border-emerald-500/50 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 text-[10px]"
                            >
                              <CheckCircle2 className="mr-1 h-3 w-3 inline text-emerald-600" />
                              Fechado{exec?.current_version ? ` · v${exec.current_version}` : ""}
                            </Badge>
                          ) : isReview ? (
                            <Badge
                              variant="outline"
                              className="border-amber-500/50 bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 text-[10px]"
                            >
                              <Clock className="mr-1 h-3 w-3 inline text-amber-600" />
                              Em revisão
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground text-[10px] border-dashed">
                              Pendente estruturação
                            </Badge>
                          )}
                        </div>

                        <p className="truncate text-xs text-muted-foreground">
                          {r.visit_date
                            ? new Date(`${r.visit_date}T00:00:00`).toLocaleDateString("pt-BR")
                            : "—"}{" "}
                          · {r.source_filename || "Arquivo canônico de imersão"}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap justify-between sm:justify-end">
                        {/* Metadados idênticos à visão de imersão */}
                        <div className="flex flex-wrap items-center justify-end gap-1">
                          {meta.representante && (
                            <Badge variant="outline" className="text-[10px]">
                              Rep: {meta.representante}
                            </Badge>
                          )}
                          {meta.regiao && (
                            <Badge variant="outline" className="text-[10px]">
                              {meta.regiao}
                            </Badge>
                          )}
                          {meta.categoria && (
                            <Badge variant="secondary" className="text-[10px]">
                              {meta.categoria}
                            </Badge>
                          )}
                          {r.visit_date && (
                            <Badge variant="outline" className="text-[10px]">
                              {new Date(`${r.visit_date}T00:00:00`).toLocaleDateString("pt-BR")}
                            </Badge>
                          )}
                        </div>

                        {/* Ações principais */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          <Button
                            size="sm"
                            className="h-8 gap-1"
                            onClick={() =>
                              navigate({
                                to: "/visao-imersao-2/$reportId/executivo",
                                params: { reportId: r.id },
                              })
                            }
                          >
                            <FileText className="h-3.5 w-3.5" />
                            Relatório Executivo
                          </Button>

                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8"
                            onClick={() =>
                              navigate({
                                to: "/visao-imersao-2/$reportId",
                                params: { reportId: r.id },
                              })
                            }
                          >
                            Visão Imersão
                          </Button>

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Mais ações">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => {
                                  void navigator.clipboard?.writeText(linkExecutivo(r));
                                  toast.success("Link do relatório executivo copiado.");
                                }}
                              >
                                <LinkIcon className="mr-2 h-4 w-4" /> Copiar link do executivo
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => {
                                  void navigator.clipboard?.writeText(linkVisaoImersao(r));
                                  toast.success("Link da visão de imersão copiado.");
                                }}
                              >
                                <LinkIcon className="mr-2 h-4 w-4" /> Copiar link da visão imersão
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => compartilharWhats(r, meta)}>
                                <MessageCircle className="mr-2 h-4 w-4" /> Compartilhar por WhatsApp
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => compartilharEmail(r, meta)}>
                                <Mail className="mr-2 h-4 w-4" /> Compartilhar por e-mail
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() =>
                                  window.open(`/visao-imersao-2/${r.id}/executivo`, "_blank", "noopener")
                                }
                              >
                                <ExternalLink className="mr-2 h-4 w-4" /> Abrir executivo em nova aba
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    </li>
                  );
                })
              )}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
