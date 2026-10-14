import React, { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Building2,
  MapPin,
  Briefcase,
  Users,
  Search,
  Pencil,
  Trash2,
  Eye,
  Plus,
  ShieldCheck,
  CheckCircle2,
  SlidersHorizontal,
  MessageCircle,
  Loader2,
} from "lucide-react";
import type { RepStructure } from "@/lib/estrutura-rep/types";
import { MODELO_ESCRITORIO_LABEL, MODELO_ATUACAO_LABEL, RECURSOS_CONFIG } from "@/lib/estrutura-rep/types";
import { shareRepStructureByWhatsapp } from "@/lib/estrutura-rep/whatsapp";
import { toast } from "sonner";

interface RepListViewProps {
  reps: Array<{
    id: string;
    nome: string;
    representacao?: string | null;
    regiao?: string | null;
    email?: string | null;
    telefone?: string | null;
  }>;
  structures: Record<string, RepStructure>;
  onViewPanel: (repId: string) => void;
  onEdit: (repId: string) => void;
  onDelete: (repId: string, nome: string) => void;
  onAddNew: () => void;
  onShareWhats?: (rep: RepListViewProps["reps"][0]) => void;
}

export function RepListView({
  reps,
  structures,
  onViewPanel,
  onEdit,
  onDelete,
  onAddNew,
  onShareWhats,
}: RepListViewProps) {
  const [search, setSearch] = useState("");
  const [filterModelo, setFilterModelo] = useState<string>("all");
  const [sharingId, setSharingId] = useState<string | null>(null);

  const handleShareWhats = async (rep: typeof reps[0]) => {
    if (onShareWhats) {
      onShareWhats(rep);
      return;
    }
    const struct = structures[rep.id];
    if (!struct) {
      toast.error("Estrutura não encontrada para este representante.");
      return;
    }
    setSharingId(rep.id);
    try {
      await shareRepStructureByWhatsapp(struct, { email: rep.email, telefone: rep.telefone });
    } catch (err: any) {
      toast.error(err?.message || "Erro ao compartilhar no WhatsApp");
    } finally {
      setSharingId(null);
    }
  };

  const filteredReps = useMemo(() => {
    return reps.filter((rep) => {
      const struct = structures[rep.id];
      const term = search.toLowerCase().trim();

      if (term) {
        const matchNome = rep.nome.toLowerCase().includes(term);
        const matchEmpresa = (rep.representacao || struct?.empresa_representacao || "")
          .toLowerCase()
          .includes(term);
        const matchRegiao = (rep.regiao || struct?.regiao_principal || "")
          .toLowerCase()
          .includes(term);
        const matchUf = struct?.estados_atendidos?.some((uf) => uf.toLowerCase().includes(term));
        const matchMarca = struct?.marcas_representadas?.some((m) =>
          m.nome.toLowerCase().includes(term)
        );

        if (!matchNome && !matchEmpresa && !matchRegiao && !matchUf && !matchMarca) {
          return false;
        }
      }

      if (filterModelo !== "all") {
        if (struct?.modelo_escritorio !== filterModelo) return false;
      }

      return true;
    });
  }, [reps, structures, search, filterModelo]);

  // Indicadores consolidados do topo
  const kpis = useMemo(() => {
    const totalReps = reps.length;
    const allUfs = new Set<string>();
    let totalMarcasCount = 0;
    let totalEquipeCount = 0;

    Object.values(structures).forEach((s) => {
      s.estados_atendidos?.forEach((uf) => allUfs.add(uf));
      totalMarcasCount += s.marcas_representadas?.length || 0;
      totalEquipeCount += s.equipe?.length || 0;
    });

    return {
      totalReps,
      totalUfs: allUfs.size,
      totalMarcasCount,
      totalEquipeCount,
    };
  }, [reps, structures]);

  return (
    <div className="space-y-4">
      {/* Cards de Resumo Executivo */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-xl bg-card border shadow-2xs">
          <div className="flex items-center gap-1.5 text-muted-foreground text-[11px] font-medium uppercase tracking-wider">
            <Building2 className="h-3.5 w-3.5 text-primary" />
            <span>Representações</span>
          </div>
          <div className="text-xl sm:text-2xl font-bold text-foreground mt-1">
            {kpis.totalReps} <span className="text-xs font-normal text-muted-foreground">empresas</span>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-card border shadow-2xs">
          <div className="flex items-center gap-1.5 text-muted-foreground text-[11px] font-medium uppercase tracking-wider">
            <MapPin className="h-3.5 w-3.5 text-primary" />
            <span>Cobertura Geral</span>
          </div>
          <div className="text-xl sm:text-2xl font-bold text-foreground mt-1">
            {kpis.totalUfs} <span className="text-xs font-normal text-muted-foreground">UFs atendidas</span>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-card border shadow-2xs">
          <div className="flex items-center gap-1.5 text-muted-foreground text-[11px] font-medium uppercase tracking-wider">
            <Briefcase className="h-3.5 w-3.5 text-primary" />
            <span>Portfólio Ativo</span>
          </div>
          <div className="text-xl sm:text-2xl font-bold text-foreground mt-1">
            {kpis.totalMarcasCount} <span className="text-xs font-normal text-muted-foreground">marcas ligadas</span>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-card border shadow-2xs">
          <div className="flex items-center gap-1.5 text-muted-foreground text-[11px] font-medium uppercase tracking-wider">
            <Users className="h-3.5 w-3.5 text-primary" />
            <span>Pessoas no Backoffice</span>
          </div>
          <div className="text-xl sm:text-2xl font-bold text-foreground mt-1">
            {kpis.totalEquipeCount} <span className="text-xs font-normal text-muted-foreground">integrantes</span>
          </div>
        </div>
      </div>

      {/* Barra de Filtros e Busca */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 bg-card rounded-xl border shadow-2xs">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por representante, empresa, UF ou marca..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-xs bg-muted/20"
          />
        </div>

        <div className="flex items-center gap-2">
          {/* Filtro por Modelo de Escritório */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
            <button
              onClick={() => setFilterModelo("all")}
              className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition ${
                filterModelo === "all"
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-muted-foreground border-border hover:bg-muted"
              }`}
            >
              Todos ({reps.length})
            </button>
            <button
              onClick={() => setFilterModelo("escritorio_fisico")}
              className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition ${
                filterModelo === "escritorio_fisico"
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-muted-foreground border-border hover:bg-muted"
              }`}
            >
              Físico
            </button>
            <button
              onClick={() => setFilterModelo("home_office")}
              className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition ${
                filterModelo === "home_office"
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-muted-foreground border-border hover:bg-muted"
              }`}
            >
              Home Office
            </button>
            <button
              onClick={() => setFilterModelo("hibrido")}
              className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition ${
                filterModelo === "hibrido"
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-muted-foreground border-border hover:bg-muted"
              }`}
            >
              Híbrido
            </button>
          </div>

          <Button size="sm" onClick={onAddNew} className="gap-1.5 h-9 text-xs font-semibold shrink-0">
            <Plus className="h-3.5 w-3.5" />
            <span>Novo</span>
          </Button>
        </div>
      </div>

      {/* Tabela de Representantes */}
      <div className="bg-card rounded-xl border shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/40 uppercase tracking-wider text-[11px] font-bold text-muted-foreground border-b">
              <tr>
                <th className="py-3 px-4">Representante & Empresa</th>
                <th className="py-3 px-4">Território (UFs)</th>
                <th className="py-3 px-4">Marcas Representadas</th>
                <th className="py-3 px-4">Estrutura Operacional</th>
                <th className="py-3 px-4">Equipe</th>
                <th className="py-3 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {filteredReps.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-muted-foreground">
                    <Building2 className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    <p className="font-medium text-foreground">Nenhum representante encontrado</p>
                    <p className="text-[11px] mt-0.5">Tente outro termo de busca ou adicione um novo representante.</p>
                    <Button size="sm" variant="outline" onClick={onAddNew} className="mt-3 text-xs gap-1.5">
                      <Plus className="h-3 w-3" />
                      Cadastrar Novo Representante
                    </Button>
                  </td>
                </tr>
              ) : (
                filteredReps.map((rep) => {
                  const struct = structures[rep.id];
                  const ufs = struct?.estados_atendidos || [];
                  const marcas = struct?.marcas_representadas || [];
                  const equipe = struct?.equipe || [];
                  const modeloEscritorio = struct?.modelo_escritorio
                    ? MODELO_ESCRITORIO_LABEL[struct.modelo_escritorio]
                    : "—";
                  const modeloAtuacao = struct?.modelo_atuacao
                    ? MODELO_ATUACAO_LABEL[struct.modelo_atuacao]
                    : "—";
                  const totalRecursos = struct?.recursos_operacionais
                    ? RECURSOS_CONFIG.filter((r) => Boolean(struct.recursos_operacionais[r.key])).length
                    : 0;

                  return (
                    <tr
                      key={rep.id}
                      className="hover:bg-muted/30 transition group"
                    >
                      {/* Representante & Empresa */}
                      <td className="py-3.5 px-4 min-w-[220px]">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary border border-primary/20 flex items-center justify-center font-bold text-sm shrink-0">
                            {rep.nome.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-sm text-foreground flex items-center gap-1.5 truncate">
                              <span
                                onClick={() => onViewPanel(rep.id)}
                                className="cursor-pointer hover:text-primary transition"
                              >
                                {rep.nome}
                              </span>
                            </div>
                            <div className="text-[11px] text-muted-foreground truncate">
                              {rep.representacao || struct?.empresa_representacao || "Representação Comercial"}
                            </div>
                            <div className="text-[10px] text-muted-foreground/80 mt-0.5 flex items-center gap-1">
                              <MapPin className="h-2.5 w-2.5 text-primary" />
                              <span>
                                {struct?.cidade_base && struct?.estado_base
                                  ? `${struct.cidade_base}/${struct.estado_base}`
                                  : rep.regiao || "Base operacional"}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Território (UFs) */}
                      <td className="py-3.5 px-4 min-w-[170px]">
                        <div className="flex flex-wrap gap-1 max-w-[200px]">
                          {ufs.slice(0, 5).map((uf) => (
                            <Badge
                              key={uf}
                              variant="secondary"
                              className="text-[10px] font-bold px-1.5 py-0 h-5 bg-primary/10 text-primary border border-primary/20"
                            >
                              {uf}
                            </Badge>
                          ))}
                          {ufs.length > 5 && (
                            <Badge
                              variant="outline"
                              className="text-[10px] font-medium px-1 py-0 h-5 text-muted-foreground"
                            >
                              +{ufs.length - 5}
                            </Badge>
                          )}
                          {ufs.length === 0 && (
                            <span className="text-[11px] text-muted-foreground italic">Nenhuma UF</span>
                          )}
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-1">
                          {ufs.length} {ufs.length === 1 ? "estado atendido" : "estados atendidos"}
                        </div>
                      </td>

                      {/* Marcas Representadas */}
                      <td className="py-3.5 px-4 min-w-[190px]">
                        <div className="flex flex-col gap-1 max-w-[220px]">
                          {marcas.slice(0, 2).map((m) => (
                            <div key={m.id} className="flex items-center gap-1.5 truncate">
                              <div className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                              <span className="font-semibold text-foreground/90 truncate">{m.nome}</span>
                              <span className="text-[10px] text-muted-foreground truncate">
                                ({m.segmento || m.modelo_negocio})
                              </span>
                            </div>
                          ))}
                          {marcas.length > 2 && (
                            <span className="text-[10px] text-muted-foreground italic">
                              +{marcas.length - 2} outras marcas
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Estrutura Operacional */}
                      <td className="py-3.5 px-4 min-w-[170px]">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5">
                            <Badge variant="outline" className="text-[10px] font-medium border-border/80">
                              {modeloEscritorio}
                            </Badge>
                          </div>
                          <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <ShieldCheck className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                            <span>{totalRecursos}/6 funções ativas</span>
                          </div>
                        </div>
                      </td>

                      {/* Equipe */}
                      <td className="py-3.5 px-4 min-w-[130px]">
                        <div className="font-semibold text-foreground">
                          {equipe.length} {equipe.length === 1 ? "integrante" : "integrantes"}
                        </div>
                        <div className="text-[10px] text-muted-foreground truncate max-w-[120px]">
                          {modeloAtuacao}
                        </div>
                      </td>

                      {/* Ações */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap min-w-[240px]">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => onViewPanel(rep.id)}
                            className="h-7 px-2.5 text-[11px] gap-1 font-semibold shadow-2xs"
                          >
                            <Eye className="h-3 w-3" />
                            <span>Radiografia</span>
                          </Button>

                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleShareWhats(rep)}
                            disabled={sharingId === rep.id}
                            className="h-7 px-2 text-[11px] gap-1 font-medium text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 border-emerald-500/30"
                            title="Compartilhar no WhatsApp com PDF executivo formatado"
                          >
                            {sharingId === rep.id ? (
                              <Loader2 className="h-3 w-3 animate-spin text-emerald-600" />
                            ) : (
                              <MessageCircle className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                            )}
                            <span className="hidden sm:inline">Whats</span>
                          </Button>

                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onEdit(rep.id)}
                            className="h-7 px-2.5 text-[11px] gap-1 font-medium hover:bg-muted"
                          >
                            <Pencil className="h-3 w-3" />
                            <span>Editar</span>
                          </Button>

                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => onDelete(rep.id, rep.nome)}
                            className="h-7 px-2 text-[11px] text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            title="Excluir representante"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
