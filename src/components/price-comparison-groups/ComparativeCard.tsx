// Card de um comparativo salvo (grupo com destino específico/oficial),
// usado no painel lateral de Validação e na biblioteca de Comparativos
// Específicos (item 16).
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreVertical } from "lucide-react";
import type { ComparisonGroup } from "@/lib/price-comparison-groups";

export function ComparativeCard({
  group,
  itemCount,
  onOpen,
  onEdit,
  onDuplicate,
  onSubstitute,
  onReport,
  onSaveOfficial,
  onRename,
  onDelete,
  canManage,
}: {
  group: ComparisonGroup;
  itemCount: number;
  onOpen: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onSubstitute: () => void;
  onReport: () => void;
  onSaveOfficial: () => void;
  onRename: () => void;
  onDelete: () => void;
  canManage: boolean;
}) {
  return (
    <div className="rounded-lg border bg-card p-3 space-y-1.5">
      <div className="flex items-start justify-between gap-2">
        <button onClick={onOpen} className="text-left text-sm font-medium hover:underline flex-1">
          {group.name}
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0">
              <MoreVertical className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onOpen}>Abrir</DropdownMenuItem>
            <DropdownMenuItem onClick={onEdit}>Editar</DropdownMenuItem>
            <DropdownMenuItem onClick={onDuplicate}>Duplicar</DropdownMenuItem>
            <DropdownMenuItem onClick={onSubstitute}>Substituir competidor</DropdownMenuItem>
            <DropdownMenuItem onClick={onReport}>Gerar relatório</DropdownMenuItem>
            {canManage && !group.is_official && (
              <DropdownMenuItem onClick={onSaveOfficial}>Salvar como oficial</DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={onRename}>Renomear</DropdownMenuItem>
            {canManage && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onDelete} className="text-destructive">
                  Excluir
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
        <Badge variant="secondary" className="text-[10px]">
          {group.familia}
        </Badge>
        {group.is_official && (
          <Badge className="text-[10px] bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
            Oficial
          </Badge>
        )}
        <span>{group.base_brand}</span>
        <span>· {itemCount} itens</span>
      </div>
      <p className="text-[11px] text-muted-foreground">
        {new Date(group.updated_at).toLocaleDateString("pt-BR")}
      </p>
    </div>
  );
}
