import React from "react";
import type { ClienteFrequenciaItem } from "@/lib/estrutura-rep/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  RotateCcw,
  Users,
  Building,
  MapPin,
  Plus,
  Pencil,
  Trash2,
  Calendar,
  Sparkles,
} from "lucide-react";

interface FrequenciaVisitasSectionProps {
  clientes?: ClienteFrequenciaItem[];
  onAddClick?: () => void;
  onEditClick?: (item: ClienteFrequenciaItem) => void;
  onDeleteClick?: (id: string) => void;
  className?: string;
}

export function FrequenciaVisitasSection({
  clientes = [],
  onAddClick,
  onEditClick,
  onDeleteClick,
  className = "",
}: FrequenciaVisitasSectionProps) {
  // Ordena por posição (1 a 10) ou pela frequência (menor frequência = mais visitas)
  const sorted = [...clientes]
    .sort((a, b) => (a.posicao || 99) - (b.posicao || 99))
    .slice(0, 10);

  const getFrequencyVariant = (dias: number) => {
    if (dias <= 20) {
      return {
        badge: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
        label: "Quinzenal",
        bar: "bg-emerald-500",
      };
    }
    if (dias <= 35) {
      return {
        badge: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30",
        label: "Mensal",
        bar: "bg-blue-500",
      };
    }
    if (dias <= 60) {
      return {
        badge: "bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-500/30",
        label: "Bimestral",
        bar: "bg-cyan-500",
      };
    }
    return {
      badge: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30",
      label: "Trimestral+",
      bar: "bg-amber-500",
    };
  };

  const getRankBadge = (idx: number) => {
    if (idx === 0) return "bg-amber-500 text-amber-950 font-extrabold shadow-2xs"; // 1º Ouro
    if (idx === 1) return "bg-slate-300 dark:bg-slate-400 text-slate-900 font-bold"; // 2º Prata
    if (idx === 2) return "bg-amber-700/80 text-white font-bold"; // 3º Bronze
    return "bg-muted text-muted-foreground font-semibold border";
  };

  return (
    <div className={`flex flex-col h-full bg-card rounded-xl border p-4 sm:p-5 shadow-xs ${className}`}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3 mb-3">
        <div>
          <div className="flex items-center gap-2">
            <RotateCcw className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold tracking-tight text-foreground uppercase">
              Frequência de Visita (Top 10)
            </h3>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Média de ciclo de retorno presencial em cada cliente-chave
          </p>
        </div>

        <div className="flex items-center gap-2">
          {onAddClick && sorted.length < 10 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onAddClick}
              className="h-7 text-xs font-semibold gap-1 text-primary hover:text-primary hover:bg-primary/10 px-2.5 shadow-2xs"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Adicionar</span>
            </Button>
          )}
          <Badge variant="outline" className="text-xs px-2 py-0.5 font-medium">
            {sorted.length}/10 Clientes
          </Badge>
        </div>
      </div>

      {/* Lista de Clientes e Ciclos */}
      {sorted.length === 0 ? (
        <div
          onClick={onAddClick}
          role={onAddClick ? "button" : undefined}
          tabIndex={onAddClick ? 0 : undefined}
          onKeyDown={(e) => e.key === "Enter" && onAddClick?.()}
          className={`flex-1 flex flex-col items-center justify-center p-6 text-center text-muted-foreground border border-dashed rounded-lg ${
            onAddClick ? "cursor-pointer hover:bg-muted/30 transition-colors" : ""
          }`}
        >
          <Users className="h-8 w-8 mb-2 opacity-40 text-primary" />
          <p className="text-sm font-medium">Nenhum cliente cadastrado na lista Top 10</p>
          <p className="text-xs mt-1">Defina a média de dias que o representante demora para retornar em cada um.</p>
          {onAddClick && (
            <Button variant="ghost" size="sm" className="mt-2.5 h-7 text-xs gap-1 text-primary font-semibold">
              <Plus className="h-3.5 w-3.5" />
              Cadastrar Primeiro Cliente
            </Button>
          )}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto space-y-2 pr-1 max-h-[460px] no-scrollbar">
          {sorted.map((item, idx) => {
            const variant = getFrequencyVariant(item.frequencia_dias);
            const rank = item.posicao || idx + 1;

            return (
              <div
                key={item.id}
                className="group relative flex items-center justify-between gap-3 p-2.5 sm:p-3 rounded-lg border bg-card hover:bg-muted/30 transition-all duration-150 hover:shadow-2xs"
              >
                {/* Posicionamento + Nome do Cliente */}
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div
                    className={`h-6 w-6 sm:h-7 sm:w-7 rounded-md flex items-center justify-center text-xs shrink-0 ${getRankBadge(
                      idx
                    )}`}
                    title={`${rank}º principal cliente`}
                  >
                    {rank}º
                  </div>

                  <div className="min-w-0 flex-1">
                    <h4 className="text-xs sm:text-sm font-bold text-foreground truncate" title={item.cliente_nome}>
                      {item.cliente_nome}
                    </h4>
                    {(item.cidade || item.uf) && (
                      <div className="flex items-center gap-1 text-[11px] text-muted-foreground truncate">
                        <MapPin className="h-3 w-3 shrink-0 text-primary/70" />
                        <span className="truncate">
                          {[item.cidade, item.uf].filter(Boolean).join(" - ")}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Bloco de Frequência em Destaque */}
                <div className="flex items-center gap-2 shrink-0">
                  <div className="flex flex-col items-end text-right">
                    <Badge
                      variant="outline"
                      className={`text-xs px-2 py-0.5 font-bold border ${variant.badge}`}
                    >
                      A cada {item.frequencia_dias} dias
                    </Badge>
                    <span className="text-[10px] text-muted-foreground mt-0.5">
                      {variant.label}
                    </span>
                  </div>

                  {/* Ações (Editar e Excluir) */}
                  <div className="flex items-center gap-0.5 opacity-80 group-hover:opacity-100 transition-opacity">
                    {onEditClick && (
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() => onEditClick(item)}
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        title="Editar cliente e frequência"
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                    )}
                    {onDeleteClick && (
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() => onDeleteClick(item.id)}
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        title="Remover do Top 10"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
