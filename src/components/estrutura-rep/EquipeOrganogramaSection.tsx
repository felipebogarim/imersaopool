import React, { useState } from "react";
import type { MembroEquipe } from "@/lib/estrutura-rep/types";
import { VINCULO_LABEL, MODALIDADE_LABEL } from "@/lib/estrutura-rep/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Users,
  UserCheck,
  Briefcase,
  Laptop,
  Building,
  Crown,
  Headset,
  Plus,
  Network,
  ChevronDown,
} from "lucide-react";

interface EquipeOrganogramaSectionProps {
  equipe: MembroEquipe[];
  onAddClick?: () => void;
  className?: string;
}

interface OrganogramaGrupos {
  titulares: MembroEquipe[];
  prepostos: MembroEquipe[];
  assistentes: MembroEquipe[];
}

/**
 * Classifica a equipe nos 3 níveis hierárquicos do organograma:
 * Nível 1 (Topo): Representante Principal / Titular
 * Nível 2 (Abaixo): Prepostos Comerciais / Vendas em Campo
 * Nível 3 (Base): Assistentes Comerciais / Backoffice / Atendimento
 */
function categorizarOrganograma(equipe: MembroEquipe[]): OrganogramaGrupos {
  const titulares: MembroEquipe[] = [];
  const prepostos: MembroEquipe[] = [];
  const assistentes: MembroEquipe[] = [];

  equipe.forEach((m, idx) => {
    const cargoLower = (m.cargo || "").toLowerCase();

    // 1. Titular / Representante Principal
    if (
      m.nivel === "titular" ||
      cargoLower.includes("titular") ||
      cargoLower.includes("representante principal") ||
      cargoLower.includes("gestor comercial") ||
      cargoLower.includes("gestor geral") ||
      cargoLower.includes("sócio diretor") ||
      (m.vinculo === "socio" && !cargoLower.includes("assistente") && !cargoLower.includes("preposto")) ||
      (idx === 0 && !equipe.some((item) => item.nivel === "titular"))
    ) {
      titulares.push(m);
      return;
    }

    // 2. Prepostos Comerciais / Vendas Externas / Campo
    if (
      m.nivel === "preposto" ||
      m.nivel === "lideranca" ||
      cargoLower.includes("preposto") ||
      cargoLower.includes("vendedor") ||
      cargoLower.includes("comercial externo") ||
      cargoLower.includes("executivo") ||
      cargoLower.includes("consultor externo") ||
      (cargoLower.includes("campo") && !cargoLower.includes("assistente"))
    ) {
      prepostos.push(m);
      return;
    }

    // 3. Assistentes Comerciais / Backoffice / Operação / Apoio
    assistentes.push(m);
  });

  // Garantia: se não houver titular identificado e houver equipe, o 1º é titular
  if (titulares.length === 0 && equipe.length > 0) {
    const primeiro = equipe[0];
    titulares.push(primeiro);
    const pIdx = prepostos.findIndex((x) => x.id === primeiro.id);
    if (pIdx >= 0) prepostos.splice(pIdx, 1);
    const aIdx = assistentes.findIndex((x) => x.id === primeiro.id);
    if (aIdx >= 0) assistentes.splice(aIdx, 1);
  }

  return { titulares, prepostos, assistentes };
}

export function EquipeOrganogramaSection({
  equipe,
  onAddClick,
  className = "",
}: EquipeOrganogramaSectionProps) {
  const { titulares, prepostos, assistentes } = categorizarOrganograma(equipe);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

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

  const renderModalidadeIcon = (modalidade: string) => {
    switch (modalidade) {
      case "remoto":
        return <Laptop className="h-2.5 w-2.5 text-blue-500" />;
      case "presencial":
        return <Building className="h-2.5 w-2.5 text-emerald-500" />;
      default:
        return <Briefcase className="h-2.5 w-2.5 text-purple-500" />;
    }
  };

  // Renderiza um card compacto individual de integrante
  const renderMembroCard = (
    membro: MembroEquipe,
    theme: {
      border: string;
      badgeBg: string;
      badgeText: string;
      levelBadge: string;
      avatarBg: string;
      avatarText: string;
    }
  ) => {
    const isExpanded = expandedIds.has(membro.id);
    const initials = membro.nome
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0].toUpperCase())
      .join("");

    return (
      <div
        key={membro.id}
        className={`bg-card rounded-lg border ${theme.border} p-2 sm:p-2.5 shadow-2xs hover:shadow-xs transition-all w-full sm:w-auto min-w-[155px] max-w-[210px] shrink-0 flex flex-col justify-between`}
      >
        {/* Linha Principal em Primeiro Plano: Nome, Função e Setinha */}
        <div className="flex items-center justify-between gap-1.5">
          <div className="flex items-center gap-2 min-w-0">
            {/* Avatar compacto */}
            <div
              className={`h-7 w-7 rounded-full ${theme.avatarBg} ${theme.avatarText} font-bold text-[11px] flex items-center justify-center shrink-0 border`}
            >
              {initials}
            </div>

            {/* Nome e Função em Primeiro Plano com Destaque */}
            <div className="min-w-0">
              <h4
                className="text-xs font-bold text-foreground truncate leading-tight"
                title={membro.nome}
              >
                {membro.nome}
              </h4>
              <p
                className={`text-[10.5px] font-semibold truncate ${theme.badgeText} leading-tight mt-0.5`}
                title={membro.cargo}
              >
                {membro.cargo}
              </p>
            </div>
          </div>

          {/* Setinha para expandir os demais dados */}
          <button
            type="button"
            onClick={() => toggleExpand(membro.id)}
            className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
            title={isExpanded ? "Recolher detalhes" : "Expandir detalhes (vínculo, modelo e atribuições)"}
          >
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform duration-200 ${
                isExpanded ? "rotate-180" : ""
              }`}
            />
          </button>
        </div>

        {/* Detalhes Expandidos (Vínculo, Modalidade e Atribuições) */}
        {isExpanded && (
          <div className="mt-2 pt-2 border-t border-border/60 space-y-1.5 animate-in fade-in-50 duration-150">
            <div className="flex flex-wrap items-center gap-1 text-[9.5px]">
              <Badge
                variant="outline"
                className={`h-4 px-1.5 py-0 font-medium ${theme.badgeBg} ${theme.badgeText} border-border/80`}
              >
                {VINCULO_LABEL[membro.vinculo] || membro.vinculo}
              </Badge>
              <Badge
                variant="secondary"
                className="h-4 px-1.5 py-0 font-normal flex items-center gap-1 border text-muted-foreground"
              >
                {renderModalidadeIcon(membro.modalidade)}
                <span>{MODALIDADE_LABEL[membro.modalidade] || membro.modalidade}</span>
              </Badge>
            </div>

            {membro.responsabilidades && membro.responsabilidades.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-0.5">
                {membro.responsabilidades.slice(0, 3).map((resp, rIdx) => (
                  <span
                    key={rIdx}
                    className="text-[9px] px-1.5 py-0.5 rounded bg-muted/60 text-foreground/80 border border-border/60 truncate max-w-full"
                    title={resp}
                  >
                    • {resp}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={`flex flex-col h-full bg-card rounded-xl border p-4 sm:p-5 shadow-xs ${className}`}>
      {/* Header da Seção */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3 mb-3">
        <div>
          <div className="flex items-center gap-2">
            <Network className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold tracking-tight text-foreground uppercase">
              Organograma da Equipe
            </h3>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Titular → Prepostos → Assistentes Comerciais
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
              <span>Gerenciar</span>
            </Button>
          )}
          <Badge variant="outline" className="text-xs px-2 py-0.5 font-medium">
            {equipe.length} {equipe.length === 1 ? "Integrante" : "Integrantes"}
          </Badge>
        </div>
      </div>

      {/* Conteúdo: Organograma Hierárquico Compacto */}
      {equipe.length === 0 ? (
        <div
          onClick={onAddClick}
          role={onAddClick ? "button" : undefined}
          tabIndex={onAddClick ? 0 : undefined}
          onKeyDown={(e) => e.key === "Enter" && onAddClick?.()}
          className={`flex-1 flex flex-col items-center justify-center p-6 text-center text-muted-foreground border border-dashed rounded-xl bg-muted/10 ${
            onAddClick ? "cursor-pointer hover:bg-muted/20 transition-colors" : ""
          }`}
        >
          <Network className="h-8 w-8 mb-2 opacity-40 text-primary" />
          <p className="text-sm font-semibold text-foreground">Nenhum membro cadastrado</p>
          <p className="text-xs mt-1 max-w-sm">
            Cadastre o Representante Titular, Prepostos e Assistentes Comerciais.
          </p>
          {onAddClick && (
            <Button variant="ghost" size="sm" className="mt-2.5 h-7 text-xs gap-1 text-primary font-semibold">
              <Plus className="h-3.5 w-3.5" />
              Cadastrar Integrante
            </Button>
          )}
        </div>
      ) : (
        <div className="flex-1 flex flex-col justify-between space-y-2.5">
          {/* Legenda Resumida */}
          <div className="flex flex-wrap items-center justify-center gap-2 text-[10.5px]">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary font-bold border border-primary/20">
              <Crown className="h-2.5 w-2.5" /> Titular ({titulares.length})
            </span>
            <span className="text-muted-foreground/30">•</span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-700 dark:text-blue-300 font-bold border border-blue-500/20">
              <UserCheck className="h-2.5 w-2.5" /> Prepostos ({prepostos.length})
            </span>
            <span className="text-muted-foreground/30">•</span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted text-foreground/80 font-bold border border-border/80">
              <Headset className="h-2.5 w-2.5 text-primary" /> Assistentes ({assistentes.length})
            </span>
          </div>

          <div className="bg-muted/15 rounded-xl border border-border/60 p-2.5 sm:p-3 space-y-2">
            {/* ========================================================= */}
            {/* NÍVEL 1: REPRESENTANTE PRINCIPAL / TITULAR                 */}
            {/* ========================================================= */}
            <div className="flex flex-col items-center w-full">
              <span className="text-[9.5px] font-extrabold uppercase tracking-wider text-primary mb-1">
                Nível 1 • Representante Titular
              </span>

              <div className="flex flex-wrap items-center justify-center gap-2 w-full">
                {titulares.map((titular) =>
                  renderMembroCard(titular, {
                    border: "border-primary/40 bg-gradient-to-r from-primary/10 via-card to-primary/5",
                    badgeBg: "bg-primary/15",
                    badgeText: "text-primary",
                    levelBadge: "Titular",
                    avatarBg: "bg-primary",
                    avatarText: "text-primary-foreground",
                  })
                )}
              </div>
            </div>

            {/* Conector Vertical Nível 1 -> Nível 2 */}
            <div className="flex flex-col items-center justify-center -my-1 select-none">
              <div className="w-0.5 h-3 bg-primary/40 relative">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-primary" />
              </div>
            </div>

            {/* ========================================================= */}
            {/* NÍVEL 2: PREPOSTOS COMERCIAIS & CAMPO                     */}
            {/* ========================================================= */}
            <div className="flex flex-col items-center w-full">
              <span className="text-[9.5px] font-extrabold uppercase tracking-wider text-blue-600 dark:text-blue-400 mb-1">
                Nível 2 • Prepostos Comerciais & Campo ({prepostos.length})
              </span>

              {prepostos.length > 0 ? (
                <div className="flex flex-wrap items-center justify-center gap-2 w-full">
                  {prepostos.map((preposto) =>
                    renderMembroCard(preposto, {
                      border: "border-blue-300 dark:border-blue-900/60 hover:border-blue-400",
                      badgeBg: "bg-blue-500/10",
                      badgeText: "text-blue-600 dark:text-blue-400",
                      levelBadge: "Preposto",
                      avatarBg: "bg-blue-500/10",
                      avatarText: "text-blue-700 dark:text-blue-300",
                    })
                  )}
                </div>
              ) : (
                <p className="text-[10px] text-muted-foreground italic py-1">
                  Sem prepostos cadastrados (atuação direta do titular)
                </p>
              )}
            </div>

            {/* Conector Vertical Nível 2 -> Nível 3 */}
            <div className="flex flex-col items-center justify-center -my-1 select-none">
              <div className="w-0.5 h-3 bg-muted-foreground/30 relative">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-muted-foreground/60" />
              </div>
            </div>

            {/* ========================================================= */}
            {/* NÍVEL 3: ASSISTENTES COMERCIAIS & BACKOFFICE              */}
            {/* ========================================================= */}
            <div className="flex flex-col items-center w-full">
              <span className="text-[9.5px] font-extrabold uppercase tracking-wider text-muted-foreground mb-1">
                Nível 3 • Assistentes Comerciais & Backoffice ({assistentes.length})
              </span>

              {assistentes.length > 0 ? (
                <div className="flex flex-wrap items-center justify-center gap-2 w-full">
                  {assistentes.map((assistente) =>
                    renderMembroCard(assistente, {
                      border: "border-border/80 hover:border-border",
                      badgeBg: "bg-muted",
                      badgeText: "text-foreground/80",
                      levelBadge: "Assistente",
                      avatarBg: "bg-muted",
                      avatarText: "text-foreground",
                    })
                  )}
                </div>
              ) : (
                <p className="text-[10px] text-muted-foreground italic py-1">
                  Operação individual sem assistentes
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
