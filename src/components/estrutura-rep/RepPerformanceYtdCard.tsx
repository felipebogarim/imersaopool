import React, { useState } from "react";
import type { PerformanceComparativo } from "@/lib/estrutura-rep/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
} from "lucide-react";
import { toast } from "sonner";

interface RepPerformanceYtdCardProps {
  performance?: PerformanceComparativo;
  onSave?: (updated: PerformanceComparativo) => Promise<void> | void;
  className?: string;
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

  // Valores atuais com fallbacks padrão inteligentes
  const anoAnteriorLabel = performance?.ano_anterior_label || "Ano Anterior (2025)";
  const anoAnteriorValor = performance?.ano_anterior_valor ?? 1850000;
  const anoAtualLabel = performance?.ano_atual_label || "Ano Atual (2026 YTD)";
  const anoAtualValor = performance?.ano_atual_valor ?? 2140000;
  const metaAnoAtual = performance?.meta_ano_atual ?? 2500000;
  const observacoes = performance?.observacoes || "";

  // Estado local do modal de edição manual
  const [formAnoAnteriorLabel, setFormAnoAnteriorLabel] = useState(anoAnteriorLabel);
  const [formAnoAnteriorValor, setFormAnoAnteriorValor] = useState(String(anoAnteriorValor));
  const [formAnoAtualLabel, setFormAnoAtualLabel] = useState(anoAtualLabel);
  const [formAnoAtualValor, setFormAnoAtualValor] = useState(String(anoAtualValor));
  const [formMeta, setFormMeta] = useState(metaAnoAtual ? String(metaAnoAtual) : "");
  const [formObs, setFormObs] = useState(observacoes);

  const handleOpenEdit = () => {
    setFormAnoAnteriorLabel(anoAnteriorLabel);
    setFormAnoAnteriorValor(String(anoAnteriorValor));
    setFormAnoAtualLabel(anoAtualLabel);
    setFormAnoAtualValor(String(anoAtualValor));
    setFormMeta(metaAnoAtual ? String(metaAnoAtual) : "");
    setFormObs(observacoes);
    setModalOpen(true);
  };

  const handleSaveModal = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSaving(true);
    try {
      const parsedAnt = parseFloat(formAnoAnteriorValor.replace(/\./g, "").replace(",", ".")) || 0;
      const parsedAtual = parseFloat(formAnoAtualValor.replace(/\./g, "").replace(",", ".")) || 0;
      const parsedMeta = formMeta ? parseFloat(formMeta.replace(/\./g, "").replace(",", ".")) : undefined;

      const updated: PerformanceComparativo = {
        ano_anterior_label: formAnoAnteriorLabel.trim() || "Ano Anterior",
        ano_anterior_valor: parsedAnt,
        ano_atual_label: formAnoAtualLabel.trim() || "Ano Atual (YTD)",
        ano_atual_valor: parsedAtual,
        meta_ano_atual: parsedMeta,
        observacoes: formObs.trim() || undefined,
      };

      await onSave?.(updated);
      toast.success("Dados de performance atualizados com sucesso!");
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

  // Percentual atingido da meta anual
  const percentualMeta =
    metaAnoAtual > 0 ? (anoAtualValor / metaAnoAtual) * 100 : null;

  // Dados para o BarChart
  const chartData = [
    {
      name: anoAnteriorLabel,
      shortName: anoAnteriorLabel.replace(/\s*\(.*\)/, "").trim() || "Ano Ant.",
      valor: anoAnteriorValor,
      fill: "#94a3b8", // Slate suave para ano anterior
    },
    {
      name: anoAtualLabel,
      shortName: anoAtualLabel.replace(/\s*\(.*\)/, "").trim() || "Ano Atual",
      valor: anoAtualValor,
      fill: isPositivo ? "#0284c7" : "#f59e0b", // Azul primário de destaque (ou âmbar se negativo)
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
              Performance do Rep
            </h3>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Comparativo Ano Anterior vs Ano Atual (YTD)
          </p>
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleOpenEdit}
            className="h-7 text-xs font-semibold gap-1 text-primary hover:text-primary hover:bg-primary/10 px-2.5 shadow-2xs"
            title="Editar dados da comparação manualmente"
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
            Crescimento (YTD)
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

        {/* Card 2: Atingimento da Meta */}
        <div className="p-2.5 rounded-lg border bg-muted/30 flex flex-col justify-between">
          <span className="text-[10.5px] font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
            <Target className="h-3 w-3 text-primary/70" />
            <span>Meta YTD</span>
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
              fontSize={10.5}
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
              formatter={(val: any) => [formatCurrency(Number(val)), "Faturamento"]}
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
          <span className="text-muted-foreground truncate">{anoAnteriorLabel}:</span>
          <span className="font-semibold text-foreground/80">{formatCurrency(anoAnteriorValor)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-primary font-medium truncate">{anoAtualLabel}:</span>
          <span className="font-bold text-foreground">{formatCurrency(anoAtualValor)}</span>
        </div>
        {observacoes && (
          <p className="text-[10.5px] text-muted-foreground/90 italic pt-1 truncate" title={observacoes}>
            "{observacoes}"
          </p>
        )}
      </div>

      {/* Modal de Preenchimento Manual */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md p-0 overflow-hidden">
          <DialogHeader className="p-5 pb-3 border-b bg-muted/20">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <BarChart3 className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-semibold">
                  Preencher Dados de Performance (Manual)
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Insira os valores de faturamento do ano anterior e do ano atual (YTD).
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <form onSubmit={handleSaveModal} className="p-5 space-y-4">
            {/* Bloco Ano Anterior */}
            <div className="p-3 rounded-lg border bg-muted/20 space-y-2.5">
              <Label className="text-xs font-semibold text-foreground">Ano Anterior</Label>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <span className="text-[11px] text-muted-foreground">Rótulo:</span>
                  <Input
                    value={formAnoAnteriorLabel}
                    onChange={(e) => setFormAnoAnteriorLabel(e.target.value)}
                    placeholder="Ex: 2025"
                    className="h-8 text-xs bg-background"
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-[11px] text-muted-foreground">Valor (R$):</span>
                  <Input
                    type="number"
                    step="1000"
                    value={formAnoAnteriorValor}
                    onChange={(e) => setFormAnoAnteriorValor(e.target.value)}
                    placeholder="Ex: 1850000"
                    className="h-8 text-xs bg-background"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Bloco Ano Atual (YTD) */}
            <div className="p-3 rounded-lg border border-primary/30 bg-primary/5 space-y-2.5">
              <Label className="text-xs font-semibold text-primary">Ano Atual (YTD)</Label>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <span className="text-[11px] text-muted-foreground">Rótulo:</span>
                  <Input
                    value={formAnoAtualLabel}
                    onChange={(e) => setFormAnoAtualLabel(e.target.value)}
                    placeholder="Ex: 2026 (YTD)"
                    className="h-8 text-xs bg-background"
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-[11px] text-muted-foreground">Valor (R$):</span>
                  <Input
                    type="number"
                    step="1000"
                    value={formAnoAtualValor}
                    onChange={(e) => setFormAnoAtualValor(e.target.value)}
                    placeholder="Ex: 2140000"
                    className="h-8 text-xs bg-background"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Meta Anual (Opcional) */}
            <div className="space-y-1.5">
              <Label htmlFor="meta-perf" className="text-xs font-medium">
                Meta Anual de Faturamento (R$ - Opcional)
              </Label>
              <Input
                id="meta-perf"
                type="number"
                step="1000"
                value={formMeta}
                onChange={(e) => setFormMeta(e.target.value)}
                placeholder="Ex: 2500000"
                className="h-8 text-xs"
              />
            </div>

            {/* Observações */}
            <div className="space-y-1.5">
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
