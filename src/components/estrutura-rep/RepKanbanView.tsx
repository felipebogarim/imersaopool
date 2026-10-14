import React, { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Building2,
  Home,
  Laptop,
  Users,
  MapPin,
  Briefcase,
  Eye,
  Pencil,
  Trash2,
  Plus,
  ShieldCheck,
  Layers,
  MessageCircle,
  Loader2,
} from "lucide-react";
import type { RepStructure, ModeloEscritorio } from "@/lib/estrutura-rep/types";
import { MODELO_ESCRITORIO_LABEL, MODELO_ATUACAO_LABEL, RECURSOS_CONFIG } from "@/lib/estrutura-rep/types";
import { shareRepStructureByWhatsapp } from "@/lib/estrutura-rep/whatsapp";
import { toast } from "sonner";

interface RepKanbanViewProps {
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
  onShareWhats?: (rep: RepKanbanViewProps["reps"][0]) => void;
}

type GroupBy = "modelo_escritorio" | "modelo_atuacao";

export function RepKanbanView({
  reps,
  structures,
  onViewPanel,
  onEdit,
  onDelete,
  onAddNew,
  onShareWhats,
}: RepKanbanViewProps) {
  const [groupBy, setGroupBy] = useState<GroupBy>("modelo_escritorio");
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

  const columns = useMemo(() => {
    if (groupBy === "modelo_escritorio") {
      return [
        {
          key: "escritorio_fisico",
          label: "Escritório Físico",
          icon: Building2,
          color: "border-primary/30 bg-primary/5 text-primary",
        },
        {
          key: "home_office",
          label: "Home Office",
          icon: Home,
          color: "border-amber-500/30 bg-amber-500/5 text-amber-600 dark:text-amber-400",
        },
        {
          key: "hibrido",
          label: "Estrutura Híbrida",
          icon: Laptop,
          color: "border-blue-500/30 bg-blue-500/5 text-blue-600 dark:text-blue-400",
        },
        {
          key: "sem_escritorio",
          label: "Sem Escritório",
          icon: Layers,
          color: "border-slate-500/30 bg-slate-500/5 text-slate-600 dark:text-slate-400",
        },
      ];
    } else {
      return [
        {
          key: "equipe",
          label: "Estrutura com Equipe",
          icon: Users,
          color: "border-primary/30 bg-primary/5 text-primary",
        },
        {
          key: "individual",
          label: "Atuação Individual",
          icon: Briefcase,
          color: "border-indigo-500/30 bg-indigo-500/5 text-indigo-600 dark:text-indigo-400",
        },
      ];
    }
  }, [groupBy]);

  const cardsByColumn = useMemo(() => {
    const acc: Record<string, typeof reps> = {};
    columns.forEach((col) => {
      acc[col.key] = [];
    });

    reps.forEach((rep) => {
      const struct = structures[rep.id];
      const colKey =
        groupBy === "modelo_escritorio"
          ? struct?.modelo_escritorio || "escritorio_fisico"
          : struct?.modelo_atuacao || "equipe";

      if (acc[colKey]) {
        acc[colKey].push(rep);
      } else {
        // Fallback para primeira coluna se houver discrepância
        acc[columns[0].key]?.push(rep);
      }
    });

    return acc;
  }, [reps, structures, columns, groupBy]);

  return (
    <div className="space-y-4">
      {/* Barra de Controle de Agrupamento */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 bg-card rounded-xl border shadow-2xs">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-muted-foreground">Agrupar quadro por:</span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setGroupBy("modelo_escritorio")}
              className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition ${
                groupBy === "modelo_escritorio"
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-muted-foreground border-border hover:bg-muted"
              }`}
            >
              Modelo de Escritório
            </button>
            <button
              onClick={() => setGroupBy("modelo_atuacao")}
              className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition ${
                groupBy === "modelo_atuacao"
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-muted-foreground border-border hover:bg-muted"
              }`}
            >
              Modelo de Atuação
            </button>
          </div>
        </div>

        <Button size="sm" onClick={onAddNew} className="gap-1.5 h-8 text-xs font-semibold">
          <Plus className="h-3.5 w-3.5" />
          <span>Novo Representante</span>
        </Button>
      </div>

      {/* Grade do Quadro Kanban */}
      <div className={`grid grid-cols-1 md:grid-cols-2 ${columns.length > 2 ? "xl:grid-cols-4" : ""} gap-4 items-start`}>
        {columns.map((col) => {
          const colReps = cardsByColumn[col.key] || [];
          const Icon = col.icon;

          return (
            <div
              key={col.key}
              className="bg-card/60 backdrop-blur-xs rounded-xl border p-3 flex flex-col gap-3 min-h-[420px] shadow-2xs"
            >
              {/* Cabeçalho da Coluna */}
              <div className="flex items-center justify-between pb-2 border-b">
                <div className="flex items-center gap-2">
                  <div className={`p-1.5 rounded-lg border ${col.color}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <h3 className="font-bold text-xs text-foreground tracking-tight">{col.label}</h3>
                </div>
                <Badge variant="secondary" className="text-[10px] font-bold h-5 px-1.5">
                  {colReps.length}
                </Badge>
              </div>

              {/* Lista de Cards da Coluna */}
              <div className="flex flex-col gap-3 flex-1">
                {colReps.length === 0 ? (
                  <div className="h-32 flex flex-col items-center justify-center border border-dashed rounded-lg text-muted-foreground text-[11px] p-4 text-center">
                    <span>Nenhum representante neste grupo</span>
                  </div>
                ) : (
                  colReps.map((rep) => {
                    const struct = structures[rep.id];
                    const ufs = struct?.estados_atendidos || [];
                    const marcas = struct?.marcas_representadas || [];
                    const equipe = struct?.equipe || [];
                    const totalRecursos = struct?.recursos_operacionais
                      ? RECURSOS_CONFIG.filter((r) => Boolean(struct.recursos_operacionais[r.key])).length
                      : 0;

                    return (
                      <div
                        key={rep.id}
                        className="bg-background rounded-lg border p-3.5 shadow-2xs hover:border-primary/40 hover:shadow-xs transition flex flex-col gap-2.5"
                      >
                        {/* Topo do Card */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary border border-primary/20 flex items-center justify-center font-bold text-xs shrink-0">
                              {rep.nome.slice(0, 2).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <h4
                                onClick={() => onViewPanel(rep.id)}
                                className="font-bold text-xs text-foreground truncate cursor-pointer hover:text-primary transition"
                              >
                                {rep.nome}
                              </h4>
                              <p className="text-[10px] text-muted-foreground truncate">
                                {rep.representacao || struct?.empresa_representacao || "Representação Comercial"}
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Localização / Base */}
                        <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <MapPin className="h-3 w-3 text-primary shrink-0" />
                          <span className="truncate">
                            {struct?.cidade_base && struct?.estado_base
                              ? `${struct.cidade_base}/${struct.estado_base}`
                              : rep.regiao || "Base operacional"}
                          </span>
                        </div>

                        {/* Badges de UFs */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[10px] text-muted-foreground font-medium">
                            <span>Território ({ufs.length} UFs)</span>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {ufs.slice(0, 4).map((uf) => (
                              <Badge
                                key={uf}
                                variant="secondary"
                                className="text-[9px] font-bold px-1.5 py-0 h-4 bg-primary/10 text-primary border border-primary/20"
                              >
                                {uf}
                              </Badge>
                            ))}
                            {ufs.length > 4 && (
                              <Badge variant="outline" className="text-[9px] font-medium px-1 py-0 h-4 text-muted-foreground">
                                +{ufs.length - 4}
                              </Badge>
                            )}
                          </div>
                        </div>

                        {/* Marcas Representadas */}
                        {marcas.length > 0 && (
                          <div className="space-y-1 pt-1 border-t border-border/60">
                            <div className="text-[10px] text-muted-foreground font-medium flex items-center gap-1">
                              <Briefcase className="h-2.5 w-2.5 text-primary" />
                              <span>{marcas.length} {marcas.length === 1 ? "marca" : "marcas"}</span>
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {marcas.slice(0, 2).map((m) => (
                                <span
                                  key={m.id}
                                  className="text-[10px] font-medium bg-muted px-1.5 py-0.5 rounded text-foreground/90 truncate max-w-[140px]"
                                >
                                  {m.nome}
                                </span>
                              ))}
                              {marcas.length > 2 && (
                                <span className="text-[9px] text-muted-foreground self-center">
                                  +{marcas.length - 2}
                                </span>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Capacidade Operacional Mini */}
                        <div className="flex items-center justify-between text-[10px] pt-1 border-t border-border/60 text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Users className="h-2.5 w-2.5 text-primary" />
                            <span>{equipe.length} na equipe</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <ShieldCheck className="h-2.5 w-2.5 text-emerald-600 dark:text-emerald-400" />
                            <span>{totalRecursos}/6 funções</span>
                          </div>
                        </div>

                        {/* Rodapé do Card com Ações (Ver Radiografia, WhatsApp, Editar, Excluir) */}
                        <div className="pt-2 border-t border-border/60 flex items-center justify-between gap-1">
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => onViewPanel(rep.id)}
                            className="h-6 px-2 text-[10px] gap-1 font-semibold flex-1 shadow-2xs"
                          >
                            <Eye className="h-2.5 w-2.5" />
                            <span>Radiografia</span>
                          </Button>

                          {/* Botão Compartilhar por Whats */}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleShareWhats(rep)}
                            disabled={sharingId === rep.id}
                            className="h-6 px-2 text-[10px] gap-1 font-medium text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 border-emerald-500/30"
                            title="Compartilhar no WhatsApp com PDF executivo formatado"
                          >
                            {sharingId === rep.id ? (
                              <Loader2 className="h-2.5 w-2.5 animate-spin text-emerald-600" />
                            ) : (
                              <MessageCircle className="h-2.5 w-2.5 text-emerald-600 dark:text-emerald-400" />
                            )}
                            <span className="hidden sm:inline">Whats</span>
                          </Button>

                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onEdit(rep.id)}
                            className="h-6 px-1.5 text-[10px] gap-1 font-medium hover:bg-muted"
                            title="Editar estrutura"
                          >
                            <Pencil className="h-2.5 w-2.5" />
                          </Button>

                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => onDelete(rep.id, rep.nome)}
                            className="h-6 px-1.5 text-[10px] text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            title="Excluir representante"
                          >
                            <Trash2 className="h-2.5 w-2.5" />
                          </Button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
