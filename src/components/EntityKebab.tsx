import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { MoreVertical, Pencil, Trash2, Shield } from "lucide-react";

type EntityType = "cliente" | "representante" | "agente";

export function EntityKebab({
  type,
  id,
  onEdit,
  onDelete,
  editTo,
}: {
  type: EntityType;
  id: string;
  onEdit?: () => void;
  onDelete?: () => void;
  editTo?: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="icon" variant="ghost" onClick={e => e.stopPropagation()}>
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={e => e.stopPropagation()}>
        {editTo ? (
          <DropdownMenuItem asChild>
            <Link to={editTo as any} params={{ id } as any}><Pencil className="h-4 w-4 mr-2" /> Editar</Link>
          </DropdownMenuItem>
        ) : onEdit ? (
          <DropdownMenuItem onClick={onEdit}><Pencil className="h-4 w-4 mr-2" /> Editar</DropdownMenuItem>
        ) : null}
        <DropdownMenuItem asChild>
          <Link to="/permissoes/$type/$id" params={{ type, id }}>
            <Shield className="h-4 w-4 mr-2" /> Gerenciar permissões
          </Link>
        </DropdownMenuItem>
        {onDelete && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">
              <Trash2 className="h-4 w-4 mr-2" /> Excluir
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
