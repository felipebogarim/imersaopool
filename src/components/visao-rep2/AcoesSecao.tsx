import { useState } from "react";
import { ListPlus, MoreVertical, NotebookPen, StickyNote } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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

/**
 * Kebab discreto (nota + ação) para seções internas — sem cabeçalho ou borda de cartão.
 * A chave separa as notas por contexto (representante) e por escopo (ex.: perspectiva).
 */
export function AcoesSecao({
  titulo,
  descricao,
  contexto,
  escopo,
}: {
  titulo: string;
  descricao?: string;
  /** Identificador do contexto (ex.: id do representante). */
  contexto?: string;
  /** Sub-escopo dentro do contexto (ex.: `p03`). */
  escopo?: string;
}) {
  const [notasOpen, setNotasOpen] = useState(false);
  const [tarefa, setTarefa] = useState<{ title: string; description: string } | null>(null);

  const blocoKey = [contexto ?? "global", escopo, slug(titulo)].filter(Boolean).join("::");

  const { data: totalNotas = 0 } = useQuery({
    queryKey: ["bloco-notes-count", blocoKey],
    queryFn: async () => {
      const { count } = await supabase
        .from("bloco_notes")
        .select("id", { count: "exact", head: true })
        .eq("bloco_key", blocoKey);
      return count ?? 0;
    },
  });

  return (
    <span className="flex shrink-0 items-center gap-1">
      {totalNotas > 0 && (
        <button
          type="button"
          onClick={() => setNotasOpen(true)}
          title={`${totalNotas} nota(s)`}
          className="flex items-center gap-1 rounded-full px-1 py-0.5 text-[11px] text-muted-foreground/70 transition hover:text-foreground"
        >
          <StickyNote className="h-3 w-3" />
          {totalNotas}
        </button>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={`Ações · ${titulo}`}
            className="rounded-md p-0.5 text-muted-foreground/40 transition hover:bg-muted hover:text-foreground"
          >
            <MoreVertical className="h-3.5 w-3.5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setNotasOpen(true)}>
            <NotebookPen className="mr-2 h-4 w-4" /> Adicionar nota
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setTarefa({ title: titulo, description: descricao ?? "" })}>
            <ListPlus className="mr-2 h-4 w-4" /> Adicionar ação
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <BlocoNotasDialog blocoKey={blocoKey} titulo={titulo} open={notasOpen} onOpenChange={setNotasOpen} />
      <GerarTarefaDialog tarefa={tarefa} onClose={() => setTarefa(null)} />
    </span>
  );
}
