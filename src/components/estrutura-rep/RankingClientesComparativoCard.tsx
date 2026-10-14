import React, { useState } from "react";
import type {
  RankingClientesComparativo,
  PeriodoRankingClientes,
} from "@/lib/estrutura-rep/types";
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
  Award,
  Crown,
  Medal,
  Pencil,
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  Users,
  Calendar,
  Loader2,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

interface RankingClientesComparativoCardProps {
  data?: RankingClientesComparativo;
  onSave?: (updated: RankingClientesComparativo) => Promise<void> | void;
  className?: string;
}

const DEFAULT_PERIODO_1: PeriodoRankingClientes = {
  label: "2025 (Ano Completo)",
  ano: 2025,
  periodo_meses: "Ano Completo",
  qtd_silver: 18,
  qtd_gold: 8,
  qtd_black: 3,
};

const DEFAULT_PERIODO_2: PeriodoRankingClientes = {
  label: "2026 (Jan - Out)",
  ano: 2026,
  periodo_meses: "Jan a Out",
  qtd_silver: 22,
  qtd_gold: 11,
  qtd_black: 5,
};

const AVAILABLE_YEARS = [2021, 2022, 2023, 2024, 2025, 2026, 2027, 2028];

export function calcPontosRanking(p?: PeriodoRankingClientes) {
  const silver = Number(p?.qtd_silver) || 0;
  const gold = Number(p?.qtd_gold) || 0;
  const black = Number(p?.qtd_black) || 0;
  const pontosSilver = silver * 1;
  const pontosGold = gold * 2;
  const pontosBlack = black * 3;
  const totalPontos = pontosSilver + pontosGold + pontosBlack;
  const totalClientes = silver + gold + black;

  return {
    silverCount: silver,
    goldCount: gold,
    blackCount: black,
    pontosSilver,
    pontosGold,
    pontosBlack,
    totalPontos,
    totalClientes,
  };
}

export function RankingClientesComparativoCard({
  data,
  onSave,
  className = "",
}: RankingClientesComparativoCardProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const p1 = data?.periodo_1 || DEFAULT_PERIODO_1;
  const p2 = data?.periodo_2 || DEFAULT_PERIODO_2;
  const observacoes = data?.observacoes || "";

  // Cálculos do Período 1 e Período 2
  const calc1 = calcPontosRanking(p1);
  const calc2 = calcPontosRanking(p2);

  // Variação de Pontuação e Carteira
  const deltaPontos = calc2.totalPontos - calc1.totalPontos;
  const deltaPontosPct =
    calc1.totalPontos > 0 ? (deltaPontos / calc1.totalPontos) * 100 : 0;
  const isPositivoPontos = deltaPontos >= 0;

  const deltaClientes = calc2.totalClientes - calc1.totalClientes;
  const deltaBlack = calc2.blackCount - calc1.blackCount;
  const deltaGold = calc2.goldCount - calc1.goldCount;
  const deltaSilver = calc2.silverCount - calc1.silverCount;

  // Estados locais do modal
  const [formP1Label, setFormP1Label] = useState(p1.label);
  const [formP1Ano, setFormP1Ano] = useState<number>(p1.ano || 2025);
  const [formP1Meses, setFormP1Meses] = useState(p1.periodo_meses || "Ano Completo");
  const [formP1Silver, setFormP1Silver] = useState(String(p1.qtd_silver));
  const [formP1Gold, setFormP1Gold] = useState(String(p1.qtd_gold));
  const [formP1Black, setFormP1Black] = useState(String(p1.qtd_black));

  const [formP2Label, setFormP2Label] = useState(p2.label);
  const [formP2Ano, setFormP2Ano] = useState<number>(p2.ano || 2026);
  const [formP2Meses, setFormP2Meses] = useState(p2.periodo_meses || "Jan a Out");
  const [formP2Silver, setFormP2Silver] = useState(String(p2.qtd_silver));
  const [formP2Gold, setFormP2Gold] = useState(String(p2.qtd_gold));
  const [formP2Black, setFormP2Black] = useState(String(p2.qtd_black));

  const [formObs, setFormObs] = useState(observacoes);

  const handleOpenEdit = () => {
    setFormP1Label(p1.label);
    setFormP1Ano(p1.ano || 2025);
    setFormP1Meses(p1.periodo_meses || "Ano Completo");
    setFormP1Silver(String(p1.qtd_silver));
    setFormP1Gold(String(p1.qtd_gold));
    setFormP1Black(String(p1.qtd_black));

    setFormP2Label(p2.label);
    setFormP2Ano(p2.ano || 2026);
    setFormP2Meses(p2.periodo_meses || "Jan a Out");
    setFormP2Silver(String(p2.qtd_silver));
    setFormP2Gold(String(p2.qtd_gold));
    setFormP2Black(String(p2.qtd_black));

    setFormObs(observacoes);
    setModalOpen(true);
  };

  const handleSaveModal = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSaving(true);
    try {
      const updated: RankingClientesComparativo = {
        periodo_1: {
          label: formP1Label.trim() || `${formP1Ano} (${formP1Meses})`,
          ano: formP1Ano,
          periodo_meses: formP1Meses,
          qtd_silver: Math.max(0, parseInt(formP1Silver, 10) || 0),
          qtd_gold: Math.max(0, parseInt(formP1Gold, 10) || 0),
          qtd_black: Math.max(0, parseInt(formP1Black, 10) || 0),
        },
        periodo_2: {
          label: formP2Label.trim() || `${formP2Ano} (${formP2Meses})`,
          ano: formP2Ano,
          periodo_meses: formP2Meses,
          qtd_silver: Math.max(0, parseInt(formP2Silver, 10) || 0),
          qtd_gold: Math.max(0, parseInt(formP2Gold, 10) || 0),
          qtd_black: Math.max(0, parseInt(formP2Black, 10) || 0),
        },
        observacoes: formObs.trim() || undefined,
      };

      await onSave?.(updated);
      toast.success("Ranking comparativo de clientes atualizado com sucesso!");
      setModalOpen(false);
    } catch (err: any) {
      toast.error(err?.message || "Falha ao salvar ranking de clientes");
    } finally {
      setSaving(false);
    }
  };

  // Preview dinâmico dentro do modal
  const formP1TotalPontos =
    (parseInt(formP1Silver, 10) || 0) * 1 +
    (parseInt(formP1Gold, 10) || 0) * 2 +
    (parseInt(formP1Black, 10) || 0) * 3;
  const formP2TotalPontos =
    (parseInt(formP2Silver, 10) || 0) * 1 +
    (parseInt(formP2Gold, 10) || 0) * 2 +
    (parseInt(formP2Black, 10) || 0) * 3;

  return (
    <div
      className={`bg-card rounded-xl border p-4 sm:p-6 shadow-xs flex flex-col ${className}`}
    >
      {/* Cabeçalho da Seção */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
              <Award className="h-5 w-5" />
            </div>
            <h3 className="text-base font-semibold tracking-tight text-foreground uppercase">
              Ranking comparativo de clientes por categoria
            </h3>
          </div>
          <p className="text-xs text-muted-foreground mt-1 flex flex-wrap items-center gap-1.5">
            <span>Pontuação ponderada do período:</span>
            <span className="inline-flex items-center gap-1 font-medium text-slate-600 dark:text-slate-300">
              <Medal className="h-3 w-3 text-slate-400" /> Silver = 1 pt
            </span>
            <span>•</span>
            <span className="inline-flex items-center gap-1 font-medium text-amber-600 dark:text-amber-400">
              <Sparkles className="h-3 w-3 text-amber-500" /> Gold = 2 pts
            </span>
            <span>•</span>
            <span className="inline-flex items-center gap-1 font-medium text-foreground">
              <Crown className="h-3 w-3 text-yellow-500" /> Black = 3 pts
            </span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Badge Resumo de Evolução de Pontuação */}
          <Badge
            variant="outline"
            className={`text-xs px-2.5 py-1 font-bold border gap-1 ${
              isPositivoPontos
                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                : "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30"
            }`}
          >
            {isPositivoPontos ? (
              <ArrowUpRight className="h-3.5 w-3.5 inline text-emerald-600" />
            ) : (
              <ArrowDownRight className="h-3.5 w-3.5 inline text-rose-600" />
            )}
            <span>
              Evolução: {isPositivoPontos ? "+" : ""}
              {deltaPontos} pts ({isPositivoPontos ? "+" : ""}
              {deltaPontosPct.toFixed(1)}%)
            </span>
          </Badge>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleOpenEdit}
            className="h-8 text-xs font-semibold gap-1.5 text-primary hover:text-primary hover:bg-primary/10 px-3 shadow-2xs"
            title="Editar períodos e quantidade de clientes"
          >
            <Pencil className="h-3.5 w-3.5" />
            <span>Editar Dados</span>
          </Button>
        </div>
      </div>

      {/* Tela Dividida em Duas (Horizontalmente: Coluna 1 vs Coluna 2) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6 mt-4">
        {/* Painel Esquerdo: Período 1 (Base) */}
        <div className="flex flex-col rounded-xl border border-border/80 bg-muted/20 p-4 sm:p-5 relative overflow-hidden">
          {/* Header do Período 1 */}
          <div className="flex items-center justify-between pb-3 border-b border-border/70">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-bold text-foreground">
                {p1.label}
              </span>
            </div>
            <Badge variant="secondary" className="text-xs font-semibold">
              <Users className="h-3 w-3 mr-1" />
              {calc1.totalClientes} Clientes
            </Badge>
          </div>

          {/* Destaque de Pontuação Total do Período 1 */}
          <div className="mt-3.5 p-3 rounded-lg bg-card border shadow-2xs flex items-center justify-between">
            <div>
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                Pontuação do Período
              </span>
              <span className="text-xs text-muted-foreground font-mono">
                {calc1.silverCount}×1 + {calc1.goldCount}×2 + {calc1.blackCount}×3
              </span>
            </div>
            <div className="text-right">
              <span className="text-2xl font-black text-foreground tracking-tight">
                {calc1.totalPontos}
              </span>
              <span className="text-xs font-semibold text-muted-foreground ml-1">
                pts
              </span>
            </div>
          </div>

          {/* Categorias de Clientes (Black, Gold, Silver) */}
          <div className="mt-4 space-y-2.5 flex-1">
            {/* Categoria Black */}
            <div className="p-3 rounded-lg border border-zinc-800 bg-zinc-950 text-zinc-100 flex items-center justify-between shadow-2xs">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-md bg-yellow-500/20 text-yellow-400">
                  <Crown className="h-4 w-4" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-extrabold uppercase tracking-wide">
                      Black
                    </span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-300 font-mono">
                      3 pts
                    </span>
                  </div>
                  <span className="text-[11px] text-zinc-400">
                    {calc1.totalClientes > 0
                      ? `${((calc1.blackCount / calc1.totalClientes) * 100).toFixed(0)}% da carteira`
                      : "0%"}
                  </span>
                </div>
              </div>
              <div className="text-right">
                <span className="text-base font-black">{calc1.blackCount}</span>
                <span className="text-xs text-zinc-400 ml-1">clientes</span>
                <div className="text-[11px] font-semibold text-yellow-400">
                  {calc1.pontosBlack} pts
                </div>
              </div>
            </div>

            {/* Categoria Gold */}
            <div className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-100 flex items-center justify-between shadow-2xs">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-md bg-amber-500/20 text-amber-600 dark:text-amber-400">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-extrabold uppercase tracking-wide">
                      Gold
                    </span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-800 dark:text-amber-300 font-mono font-medium">
                      2 pts
                    </span>
                  </div>
                  <span className="text-[11px] text-muted-foreground">
                    {calc1.totalClientes > 0
                      ? `${((calc1.goldCount / calc1.totalClientes) * 100).toFixed(0)}% da carteira`
                      : "0%"}
                  </span>
                </div>
              </div>
              <div className="text-right">
                <span className="text-base font-black text-foreground">
                  {calc1.goldCount}
                </span>
                <span className="text-xs text-muted-foreground ml-1">clientes</span>
                <div className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                  {calc1.pontosGold} pts
                </div>
              </div>
            </div>

            {/* Categoria Silver */}
            <div className="p-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-500/10 text-slate-800 dark:text-slate-100 flex items-center justify-between shadow-2xs">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-md bg-slate-400/20 text-slate-600 dark:text-slate-300">
                  <Medal className="h-4 w-4" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-extrabold uppercase tracking-wide">
                      Silver
                    </span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-400/20 text-slate-700 dark:text-slate-300 font-mono font-medium">
                      1 pt
                    </span>
                  </div>
                  <span className="text-[11px] text-muted-foreground">
                    {calc1.totalClientes > 0
                      ? `${((calc1.silverCount / calc1.totalClientes) * 100).toFixed(0)}% da carteira`
                      : "0%"}
                  </span>
                </div>
              </div>
              <div className="text-right">
                <span className="text-base font-black text-foreground">
                  {calc1.silverCount}
                </span>
                <span className="text-xs text-muted-foreground ml-1">clientes</span>
                <div className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                  {calc1.pontosSilver} pts
                </div>
              </div>
            </div>
          </div>

          {/* Barra Visual de Proporção da Carteira */}
          <div className="mt-4 pt-3 border-t border-border/70">
            <span className="text-[10.5px] font-medium text-muted-foreground block mb-1.5">
              Composição da Carteira
            </span>
            <div className="h-2.5 w-full rounded-full bg-muted flex overflow-hidden">
              {calc1.totalClientes > 0 && (
                <>
                  <div
                    style={{
                      width: `${(calc1.blackCount / calc1.totalClientes) * 100}%`,
                    }}
                    className="bg-zinc-900 dark:bg-zinc-100 transition-all"
                    title={`Black: ${calc1.blackCount}`}
                  />
                  <div
                    style={{
                      width: `${(calc1.goldCount / calc1.totalClientes) * 100}%`,
                    }}
                    className="bg-amber-500 transition-all"
                    title={`Gold: ${calc1.goldCount}`}
                  />
                  <div
                    style={{
                      width: `${(calc1.silverCount / calc1.totalClientes) * 100}%`,
                    }}
                    className="bg-slate-400 transition-all"
                    title={`Silver: ${calc1.silverCount}`}
                  />
                </>
              )}
            </div>
          </div>
        </div>

        {/* Painel Direito: Período 2 (Comparado) */}
        <div className="flex flex-col rounded-xl border border-primary/40 bg-primary/5 p-4 sm:p-5 relative overflow-hidden">
          {/* Header do Período 2 */}
          <div className="flex items-center justify-between pb-3 border-b border-primary/20">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              <span className="text-sm font-bold text-foreground">
                {p2.label}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Badge
                variant="outline"
                className="text-xs font-semibold bg-primary/10 text-primary border-primary/30"
              >
                <Users className="h-3 w-3 mr-1" />
                {calc2.totalClientes} Clientes
                {deltaClientes !== 0 && (
                  <span className="ml-1 text-[10px] font-bold">
                    ({deltaClientes > 0 ? "+" : ""}
                    {deltaClientes})
                  </span>
                )}
              </Badge>
            </div>
          </div>

          {/* Destaque de Pontuação Total do Período 2 */}
          <div className="mt-3.5 p-3 rounded-lg bg-card border border-primary/20 shadow-2xs flex items-center justify-between">
            <div>
              <span className="text-[11px] font-semibold text-primary uppercase tracking-wider block">
                Pontuação do Período
              </span>
              <span className="text-xs text-muted-foreground font-mono">
                {calc2.silverCount}×1 + {calc2.goldCount}×2 + {calc2.blackCount}×3
              </span>
            </div>
            <div className="text-right flex items-center gap-2">
              <Badge
                variant="outline"
                className={`text-[11px] font-bold ${
                  isPositivoPontos
                    ? "text-emerald-700 dark:text-emerald-300 bg-emerald-500/15 border-emerald-500/30"
                    : "text-rose-700 dark:text-rose-300 bg-rose-500/15 border-rose-500/30"
                }`}
              >
                {isPositivoPontos ? "+" : ""}
                {deltaPontos} pts
              </Badge>
              <div>
                <span className="text-2xl font-black text-foreground tracking-tight">
                  {calc2.totalPontos}
                </span>
                <span className="text-xs font-semibold text-muted-foreground ml-1">
                  pts
                </span>
              </div>
            </div>
          </div>

          {/* Categorias de Clientes (Black, Gold, Silver) */}
          <div className="mt-4 space-y-2.5 flex-1">
            {/* Categoria Black */}
            <div className="p-3 rounded-lg border border-zinc-800 bg-zinc-950 text-zinc-100 flex items-center justify-between shadow-2xs">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-md bg-yellow-500/20 text-yellow-400">
                  <Crown className="h-4 w-4" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-extrabold uppercase tracking-wide">
                      Black
                    </span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-300 font-mono">
                      3 pts
                    </span>
                    {deltaBlack !== 0 && (
                      <span
                        className={`text-[10px] font-bold px-1 rounded ${
                          deltaBlack > 0
                            ? "text-emerald-400 bg-emerald-950/60"
                            : "text-rose-400 bg-rose-950/60"
                        }`}
                      >
                        {deltaBlack > 0 ? "+" : ""}
                        {deltaBlack}
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-zinc-400">
                    {calc2.totalClientes > 0
                      ? `${((calc2.blackCount / calc2.totalClientes) * 100).toFixed(0)}% da carteira`
                      : "0%"}
                  </span>
                </div>
              </div>
              <div className="text-right">
                <span className="text-base font-black">{calc2.blackCount}</span>
                <span className="text-xs text-zinc-400 ml-1">clientes</span>
                <div className="text-[11px] font-semibold text-yellow-400">
                  {calc2.pontosBlack} pts
                </div>
              </div>
            </div>

            {/* Categoria Gold */}
            <div className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-100 flex items-center justify-between shadow-2xs">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-md bg-amber-500/20 text-amber-600 dark:text-amber-400">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-extrabold uppercase tracking-wide">
                      Gold
                    </span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-800 dark:text-amber-300 font-mono font-medium">
                      2 pts
                    </span>
                    {deltaGold !== 0 && (
                      <span
                        className={`text-[10px] font-bold px-1 rounded ${
                          deltaGold > 0
                            ? "text-emerald-600 dark:text-emerald-400 bg-emerald-500/20"
                            : "text-rose-600 dark:text-rose-400 bg-rose-500/20"
                        }`}
                      >
                        {deltaGold > 0 ? "+" : ""}
                        {deltaGold}
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-muted-foreground">
                    {calc2.totalClientes > 0
                      ? `${((calc2.goldCount / calc2.totalClientes) * 100).toFixed(0)}% da carteira`
                      : "0%"}
                  </span>
                </div>
              </div>
              <div className="text-right">
                <span className="text-base font-black text-foreground">
                  {calc2.goldCount}
                </span>
                <span className="text-xs text-muted-foreground ml-1">clientes</span>
                <div className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                  {calc2.pontosGold} pts
                </div>
              </div>
            </div>

            {/* Categoria Silver */}
            <div className="p-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-500/10 text-slate-800 dark:text-slate-100 flex items-center justify-between shadow-2xs">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-md bg-slate-400/20 text-slate-600 dark:text-slate-300">
                  <Medal className="h-4 w-4" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-extrabold uppercase tracking-wide">
                      Silver
                    </span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-400/20 text-slate-700 dark:text-slate-300 font-mono font-medium">
                      1 pt
                    </span>
                    {deltaSilver !== 0 && (
                      <span
                        className={`text-[10px] font-bold px-1 rounded ${
                          deltaSilver > 0
                            ? "text-emerald-600 dark:text-emerald-400 bg-emerald-500/20"
                            : "text-rose-600 dark:text-rose-400 bg-rose-500/20"
                        }`}
                      >
                        {deltaSilver > 0 ? "+" : ""}
                        {deltaSilver}
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-muted-foreground">
                    {calc2.totalClientes > 0
                      ? `${((calc2.silverCount / calc2.totalClientes) * 100).toFixed(0)}% da carteira`
                      : "0%"}
                  </span>
                </div>
              </div>
              <div className="text-right">
                <span className="text-base font-black text-foreground">
                  {calc2.silverCount}
                </span>
                <span className="text-xs text-muted-foreground ml-1">clientes</span>
                <div className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                  {calc2.pontosSilver} pts
                </div>
              </div>
            </div>
          </div>

          {/* Barra Visual de Proporção da Carteira */}
          <div className="mt-4 pt-3 border-t border-primary/20">
            <span className="text-[10.5px] font-medium text-muted-foreground block mb-1.5">
              Composição da Carteira
            </span>
            <div className="h-2.5 w-full rounded-full bg-muted flex overflow-hidden">
              {calc2.totalClientes > 0 && (
                <>
                  <div
                    style={{
                      width: `${(calc2.blackCount / calc2.totalClientes) * 100}%`,
                    }}
                    className="bg-zinc-900 dark:bg-zinc-100 transition-all"
                    title={`Black: ${calc2.blackCount}`}
                  />
                  <div
                    style={{
                      width: `${(calc2.goldCount / calc2.totalClientes) * 100}%`,
                    }}
                    className="bg-amber-500 transition-all"
                    title={`Gold: ${calc2.goldCount}`}
                  />
                  <div
                    style={{
                      width: `${(calc2.silverCount / calc2.totalClientes) * 100}%`,
                    }}
                    className="bg-slate-400 transition-all"
                    title={`Silver: ${calc2.silverCount}`}
                  />
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Observações / Rodapé */}
      {observacoes && (
        <div className="mt-3.5 pt-3 border-t border-border/70 text-xs text-muted-foreground italic">
          "{observacoes}"
        </div>
      )}

      {/* Modal de Preenchimento Manual dos Dois Períodos */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-2xl p-0 overflow-hidden">
          <DialogHeader className="p-5 pb-3 border-b bg-muted/20">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <Award className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-semibold">
                  Editar Ranking Comparativo de Clientes
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Configure os períodos de comparação e insira manualmente as quantidades por categoria.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <form onSubmit={handleSaveModal} className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Formulário Período 1 */}
              <div className="p-3.5 rounded-lg border bg-muted/20 space-y-3">
                <div className="flex items-center justify-between border-b pb-2">
                  <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                    1º Período (Base)
                  </span>
                  <Badge variant="secondary" className="text-[11px] font-bold">
                    {formP1TotalPontos} pts
                  </Badge>
                </div>

                <div className="space-y-1">
                  <span className="text-[11px] text-muted-foreground font-medium">
                    Rótulo do Período:
                  </span>
                  <Input
                    value={formP1Label}
                    onChange={(e) => setFormP1Label(e.target.value)}
                    placeholder="Ex: 2025 (Ano Completo)"
                    className="h-8 text-xs bg-background"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <span className="text-[10.5px] text-muted-foreground">Ano:</span>
                    <Select
                      value={String(formP1Ano)}
                      onValueChange={(val) => setFormP1Ano(parseInt(val, 10))}
                    >
                      <SelectTrigger className="h-7 text-xs bg-background">
                        <SelectValue placeholder="Ano" />
                      </SelectTrigger>
                      <SelectContent>
                        {AVAILABLE_YEARS.map((y) => (
                          <SelectItem key={y} value={String(y)} className="text-xs">
                            {y}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10.5px] text-muted-foreground">Meses/Período:</span>
                    <Input
                      value={formP1Meses}
                      onChange={(e) => setFormP1Meses(e.target.value)}
                      placeholder="Ex: Ano Completo"
                      className="h-7 text-xs bg-background"
                    />
                  </div>
                </div>

                <div className="pt-2 border-t space-y-2">
                  <span className="text-[11px] font-semibold text-foreground block">
                    Quantidade de Clientes por Categoria:
                  </span>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <Label className="text-xs font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-1">
                        <Crown className="h-3 w-3 text-yellow-500" /> Black (3 pts):
                      </Label>
                      <Input
                        type="number"
                        min="0"
                        value={formP1Black}
                        onChange={(e) => setFormP1Black(e.target.value)}
                        className="h-7 w-20 text-xs bg-background text-right font-bold"
                      />
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <Label className="text-xs font-bold text-amber-700 dark:text-amber-300 flex items-center gap-1">
                        <Sparkles className="h-3 w-3 text-amber-500" /> Gold (2 pts):
                      </Label>
                      <Input
                        type="number"
                        min="0"
                        value={formP1Gold}
                        onChange={(e) => setFormP1Gold(e.target.value)}
                        className="h-7 w-20 text-xs bg-background text-right font-bold"
                      />
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <Label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                        <Medal className="h-3 w-3 text-slate-400" /> Silver (1 pt):
                      </Label>
                      <Input
                        type="number"
                        min="0"
                        value={formP1Silver}
                        onChange={(e) => setFormP1Silver(e.target.value)}
                        className="h-7 w-20 text-xs bg-background text-right font-bold"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Formulário Período 2 */}
              <div className="p-3.5 rounded-lg border border-primary/40 bg-primary/5 space-y-3">
                <div className="flex items-center justify-between border-b border-primary/20 pb-2">
                  <span className="text-xs font-bold text-primary flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-primary" />
                    2º Período (Comparado)
                  </span>
                  <Badge variant="outline" className="text-[11px] font-bold bg-primary/10 text-primary border-primary/30">
                    {formP2TotalPontos} pts
                  </Badge>
                </div>

                <div className="space-y-1">
                  <span className="text-[11px] text-primary font-medium">
                    Rótulo do Período:
                  </span>
                  <Input
                    value={formP2Label}
                    onChange={(e) => setFormP2Label(e.target.value)}
                    placeholder="Ex: 2026 (Jan - Out)"
                    className="h-8 text-xs bg-background font-semibold border-primary/30"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <span className="text-[10.5px] text-muted-foreground">Ano:</span>
                    <Select
                      value={String(formP2Ano)}
                      onValueChange={(val) => setFormP2Ano(parseInt(val, 10))}
                    >
                      <SelectTrigger className="h-7 text-xs bg-background">
                        <SelectValue placeholder="Ano" />
                      </SelectTrigger>
                      <SelectContent>
                        {AVAILABLE_YEARS.map((y) => (
                          <SelectItem key={y} value={String(y)} className="text-xs">
                            {y}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10.5px] text-muted-foreground">Meses/Período:</span>
                    <Input
                      value={formP2Meses}
                      onChange={(e) => setFormP2Meses(e.target.value)}
                      placeholder="Ex: Jan a Out"
                      className="h-7 text-xs bg-background"
                    />
                  </div>
                </div>

                <div className="pt-2 border-t border-primary/20 space-y-2">
                  <span className="text-[11px] font-semibold text-foreground block">
                    Quantidade de Clientes por Categoria:
                  </span>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <Label className="text-xs font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-1">
                        <Crown className="h-3 w-3 text-yellow-500" /> Black (3 pts):
                      </Label>
                      <Input
                        type="number"
                        min="0"
                        value={formP2Black}
                        onChange={(e) => setFormP2Black(e.target.value)}
                        className="h-7 w-20 text-xs bg-background text-right font-bold"
                      />
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <Label className="text-xs font-bold text-amber-700 dark:text-amber-300 flex items-center gap-1">
                        <Sparkles className="h-3 w-3 text-amber-500" /> Gold (2 pts):
                      </Label>
                      <Input
                        type="number"
                        min="0"
                        value={formP2Gold}
                        onChange={(e) => setFormP2Gold(e.target.value)}
                        className="h-7 w-20 text-xs bg-background text-right font-bold"
                      />
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <Label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                        <Medal className="h-3 w-3 text-slate-400" /> Silver (1 pt):
                      </Label>
                      <Input
                        type="number"
                        min="0"
                        value={formP2Silver}
                        onChange={(e) => setFormP2Silver(e.target.value)}
                        className="h-7 w-20 text-xs bg-background text-right font-bold"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Observações */}
            <div className="space-y-1">
              <Label htmlFor="obs-ranking" className="text-xs font-medium">
                Observações / Análise da Carteira
              </Label>
              <Input
                id="obs-ranking"
                value={formObs}
                onChange={(e) => setFormObs(e.target.value)}
                placeholder="Ex: Migração de clientes Silver para Gold e prospecção de contas Black"
                className="h-8 text-xs bg-background"
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
