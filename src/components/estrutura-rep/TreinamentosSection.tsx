import React, { useState } from "react";
import type { TreinamentoItem, TipoTreinamento } from "@/lib/estrutura-rep/types";
import {
  TIPO_TREINAMENTO_LABEL,
  TIPO_TREINAMENTO_COLOR,
  TIPO_TREINAMENTO_SHORT_LABEL,
} from "@/lib/estrutura-rep/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Calendar,
  GraduationCap,
  Clock,
  MapPin,
  Plus,
  Pencil,
  Trash2,
  CalendarCheck,
  ChevronRight,
  UserCheck,
} from "lucide-react";

interface TreinamentosSectionProps {
  treinamentos?: TreinamentoItem[];
  onAddClick?: () => void;
  onEditClick?: (item: TreinamentoItem) => void;
  onDeleteClick?: (id: string) => void;
  className?: string;
}

export function TreinamentosSection({
  treinamentos = [],
  onAddClick,
  onEditClick,
  onDeleteClick,
  className = "",
}: TreinamentosSectionProps) {
  // Ordena por data (mais próximas primeiro)
  const sorted = [...treinamentos].sort((a, b) => {
    return new Date(a.data).getTime() - new Date(b.data).getTime();
  });

  const formatDateBlock = (dateStr: string) => {
    try {
      const [year, month, day] = dateStr.split("-").map(Number);
      const d = new Date(year, (month || 1) - 1, day || 1);
      const monthNames = [
        "JAN", "FEV", "MAR", "ABR", "MAI", "JUN",
        "JUL", "AGO", "SET", "OUT", "NOV", "DEZ",
      ];
      const weekNames = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

      return {
        day: String(day || 1).padStart(2, "0"),
        month: monthNames[d.getMonth()] || "MÊS",
        weekday: weekNames[d.getDay()] || "",
      };
    } catch {
      return { day: "--", month: "---", weekday: "" };
    }
  };

  return (
    <div className={`flex flex-col h-full bg-card rounded-xl border p-4 sm:p-5 shadow-xs ${className}`}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3 mb-3">
        <div>
          <div className="flex items-center gap-2">
            <GraduationCap className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold tracking-tight text-foreground uppercase">
              Calendário de Treinamentos
            </h3>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {sorted.length > 0
              ? `${sorted.length} ${sorted.length === 1 ? "data agendada" : "próximas datas agendadas"} pelo rep`
              : "Nenhum treinamento agendado no momento"}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {onAddClick && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onAddClick}
              className="h-7 text-xs font-semibold gap-1 text-primary hover:text-primary hover:bg-primary/10 px-2.5 shadow-2xs"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Agendar</span>
            </Button>
          )}
          <Badge variant="outline" className="text-xs px-2 py-0.5 font-medium">
            {sorted.length} {sorted.length === 1 ? "Sessão" : "Sessões"}
          </Badge>
        </div>
      </div>

      {/* Lista de Treinamentos */}
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
          <CalendarCheck className="h-8 w-8 mb-2 opacity-40 text-primary" />
          <p className="text-sm font-medium">Nenhum treinamento agendado</p>
          <p className="text-xs mt-1">Cadastre as próximas palestras e treinamentos do representante.</p>
          {onAddClick && (
            <Button variant="ghost" size="sm" className="mt-2.5 h-7 text-xs gap-1 text-primary font-semibold">
              <Plus className="h-3.5 w-3.5" />
              Agendar Novo Treinamento
            </Button>
          )}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 max-h-[460px] no-scrollbar">
          {sorted.map((item) => {
            const dateBlock = formatDateBlock(item.data);
            const color = TIPO_TREINAMENTO_COLOR[item.tipo] || TIPO_TREINAMENTO_COLOR.outro;
            const tipoLabel = TIPO_TREINAMENTO_LABEL[item.tipo] || item.tipo;

            return (
              <div
                key={item.id}
                className="group relative flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-muted/30 transition-all duration-150 hover:shadow-2xs"
              >
                {/* Bloco de Data Visual (Estilo Calendário) */}
                <div className="flex flex-col items-center justify-center w-12 sm:w-14 h-14 rounded-lg bg-muted/60 border border-border/80 shrink-0 text-center overflow-hidden shadow-2xs">
                  <div className="w-full bg-primary/10 text-primary font-bold text-[9px] py-0.5 tracking-wider border-b border-primary/20">
                    {dateBlock.month}
                  </div>
                  <div className="flex-1 flex flex-col items-center justify-center">
                    <span className="text-base font-extrabold text-foreground leading-none">
                      {dateBlock.day}
                    </span>
                    {dateBlock.weekday && (
                      <span className="text-[9px] text-muted-foreground font-medium">
                        {dateBlock.weekday}
                      </span>
                    )}
                  </div>
                </div>

                {/* Conteúdo do Treinamento */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5 mb-1">
                    <Badge
                      variant="outline"
                      className={`text-[10px] h-5 px-1.5 py-0 font-semibold border ${color.bg} ${color.text} ${color.border}`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full mr-1 ${color.dot}`} />
                      <span className="truncate max-w-[220px]" title={tipoLabel}>
                        {tipoLabel}
                      </span>
                    </Badge>
                  </div>

                  <h4 className="text-xs sm:text-sm font-bold text-foreground truncate" title={item.cliente_nome}>
                    {item.cliente_nome}
                  </h4>

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-[11px] text-muted-foreground">
                    {item.ministrante && (
                      <div className="flex items-center gap-1 shrink-0 text-foreground font-semibold" title="Ministrante da ação">
                        <UserCheck className="h-3 w-3 text-primary shrink-0" />
                        <span>{item.ministrante}</span>
                      </div>
                    )}
                    {item.horario && (
                      <div className="flex items-center gap-1 shrink-0">
                        <Clock className="h-3 w-3 text-primary/70" />
                        <span>{item.horario}</span>
                      </div>
                    )}
                    {item.local && (
                      <div className="flex items-center gap-1 truncate" title={item.local}>
                        <MapPin className="h-3 w-3 text-primary/70 shrink-0" />
                        <span className="truncate">{item.local}</span>
                      </div>
                    )}
                  </div>

                  {item.observacoes && (
                    <p className="text-[11px] text-muted-foreground/90 mt-1 italic line-clamp-1">
                      "{item.observacoes}"
                    </p>
                  )}
                </div>

                {/* Ações (Editar e Excluir) */}
                <div className="flex items-center gap-1 shrink-0 opacity-80 group-hover:opacity-100 transition-opacity">
                  {onEditClick && (
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() => onEditClick(item)}
                      className="h-7 w-7 text-muted-foreground hover:text-foreground"
                      title="Editar treinamento"
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
                      title="Excluir agendamento"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
