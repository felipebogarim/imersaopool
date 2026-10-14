import React, { useState } from "react";
import type { PerformanceComparativo } from "@/lib/estrutura-rep/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  LabelList,
} from "recharts";
import {
  TrendingUp,
  Pencil,
  ArrowUpRight,
  ArrowDownRight,
  Target,
  BarChart3,
  Loader2,
  Calendar,
  Check,
} from "lucide-react";
import { toast } from "sonner";

interface RepPerformanceYtdCardProps {
  performance?: PerformanceComparativo;
  onSave?: (updated: PerformanceComparativo) => Promise<void> | void;
  className?: string;
}

export const MONTHS_LIST = [
  { num: 1, name: "Janeiro", short: "Jan" },
  { num: 2, name: "Fevereiro", short: "Fev" },
  { num: 3, name: "Março", short: "Mar" },
  { num: 4, name: "Abril", short: "Abr" },
  { num: 5, name: "Maio", short: "Mai" },
  { num: 6, name: "Junho", short: "Jun" },
  { num: 7, name: "Julho", short: "Jul" },
  { num: 8, name: "Agosto", short: "Ago" },
  { num: 9, name: "Setembro", short: "Set" },
  { num: 10, name: "Outubro", short: "Out" },
  { num: 11, name: "Novembro", short: "Nov" },
  { num: 12, name: "Dezembro", short: "Dez" },
];

export const AVAILABLE_YEARS = [2021, 2022, 2023, 2024, 2025, 2026, 2027, 2028];

/** Constrói o texto amigável do período a partir dos meses selecionados */
export function buildPeriodLabel(meses?: number[]): string {
  if (!meses || meses.length === 0) return "Nenhum mês selecionado";
  if (meses.length === 12) return "Ano Completo (Jan a Dez)";

  const sorted = [...meses].sort((a, b) => a - b);
  const isContiguous = sorted.every((val, idx) => idx === 0 || val === sorted[idx - 1] + 1);

  if (isContiguous) {
    const first = MONTHS_LIST[sorted[0] - 1]?.short || `Mês ${sorted[0]}`;
    const last = MONTHS_LIST[sorted[sorted.length - 1] - 1]?.short || `Mês ${sorted[sorted.length - 1]}`;
    return sorted.length === 1 ? first : `${first} a ${last}`;
  }

  if (sorted.length <= 4) {
    return sorted.map((m) => MONTHS_LIST[m - 1]?.short).join(", ");
  }

  return `${sorted.length} meses selecionados`;
}

// Formata valores numéricos para moeda BRL
function formatCurrency(val?: number): string {
  if (typeof val !== "number" || isNaN(val)) return "R$ 0";
  return val.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

// Formatação compacta para eixos do gráfico (ex: R$ 1,8M ou R$ 450K)
function formatCompactCurrency(val: number): string {
  if (val >= 1_000_000) {
    return `R$ ${(val / 1_000_000).toFixed(1).replace(".", ",")}M`;
  }
  if (val >= 1_000) {
    return `R$ ${(val / 1_000).toFixed(0)}K`;
  }
  return `R$ ${val}`;
}

export function RepPerformanceYtdCard({
  performance,
  onSave,
  className = "",
}: RepPerformanceYtdCardProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Anos de comparação (extrai ano numérico de rótulo legado ou usa defaults 2025 vs 2026)
  const anoBase =
    performance?.ano_base ??
    (performance?.ano_anterior_label?.match(/\d{4}/)
      ? parseInt(performance.ano_anterior_label.match(/\d{4}/)![0], 10)
      : 2025);

  const anoComparado =
    performance?.ano_comparado ??
    (performance?.ano_atual_label?.match(/\d{4}/)
      ? parseInt(performance.ano_atual_label.match(/\d{4}/)![0], 10)
      : 2026);

  // Meses selecionados (padrão Jan a Out = 1..10)
  const mesesSelecionados = performance?.meses_selecionados ?? [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const periodoLabel = performance?.periodo_label || buildPeriodLabel(mesesSelecionados);

  // Valores de faturamento
  const anoAnteriorValor = performance?.ano_anterior_valor ?? 1850000;
  const anoAtualValor = performance?.ano_atual_valor ?? 2140000;
  const metaAnoAtual = performance?.meta_ano_atual ?? 2500000;
  const observacoes = performance?.observacoes || "";

  // Estados locais do modal
  const [formAnoBase, setFormAnoBase] = useState<number>(anoBase);
  const [formAnoComparado, setFormAnoComparado] = useState<number>(anoComparado);
  const [formMeses, setFormMeses] = useState<number[]>(mesesSelecionados);
  const [formAnoAnteriorValor, setFormAnoAnteriorValor] = useState(String(anoAnteriorValor));
  const [formAnoAtualValor, setFormAnoAtualValor] = useState(String(anoAtualValor));
  const [formMeta, setFormMeta] = useState(metaAnoAtual ? String(metaAnoAtual) : "");
  const [formObs, setFormObs] = useState(observacoes);

  const handleOpenEdit = () => {
    setFormAnoBase(anoBase);
    setFormAnoComparado(anoComparado);
    setFormMeses(mesesSelecionados);
    setFormAnoAnteriorValor(String(anoAnteriorValor));
    setFormAnoAtualValor(String(anoAtualValor));
    setFormMeta(metaAnoAtual ? String(metaAnoAtual) : "");
    setFormObs(observacoes);
    setModalOpen(true);
  };

  // Alterna a seleção de um mês nos chips
  const toggleMonth = (mNum: number) => {
    setFormMeses((prev) => {
      if (prev.includes(mNum)) {
        // Evita desmarcar todos os meses
        if (prev.length <= 1) return prev;
        return prev.filter((m) => m !== mNum);
      }
      return [...prev, mNum].sort((a, b) => a - b);
    });
  };

  // Seletores de atalho rápido de períodos
  const setQuickPeriod = (type: "ano_completo" | "ytd" | "semestre_1" | "semestre_2") => {
    switch (type) {
      case "ano_completo":
        setFormMeses([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
        break;
      case "ytd":
        // Jan até o mês atual (ex: Outubro = 10)
        setFormMeses([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
        break;
      case "semestre_1":
        setFormMeses([1, 2, 3, 4, 5, 6]);
        break;
      case "semestre_2":
        setFormMeses([7, 8, 9, 10, 11, 12]);
        break;
    }
  };

  // Aplica intervalo contíguo De X Até Y
  const handleRangeChange = (startMonth: number, endMonth: number) => {
    const min = Math.min(startMonth, endMonth);
    const max = Math.max(startMonth, endMonth);
    const range: number[] = [];
    for (let i = min; i <= max; i++) {
      range.push(i);
    }
    setFormMeses(range);
  };

  const handleSaveModal = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSaving(true);
    try {
      const parsedAnt = parseFloat(formAnoAnteriorValor.replace(/\./g, "").replace(",", ".")) || 0;
      const parsedAtual = parseFloat(formAnoAtualValor.replace(/\./g, "").replace(",", ".")) || 0;
      const parsedMeta = formMeta ? parseFloat(formMeta.replace(/\./g, "").replace(",", ".")) : undefined;

      const dynamicPeriodLabel = buildPeriodLabel(formMeses);

      const updated: PerformanceComparativo = {
        ano_anterior_label: String(formAnoBase),
        ano_anterior_valor: parsedAnt,
        ano_atual_label: String(formAnoComparado),
        ano_atual_valor: parsedAtual,
        meta_ano_atual: parsedMeta,
        ano_base: formAnoBase,
        ano_comparado: formAnoComparado,
        meses_selecionados: formMeses,
        periodo_label: dynamicPeriodLabel,
        observacoes: formObs.trim() || undefined,
      };

      await onSave?.(updated);
      toast.success("Dados de comparativo evolução atualizados com sucesso!");
      setModalOpen(false);
    } catch (err: any) {
      toast.error(err?.message || "Falha ao salvar dados de performance");
    } finally {
      setSaving(false);
    }
  };

  // Cálculo da variação percentual (Delta %)
  const variacaoPercentual =
    anoAnteriorValor > 0
      ? ((anoAtualValor - anoAnteriorValor) / anoAnteriorValor) * 100
      : 0;
  const isPositivo = variacaoPercentual >= 0;

  // Percentual atingido da meta do período
  const percentualMeta =
    metaAnoAtual > 0 ? (anoAtualValor / metaAnoAtual) * 100 : null;

  // Dados para o BarChart
  const chartData = [
    {
      name: `${anoBase}`,
      shortName: `${anoBase}`,
      valor: anoAnteriorValor,
      fill: "#94a3b8", // Slate suave para o ano base
    },
    {
      name: `${anoComparado}`,
      shortName: `${anoComparado}`,
      valor: anoAtualValor,
      fill: isPositivo ? "#0284c7" : "#f59e0b", // Azul primário (ou âmbar se negativo)
    },
  ];

  return (
    <div className={`flex flex-col h-full bg-card rounded-xl border p-4 sm:p-5 shadow-xs ${className}`}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3 mb-3">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold tracking-tight text-foreground uppercase">
              Comparativo evolução
            </h3>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {anoBase} vs {anoComparado} • {periodoLabel}
          </p>
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleOpenEdit}
            className="h-7 text-xs font-semibold gap-1 text-primary hover:text-primary hover:bg-primary/10 px-2.5 shadow-2xs"
            title="Escolher anos, período de meses e valores da comparação"
          >
            <Pencil className="h-3 w-3" />
            <span>Editar Dados</span>
          </Button>
        </div>
      </div>

      {/* Cards de Métricas de Destaque */}
      <div className="grid grid-cols-2 gap-2.5 mb-3">
        {/* Card 1: Variação Percentual */}
        <div className="p-2.5 rounded-lg border bg-muted/30 flex flex-col justify-between">
          <span className="text-[10.5px] font-medium text-muted-foreground uppercase tracking-wider">
            Crescimento ({periodoLabel})
          </span>
          <div className="flex items-center gap-1 mt-1">
            <Badge
              variant="outline"
              className={`text-xs px-2 py-0.5 font-bold border ${
                isPositivo
                  ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                  : "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30"
              }`}
            >
              {isPositivo ? (
                <ArrowUpRight className="h-3.5 w-3.5 mr-0.5 inline" />
              ) : (
                <ArrowDownRight className="h-3.5 w-3.5 mr-0.5 inline" />
              )}
              {isPositivo ? "+" : ""}
              {variacaoPercentual.toFixed(1)}%
            </Badge>
          </div>
        </div>

        {/* Card 2: Atingimento da Meta do Período */}
        <div className="p-2.5 rounded-lg border bg-muted/30 flex flex-col justify-between">
          <span className="text-[10.5px] font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
            <Target className="h-3 w-3 text-primary/70" />
            <span>Meta do Período</span>
          </span>
          <div className="mt-1">
            {percentualMeta !== null ? (
              <span className="text-xs font-extrabold text-foreground">
                {percentualMeta.toFixed(1)}%{" "}
                <span className="text-[10px] font-normal text-muted-foreground">atingida</span>
              </span>
            ) : (
              <span className="text-xs font-medium text-muted-foreground">Não definida</span>
            )}
          </div>
        </div>
      </div>

      {/* Gráfico de Barras Simples (Recharts) */}
      <div className="flex-1 w-full min-h-[170px] max-h-[220px] bg-muted/15 rounded-lg border border-border/70 p-2 flex flex-col justify-center">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            margin={{ top: 22, right: 12, left: -14, bottom: 0 }}
          >
            <XAxis
              dataKey="shortName"
              stroke="#64748b"
              fontSize={11}
              fontWeight={600}
              tickLine={false}
              axisLine={{ stroke: "#e2e8f0" }}
            />
            <YAxis
              stroke="#64748b"
              fontSize={10}
              tickLine={false}
              axisLine={false}
              tickFormatter={formatCompactCurrency}
            />
            <Tooltip
              formatter={(val: any) => [formatCurrency(Number(val)), `Faturamento (${periodoLabel})`]}
              contentStyle={{
                backgroundColor: "var(--popover)",
                borderRadius: "8px",
                borderColor: "var(--border)",
                fontSize: "11px",
              }}
            />
            <Bar dataKey="valor" radius={[6, 6, 0, 0]} maxBarSize={54}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
              <LabelList
                dataKey="valor"
                position="top"
                formatter={(val: any) => formatCompactCurrency(Number(val))}
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  fill: "var(--foreground)",
                }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Valores comparativos e observação em rodapé */}
      <div className="mt-2.5 pt-2 border-t border-border/70 space-y-1.5 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground truncate">{anoBase} ({periodoLabel}):</span>
          <span className="font-semibold text-foreground/80">{formatCurrency(anoAnteriorValor)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-primary font-medium truncate">{anoComparado} ({periodoLabel}):</span>
          <span className="font-bold text-foreground">{formatCurrency(anoAtualValor)}</span>
        </div>
        {observacoes && (
          <p className="text-[10.5px] text-muted-foreground/90 italic pt-1 truncate" title={observacoes}>
            "{observacoes}"
          </p>
        )}
      </div>

      {/* Modal de Preenchimento Manual e Escolha de Anos e Meses */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg p-0 overflow-hidden">
          <DialogHeader className="p-5 pb-3 border-b bg-muted/20">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <BarChart3 className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-semibold">
                  Configurar Comparativo de Evolução
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Escolha os anos, os meses de análise e preencha os faturamentos correspondentes.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <form onSubmit={handleSaveModal} className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
            {/* Bloco 1: Seleção de Anos de Comparação */}
            <div className="p-3 rounded-lg border bg-muted/20 space-y-2.5">
              <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-primary" />
                <span>Anos de Comparação</span>
              </Label>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <span className="text-[11px] text-muted-foreground font-medium">1º Ano (Base):</span>
                  <Select
                    value={String(formAnoBase)}
                    onValueChange={(val) => setFormAnoBase(parseInt(val, 10))}
                  >
                    <SelectTrigger className="h-8 text-xs bg-background font-semibold">
                      <SelectValue placeholder="Ano Base" />
                    </SelectTrigger>
                    <SelectContent>
                      {AVAILABLE_YEARS.map((yr) => (
                        <SelectItem key={yr} value={String(yr)} className="text-xs">
                          {yr}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <span className="text-[11px] text-primary font-medium">2º Ano (Comparado):</span>
                  <Select
                    value={String(formAnoComparado)}
                    onValueChange={(val) => setFormAnoComparado(parseInt(val, 10))}
                  >
                    <SelectTrigger className="h-8 text-xs bg-background font-semibold border-primary/40 text-primary">
                      <SelectValue placeholder="Ano Comparado" />
                    </SelectTrigger>
                    <SelectContent>
                      {AVAILABLE_YEARS.map((yr) => (
                        <SelectItem key={yr} value={String(yr)} className="text-xs">
                          {yr}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Bloco 2: Período (Quais Meses) */}
            <div className="p-3 rounded-lg border bg-muted/20 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-foreground">
                  Período de Comparação (Quais meses)
                </Label>
                <span className="text-[11px] font-medium text-primary">
                  {buildPeriodLabel(formMeses)}
                </span>
              </div>

              {/* Atalhos Rápidos */}
              <div className="flex flex-wrap items-center gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setQuickPeriod("ano_completo")}
                  className={`h-6 text-[10.5px] px-2 py-0 ${
                    formMeses.length === 12
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background"
                  }`}
                >
                  Ano Completo (12M)
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setQuickPeriod("ytd")}
                  className={`h-6 text-[10.5px] px-2 py-0 ${
                    formMeses.length === 10 && formMeses[0] === 1 && formMeses[9] === 10
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background"
                  }`}
                >
                  Jan a Out
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setQuickPeriod("semestre_1")}
                  className={`h-6 text-[10.5px] px-2 py-0 ${
                    formMeses.length === 6 && formMeses[0] === 1
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background"
                  }`}
                >
                  1º Semestre
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setQuickPeriod("semestre_2")}
                  className={`h-6 text-[10.5px] px-2 py-0 ${
                    formMeses.length === 6 && formMeses[0] === 7
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background"
                  }`}
                >
                  2º Semestre
                </Button>
              </div>

              {/* Intervalo De / Até */}
              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-border/60">
                <div className="space-y-1">
                  <span className="text-[10.5px] text-muted-foreground">Do mês:</span>
                  <Select
                    value={String(formMeses[0] || 1)}
                    onValueChange={(val) => {
                      const newStart = parseInt(val, 10);
                      const currentEnd = formMeses[formMeses.length - 1] || 12;
                      handleRangeChange(newStart, Math.max(newStart, currentEnd));
                    }}
                  >
                    <SelectTrigger className="h-7 text-xs bg-background">
                      <SelectValue placeholder="Início" />
                    </SelectTrigger>
                    <SelectContent>
                      {MONTHS_LIST.map((m) => (
                        <SelectItem key={m.num} value={String(m.num)} className="text-xs">
                          {m.num} - {m.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <span className="text-[10.5px] text-muted-foreground">Até o mês:</span>
                  <Select
                    value={String(formMeses[formMeses.length - 1] || 12)}
                    onValueChange={(val) => {
                      const newEnd = parseInt(val, 10);
                      const currentStart = formMeses[0] || 1;
                      handleRangeChange(Math.min(currentStart, newEnd), newEnd);
                    }}
                  >
                    <SelectTrigger className="h-7 text-xs bg-background">
                      <SelectValue placeholder="Fim" />
                    </SelectTrigger>
                    <SelectContent>
                      {MONTHS_LIST.map((m) => (
                        <SelectItem key={m.num} value={String(m.num)} className="text-xs">
                          {m.num} - {m.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Grade de 12 Meses (Seleção individual/múltipla) */}
              <div className="pt-1">
                <span className="text-[10px] text-muted-foreground block mb-1.5 font-medium">
                  Clique para marcar/desmarcar meses específicos:
                </span>
                <div className="grid grid-cols-6 sm:grid-cols-12 gap-1">
                  {MONTHS_LIST.map((m) => {
                    const selected = formMeses.includes(m.num);
                    return (
                      <button
                        key={m.num}
                        type="button"
                        onClick={() => toggleMonth(m.num)}
                        className={`h-7 rounded text-[11px] font-semibold border transition-colors flex items-center justify-center ${
                          selected
                            ? "bg-primary text-primary-foreground border-primary shadow-xs"
                            : "bg-background text-muted-foreground hover:text-foreground border-border/80"
                        }`}
                        title={`${m.name} (${selected ? "Selecionado" : "Não incluído"})`}
                      >
                        {m.short}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Bloco 3: Valores de Faturamento no Período */}
            <div className="p-3 rounded-lg border bg-muted/20 space-y-3">
              <Label className="text-xs font-semibold text-foreground">
                Faturamento Realizado no Período
              </Label>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <span className="text-[11px] text-muted-foreground">
                    Faturamento {formAnoBase} (R$):
                  </span>
                  <Input
                    type="number"
                    step="1000"
                    value={formAnoAnteriorValor}
                    onChange={(e) => setFormAnoAnteriorValor(e.target.value)}
                    placeholder="Ex: 1850000"
                    className="h-8 text-xs bg-background font-medium"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <span className="text-[11px] text-primary font-medium">
                    Faturamento {formAnoComparado} (R$):
                  </span>
                  <Input
                    type="number"
                    step="1000"
                    value={formAnoAtualValor}
                    onChange={(e) => setFormAnoAtualValor(e.target.value)}
                    placeholder="Ex: 2140000"
                    className="h-8 text-xs bg-background font-semibold border-primary/40 text-primary"
                    required
                  />
                </div>
              </div>

              {/* Meta do Período */}
              <div className="space-y-1 pt-1 border-t border-border/60">
                <Label htmlFor="meta-perf" className="text-[11px] font-medium text-muted-foreground">
                  Meta de Faturamento para {formAnoComparado} no Período (R$ - Opcional):
                </Label>
                <Input
                  id="meta-perf"
                  type="number"
                  step="1000"
                  value={formMeta}
                  onChange={(e) => setFormMeta(e.target.value)}
                  placeholder="Ex: 2500000"
                  className="h-8 text-xs bg-background"
                />
              </div>
            </div>

            {/* Observações */}
            <div className="space-y-1">
              <Label htmlFor="obs-perf" className="text-xs font-medium">
                Observações / Contexto
              </Label>
              <Input
                id="obs-perf"
                value={formObs}
                onChange={(e) => setFormObs(e.target.value)}
                placeholder="Ex: Crescimento impulsionado pela linha de iluminação técnica"
                className="h-8 text-xs"
              />
            </div>

            <DialogFooter className="pt-2 border-t">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setModalOpen(false)}
                className="h-8 text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={saving}
                className="h-8 text-xs bg-primary font-semibold gap-1.5"
              >
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Salvar Dados
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
