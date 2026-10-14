import React, { useState, useMemo } from "react";
import type { TreinamentoItem, StatusTreinamento } from "@/lib/estrutura-rep/types";
import {
  TIPO_TREINAMENTO_LABEL,
  TIPO_TREINAMENTO_COLOR,
} from "@/lib/estrutura-rep/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Calendar,
  GraduationCap,
  Clock,
  MapPin,
  Plus,
  Pencil,
  Trash2,
  CalendarCheck,
  ChevronDown,
  ChevronUp,
  UserCheck,
  Search,
  X,
  Filter,
  CheckCircle2,
  RotateCcw,
} from "lucide-react";

interface TreinamentosSectionProps {
  treinamentos?: TreinamentoItem[];
  onAddClick?: () => void;
  onEditClick?: (item: TreinamentoItem) => void;
  onDeleteClick?: (id: string) => void;
  onToggleStatus?: (id: string, newStatus: StatusTreinamento) => void;
  className?: string;
}

const MONTH_NAMES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

const MONTH_SHORT = [
  "JAN",
  "FEV",
  "MAR",
  "ABR",
  "MAI",
  "JUN",
  "JUL",
  "AGO",
  "SET",
  "OUT",
  "NOV",
  "DEZ",
];

const WEEKDAY_NAMES = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export function TreinamentosSection({
  treinamentos = [],
  onAddClick,
  onEditClick,
  onDeleteClick,
  onToggleStatus,
  className = "",
}: TreinamentosSectionProps) {
  // Estado de controle dos cards expandidos
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // Estados de Filtro e Pesquisa
  const [isFilterExpanded, setIsFilterExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMonth, setSelectedMonth] = useState<string>("todos");
  const [selectedPeriod, setSelectedPeriod] = useState<string>("todos");
  const [selectedStatus, setSelectedStatus] = useState<string>("todos");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Alterna o status (planejado <-> realizado)
  const handleToggle = (e: React.MouseEvent, item: TreinamentoItem) => {
    e.stopPropagation();
    const currentStatus = item.status || "planejado";
    const nextStatus: StatusTreinamento =
      currentStatus === "realizado" ? "planejado" : "realizado";
    onToggleStatus?.(item.id, nextStatus);
  };

  // Lista dinâmica de meses presentes nos agendamentos para o Select de Mês
  const availableMonths = useMemo(() => {
    const monthSet = new Set<string>();
    for (const tr of treinamentos) {
      if (tr.data) {
        const parts = tr.data.split("-");
        if (parts.length >= 2) {
          const m = parseInt(parts[1], 10);
          if (m >= 1 && m <= 12) {
            monthSet.add(String(m).padStart(2, "0"));
          }
        }
      }
    }
    // Ordena os meses numericamente
    return Array.from(monthSet).sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
  }, [treinamentos]);

  // Filtro de treinamentos combinando busca textual, mês, período e status
  const filtered = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTime = today.getTime();

    return treinamentos.filter((item) => {
      // 1. Busca por texto (digitar e pesquisar)
      if (searchQuery.trim()) {
        const term = searchQuery.toLowerCase().trim();
        const matchCliente = item.cliente_nome.toLowerCase().includes(term);
        const matchTipo = (TIPO_TREINAMENTO_LABEL[item.tipo] || item.tipo)
          .toLowerCase()
          .includes(term);
        const matchMinistrante = (item.ministrante || "").toLowerCase().includes(term);
        const matchLocal = (item.local || "").toLowerCase().includes(term);
        const matchObs = (item.observacoes || "").toLowerCase().includes(term);

        if (!matchCliente && !matchTipo && !matchMinistrante && !matchLocal && !matchObs) {
          return false;
        }
      }

      // 2. Filtro por Mês específico
      if (selectedMonth !== "todos") {
        if (!item.data) return false;
        const parts = item.data.split("-");
        if (parts.length < 2 || parts[1] !== selectedMonth) {
          return false;
        }
      }

      // 3. Filtro por Período específico
      if (selectedPeriod !== "todos") {
        if (!item.data) return false;
        const itemDate = new Date(`${item.data}T00:00:00`);
        const itemTime = itemDate.getTime();

        if (selectedPeriod === "proximos_7") {
          const in7Days = new Date(today);
          in7Days.setDate(in7Days.getDate() + 7);
          if (itemTime < todayTime || itemTime > in7Days.getTime()) return false;
        } else if (selectedPeriod === "proximos_30") {
          const in30Days = new Date(today);
          in30Days.setDate(in30Days.getDate() + 30);
          if (itemTime < todayTime || itemTime > in30Days.getTime()) return false;
        } else if (selectedPeriod === "este_mes") {
          const currentMonth = today.getMonth();
          const currentYear = today.getFullYear();
          if (itemDate.getMonth() !== currentMonth || itemDate.getFullYear() !== currentYear) {
            return false;
          }
        } else if (selectedPeriod === "passados") {
          if (itemTime >= todayTime) return false;
        } else if (selectedPeriod === "personalizado") {
          if (customStartDate && item.data < customStartDate) return false;
          if (customEndDate && item.data > customEndDate) return false;
        }
      }

      // 4. Filtro por Status (planejado vs realizado)
      if (selectedStatus !== "todos") {
        const itemStatus = item.status || "planejado";
        if (itemStatus !== selectedStatus) return false;
      }

      return true;
    });
  }, [
    treinamentos,
    searchQuery,
    selectedMonth,
    selectedPeriod,
    selectedStatus,
    customStartDate,
    customEndDate,
  ]);

  // Ordena por data (mais próximas primeiro)
  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      return new Date(a.data).getTime() - new Date(b.data).getTime();
    });
  }, [filtered]);

  // Limpa todos os filtros ativos
  const handleClearFilters = () => {
    setSearchQuery("");
    setSelectedMonth("todos");
    setSelectedPeriod("todos");
    setSelectedStatus("todos");
    setCustomStartDate("");
    setCustomEndDate("");
  };

  const hasActiveFilters =
    searchQuery.trim() !== "" ||
    selectedMonth !== "todos" ||
    selectedPeriod !== "todos" ||
    selectedStatus !== "todos" ||
    Boolean(customStartDate) ||
    Boolean(customEndDate);

  const formatDateBlock = (dateStr: string) => {
    try {
      const [year, month, day] = dateStr.split("-").map(Number);
      const d = new Date(year, (month || 1) - 1, day || 1);
      return {
        day: String(day || 1).padStart(2, "0"),
        month: MONTH_SHORT[d.getMonth()] || "MÊS",
        weekday: WEEKDAY_NAMES[d.getDay()] || "",
      };
    } catch {
      return { day: "--", month: "---", weekday: "" };
    }
  };

  return (
    <div className={`flex flex-col h-full bg-card rounded-xl border p-4 sm:p-5 shadow-xs ${className}`}>
      {/* Header Principal */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3 mb-3">
        <div>
          <div className="flex items-center gap-2">
            <GraduationCap className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold tracking-tight text-foreground uppercase">
              Calendário de Treinamentos
            </h3>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {hasActiveFilters
              ? `${sorted.length} de ${treinamentos.length} ${
                  treinamentos.length === 1 ? "sessão filtrada" : "sessões filtradas"
                }`
              : treinamentos.length > 0
              ? `${treinamentos.length} ${
                  treinamentos.length === 1 ? "data agendada" : "próximas datas agendadas"
                } pelo rep`
              : "Nenhum treinamento agendado no momento"}
          </p>
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant={isFilterExpanded ? "secondary" : "outline"}
            size="sm"
            onClick={() => setIsFilterExpanded((prev) => !prev)}
            className={`h-7 px-2 text-xs font-medium gap-1.5 transition-colors ${
              isFilterExpanded
                ? "bg-primary/10 text-primary border-primary/40 shadow-xs"
                : hasActiveFilters
                ? "text-primary border-primary/30 bg-primary/5"
                : "text-muted-foreground hover:text-foreground"
            }`}
            title={isFilterExpanded ? "Retrair pesquisa e filtros" : "Pesquisar e filtrar treinamentos"}
            aria-label={isFilterExpanded ? "Retrair pesquisa e filtros" : "Pesquisar e filtrar treinamentos"}
            aria-expanded={isFilterExpanded}
          >
            <Search className="h-3.5 w-3.5" />
            {hasActiveFilters && !isFilterExpanded && (
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            )}
          </Button>

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

      {/* Barra de Filtros e Pesquisa (Expansível via Lupa) */}
      {isFilterExpanded && (
        <div className="space-y-2 mb-3 bg-muted/30 p-2.5 rounded-lg border border-border/70 animate-in fade-in-50 duration-150">
          {/* Linha 1: Campo de Busca Textual + Botão Retrair */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por cliente, tipo de treinamento ou ministrante..."
                className="pl-8 pr-8 h-8 text-xs bg-background"
                autoFocus
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                  title="Limpar pesquisa"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsFilterExpanded(false)}
              className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground gap-1 shrink-0"
              title="Retrair filtros"
            >
              <ChevronUp className="h-3.5 w-3.5" />
              <span className="text-xs font-medium">Retrair</span>
            </Button>
          </div>

          {/* Linha 2: Filtros por Mês, Período e Status */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Filtro por Mês */}
            <div className="flex-1 min-w-[125px]">
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="h-7 text-[11px] bg-background">
                  <Calendar className="h-3 w-3 mr-1 text-muted-foreground shrink-0" />
                  <SelectValue placeholder="Mês" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos" className="text-xs">
                    Todos os Meses
                  </SelectItem>
                  {availableMonths.length > 0 ? (
                    availableMonths.map((mNum) => {
                      const idx = parseInt(mNum, 10) - 1;
                      return (
                        <SelectItem key={mNum} value={mNum} className="text-xs">
                          {MONTH_NAMES[idx] || `Mês ${mNum}`}
                        </SelectItem>
                      );
                    })
                  ) : (
                    MONTH_NAMES.map((name, i) => (
                      <SelectItem
                        key={name}
                        value={String(i + 1).padStart(2, "0")}
                        className="text-xs"
                      >
                        {name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Filtro por Período Específico */}
            <div className="flex-1 min-w-[130px]">
              <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                <SelectTrigger className="h-7 text-[11px] bg-background">
                  <Clock className="h-3 w-3 mr-1 text-muted-foreground shrink-0" />
                  <SelectValue placeholder="Período" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos" className="text-xs">
                    Todos os Períodos
                  </SelectItem>
                  <SelectItem value="proximos_7" className="text-xs">
                    Próximos 7 dias
                  </SelectItem>
                  <SelectItem value="proximos_30" className="text-xs">
                    Próximos 30 dias
                  </SelectItem>
                  <SelectItem value="este_mes" className="text-xs">
                    Este mês
                  </SelectItem>
                  <SelectItem value="passados" className="text-xs">
                    Datas anteriores
                  </SelectItem>
                  <SelectItem value="personalizado" className="text-xs font-medium text-primary">
                    Intervalo específico...
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Filtro por Status (Planejado vs Realizado) */}
            <div className="flex-1 min-w-[110px]">
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="h-7 text-[11px] bg-background">
                  <Filter className="h-3 w-3 mr-1 text-muted-foreground shrink-0" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos" className="text-xs">
                    Todos os Status
                  </SelectItem>
                  <SelectItem value="planejado" className="text-xs">
                    Planejados
                  </SelectItem>
                  <SelectItem value="realizado" className="text-xs">
                    Realizados
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Botão Limpar Filtros (aparece se houver algum filtro ativo) */}
            {hasActiveFilters && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleClearFilters}
                className="h-7 px-2 text-[11px] text-muted-foreground hover:text-foreground gap-1"
                title="Limpar todos os filtros"
              >
                <RotateCcw className="h-3 w-3" />
                <span>Limpar</span>
              </Button>
            )}
          </div>

          {/* Linha Condicional: Intervalo Personalizado de Datas */}
          {selectedPeriod === "personalizado" && (
            <div className="flex items-center gap-2 pt-1.5 border-t border-border/60 animate-in fade-in-50 duration-150">
              <span className="text-[11px] text-muted-foreground shrink-0">De:</span>
              <Input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="h-7 text-xs bg-background flex-1"
              />
              <span className="text-[11px] text-muted-foreground shrink-0">Até:</span>
              <Input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="h-7 text-xs bg-background flex-1"
              />
            </div>
          )}
        </div>
      )}

      {/* Lista de Treinamentos */}
      {treinamentos.length === 0 ? (
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
      ) : sorted.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-muted-foreground border border-dashed rounded-lg">
          <Search className="h-7 w-7 mb-2 opacity-40 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">Nenhum treinamento encontrado</p>
          <p className="text-xs mt-1 text-muted-foreground">
            Tente ajustar o termo de busca, mês ou período selecionado.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleClearFilters}
            className="mt-3 h-7 text-xs gap-1"
          >
            <RotateCcw className="h-3 w-3" />
            Limpar Filtros
          </Button>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 max-h-[460px] no-scrollbar">
          {sorted.map((item) => {
            const dateBlock = formatDateBlock(item.data);
            const color = TIPO_TREINAMENTO_COLOR[item.tipo] || TIPO_TREINAMENTO_COLOR.outro;
            const tipoLabel = TIPO_TREINAMENTO_LABEL[item.tipo] || item.tipo;
            const isExpanded = expandedIds.has(item.id);
            const isRealizado = item.status === "realizado";

            return (
              <div
                key={item.id}
                className="group relative flex flex-col p-3 rounded-lg border bg-card hover:bg-muted/20 transition-all duration-150 hover:shadow-2xs"
              >
                {/* Linha de Resumo Inicial */}
                <div className="flex items-center gap-3">
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

                  {/* Conteúdo Principal (Resumo Inicial) */}
                  <div
                    className="flex-1 min-w-0 cursor-pointer select-none"
                    onClick={() => toggleExpand(item.id)}
                    title={isExpanded ? "Clique para recolher" : "Clique para expandir"}
                  >
                    <div className="flex flex-wrap items-center gap-1.5 mb-1">
                      {/* Pílula do Tipo de Treinamento */}
                      <Badge
                        variant="outline"
                        className={`text-[10px] h-5 px-1.5 py-0 font-semibold border ${color.bg} ${color.text} ${color.border}`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full mr-1 ${color.dot}`} />
                        <span className="truncate max-w-[180px] sm:max-w-[220px]" title={tipoLabel}>
                          {tipoLabel}
                        </span>
                      </Badge>

                      {/* Botão Interativo de Status: Planejado vs Realizado */}
                      <button
                        type="button"
                        onClick={(e) => handleToggle(e, item)}
                        className={`inline-flex items-center gap-1 px-2 h-5 rounded-md text-[10px] font-semibold border transition-all cursor-pointer shadow-2xs ${
                          isRealizado
                            ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/25"
                            : "bg-blue-500/10 border-blue-500/30 text-blue-700 dark:text-blue-300 hover:bg-blue-500/20"
                        }`}
                        title={
                          isRealizado
                            ? "Ação Realizada. Clique para marcar como Planejado"
                            : "Ação Planejada. Clique para marcar como Realizado"
                        }
                      >
                        {isRealizado ? (
                          <>
                            <CheckCircle2 className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                            <span>Realizado</span>
                          </>
                        ) : (
                          <>
                            <Clock className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                            <span>Planejado</span>
                          </>
                        )}
                      </button>
                    </div>

                    <h4 className="text-xs sm:text-sm font-bold text-foreground truncate" title={item.cliente_nome}>
                      {item.cliente_nome}
                    </h4>
                  </div>

                  {/* Ações (Editar, Excluir e Seta Expandir) */}
                  <div className="flex items-center gap-1 shrink-0">
                    {onEditClick && (
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditClick(item);
                        }}
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
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteClick(item.id);
                        }}
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        title="Excluir agendamento"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() => toggleExpand(item.id)}
                      className="h-7 w-7 text-muted-foreground hover:text-foreground"
                      title={isExpanded ? "Recolher informações" : "Expandir informações"}
                      aria-expanded={isExpanded}
                    >
                      <ChevronDown
                        className={`h-4 w-4 transition-transform duration-200 ${
                          isExpanded ? "rotate-180" : ""
                        }`}
                      />
                    </Button>
                  </div>
                </div>

                {/* Informações Detalhadas (Expandidas) */}
                {isExpanded && (
                  <div className="border-t border-border/70 pt-2.5 mt-2.5 pl-0 sm:pl-[68px] animate-in fade-in-50 duration-150">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
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
                      <p className="text-[11px] text-muted-foreground/90 mt-1 italic">
                        "{item.observacoes}"
                      </p>
                    )}

                    {!item.ministrante && !item.horario && !item.local && !item.observacoes && (
                      <p className="text-[11px] text-muted-foreground italic">
                        Nenhuma informação adicional cadastrada.
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
