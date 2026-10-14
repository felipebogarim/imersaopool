import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  Save,
  Check,
  RotateCcw,
  Loader2,
  Calendar,
  Sparkles,
  Pencil,
} from "lucide-react";
import { toast } from "sonner";

interface RepObservacoesCardProps {
  observacoes?: string;
  onSave?: (texto: string) => Promise<void> | void;
  className?: string;
  title?: string;
  placeholder?: string;
}

export function RepObservacoesCard({
  observacoes = "",
  onSave,
  className = "",
  title = "Observações e Apontamentos",
  placeholder = "Insira observações sobre o representante, alinhamento de metas, diagnóstico do ranking de clientes (Black, Gold, Silver), evolução das vendas ou diretrizes comerciais...",
}: RepObservacoesCardProps) {
  const [texto, setTexto] = useState(observacoes);
  const [saving, setSaving] = useState(false);

  // Sincroniza estado quando a prop externa mudar (troca de representante selecionado)
  useEffect(() => {
    setTexto(observacoes);
  }, [observacoes]);

  const isDirty = texto !== observacoes;

  const handleSave = async () => {
    if (!isDirty && texto === observacoes) return;
    setSaving(true);
    try {
      await onSave?.(texto.trim());
      toast.success("Observações salvas com sucesso!");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg || "Erro ao salvar observações.");
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = () => {
    setTexto(observacoes);
    toast.info("Alterações descartadas.");
  };

  // Inserção rápida da data de hoje para notas de reunião / alinhamento
  const handleInsertDate = () => {
    const today = new Date();
    const formattedDate = today.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
    const prefix = texto.length > 0 && !texto.endsWith("\n") ? "\n" : "";
    setTexto((prev) => `${prev}${prefix}[${formattedDate}]: `);
  };

  // Inserção rápida de estrutura para diagnóstico de carteira
  const handleInsertTemplate = () => {
    const template =
      "• Diagnóstico Carteira:\n• Meta de Migração (Silver → Gold → Black):\n• Ações Prioritárias:";
    const prefix = texto.length > 0 && !texto.endsWith("\n") ? "\n\n" : "";
    setTexto((prev) => `${prev}${prefix}${template}`);
  };

  return (
    <div
      className={`bg-card rounded-xl border p-4 sm:p-6 shadow-xs flex flex-col h-full ${className}`}
    >
      {/* Cabeçalho do Card */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
              <FileText className="h-5 w-5" />
            </div>
            <h3 className="text-base font-semibold tracking-tight text-foreground uppercase">
              {title}
            </h3>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Diagnóstico comercial, alinhamentos e notas estratégicas
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isDirty ? (
            <Badge
              variant="outline"
              className="text-xs px-2 py-0.5 font-medium border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300 gap-1"
            >
              <Pencil className="h-3 w-3" />
              <span>Não salvo</span>
            </Badge>
          ) : texto ? (
            <Badge
              variant="outline"
              className="text-xs px-2 py-0.5 font-medium border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 gap-1"
            >
              <Check className="h-3 w-3" />
              <span>Salvo</span>
            </Badge>
          ) : null}
        </div>
      </div>

      {/* Atalhos Rápidos */}
      <div className="flex items-center justify-between gap-2 mt-3 pt-0.5">
        <span className="text-[11px] font-medium text-muted-foreground">
          Atalhos de anotação:
        </span>
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleInsertDate}
            className="h-6 px-2 text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted gap-1"
            title="Inserir data de hoje"
          >
            <Calendar className="h-3 w-3" />
            <span>+ Data</span>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleInsertTemplate}
            className="h-6 px-2 text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted gap-1"
            title="Inserir tópicos de diagnóstico comercial"
          >
            <Sparkles className="h-3 w-3 text-amber-500" />
            <span>+ Roteiro</span>
          </Button>
        </div>
      </div>

      {/* Área de Texto Principal */}
      <div className="mt-2 flex-1 flex flex-col">
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
              e.preventDefault();
              void handleSave();
            }
          }}
          placeholder={placeholder}
          className="w-full flex-1 min-h-[220px] p-3 text-xs sm:text-sm rounded-lg border border-border/80 bg-background/60 hover:bg-background focus:bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 leading-relaxed font-sans resize-none transition-all placeholder:text-muted-foreground/60 shadow-2xs"
        />
      </div>

      {/* Rodapé com Contador e Ações */}
      <div className="mt-3.5 pt-3 border-t border-border/70 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <span>{texto.length} caracteres</span>
          <span className="hidden sm:inline">•</span>
          <span className="hidden sm:inline text-muted-foreground/70">
            Ctrl+Enter para salvar
          </span>
        </div>

        <div className="flex items-center gap-2">
          {isDirty && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDiscard}
              disabled={saving}
              className="h-8 text-xs gap-1 border-border/80 text-muted-foreground hover:text-foreground px-2.5"
            >
              <RotateCcw className="h-3 w-3" />
              <span>Descartar</span>
            </Button>
          )}

          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            disabled={saving || !isDirty}
            className={`h-8 text-xs font-semibold gap-1.5 shadow-2xs px-3.5 ${
              isDirty
                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : "opacity-60 cursor-not-allowed"
            }`}
          >
            {saving ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Salvando...</span>
              </>
            ) : (
              <>
                <Save className="h-3.5 w-3.5" />
                <span>Salvar Observações</span>
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
