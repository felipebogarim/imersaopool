import { useState, type ReactNode } from "react";
import { ChevronDown, ListPlus, MoreVertical, NotebookPen, StickyNote } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BlocoNotasDialog } from "./BlocoNotasDialog";
import { GerarTarefaDialog } from "@/components/sintese/GerarTarefaDialog";

function slug(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/** Bloco padrão da Visão Rep: cabeçalho clicável com seta de expandir/contrair. */
export function BlocoExpansivel({
  titulo,
  descricao,
  acessorio,
  children,
  defaultOpen = true,
  className,
  contexto,
  acoes = true,
}: {
  titulo: string;
  descricao?: string;
  acessorio?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
  /** Identificador do contexto (ex.: id do representante) para separar as notas. */
  contexto?: string;
  /** Exibe o kebab com "Adicionar nota" e "Adicionar ação". */
  acoes?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [notasOpen, setNotasOpen] = useState(false);
  const [tarefa, setTarefa] = useState<{ title: string; description: string } | null>(null);

  const blocoKey = `${contexto ?? "global"}::${slug(titulo)}`;

  const { data: totalNotas = 0 } = useQuery({
    queryKey: ["bloco-notes-count", blocoKey],
    enabled: acoes,
    queryFn: async () => {
      const { count } = await supabase
        .from("bloco_notes")
        .select("id", { count: "exact", head: true })
        .eq("bloco_key", blocoKey);
      return count ?? 0;
    },
  });

  return (
    <section className={cn("rounded-xl border bg-card", className)}>
      <div className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 p-5 sm:p-6">
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          aria-expanded={open}
          className="min-w-0 text-left"
        >
          <span className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {titulo}
          </span>
          {descricao ? <span className="mt-1 block text-sm text-muted-foreground">{descricao}</span> : null}
        </button>
        <span className="flex shrink-0 items-center gap-2">
          {acessorio}
          {acoes && totalNotas > 0 && (
            <button
              type="button"
              onClick={() => setNotasOpen(true)}
              title={`${totalNotas} nota(s)`}
              className="flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] text-muted-foreground/70 transition hover:text-foreground"
            >
              <StickyNote className="h-3.5 w-3.5" />
              {totalNotas}
            </button>
          )}
          {acoes && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="Ações do bloco"
                  className="rounded-md p-1 text-muted-foreground/60 transition hover:bg-muted hover:text-foreground"
                >
                  <MoreVertical className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => setNotasOpen(true)}>
                  <NotebookPen className="mr-2 h-4 w-4" /> Adicionar nota
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => setTarefa({ title: titulo, description: descricao ?? "" })}
                >
                  <ListPlus className="mr-2 h-4 w-4" /> Adicionar ação
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <button type="button" onClick={() => setOpen(o => !o)} aria-label={open ? "Contrair" : "Expandir"}>
            <ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform", open && "rotate-180")} aria-hidden />
          </button>
        </span>
      </div>
      {open ? <div className="border-t p-5 sm:p-6">{children}</div> : null}
      {acoes && (
        <>
          <BlocoNotasDialog blocoKey={blocoKey} titulo={titulo} open={notasOpen} onOpenChange={setNotasOpen} />
          <GerarTarefaDialog tarefa={tarefa} onClose={() => setTarefa(null)} />
        </>
      )}
    </section>
  );
}
