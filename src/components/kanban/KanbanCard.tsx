import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Calendar, MessageSquare, CheckSquare, Paperclip, Building2, Sparkles, UserRound } from "lucide-react";
import type { KCard } from "@/lib/kanban-types";
import { PRIORITY_COLOR, PRIORITY_LABEL } from "@/lib/kanban-types";
import { getSuggested, SUGGESTED_LABEL, SUGGESTED_COLOR } from "@/lib/kanban-suggested";
import { cn } from "@/lib/utils";

interface Props {
  card: KCard;
  onClick: () => void;
  isDragging?: boolean;
}

export function KanbanCard({ card, onClick, isDragging }: Props) {
  const { data: meta } = useQuery({
    queryKey: ["kanban-card-meta", card.id],
    queryFn: async () => {
      const [labels, checklistItems, comments, attachments, members] = await Promise.all([
        supabase.from("kanban_card_labels").select("kanban_labels(name,color)").eq("card_id", card.id),
        supabase.from("kanban_checklist_items").select("done, kanban_checklists!inner(card_id)").eq("kanban_checklists.card_id", card.id),
        supabase.from("kanban_comments").select("id", { count: "exact", head: true }).eq("card_id", card.id),
        supabase.from("kanban_attachments").select("id", { count: "exact", head: true }).eq("card_id", card.id),
        supabase.from("kanban_card_members").select("user_id, profiles!kanban_card_members_user_id_fkey(full_name)").eq("card_id", card.id),
      ]);
      const items = (checklistItems.data ?? []) as any[];
      return {
        labels: (labels.data ?? []).map((l: any) => l.kanban_labels).filter(Boolean),
        checklistTotal: items.length,
        checklistDone: items.filter((i) => i.done).length,
        comments: comments.count ?? 0,
        attachments: attachments.count ?? 0,
        members: (members.data ?? []) as any[],
      };
    },
  });

  const now = new Date();
  const overdue = card.due_date && new Date(card.due_date) < now && !card.completed_at;
  const suggested = getSuggested(card);

  // Mapeamento de cores para a faixa superior baseada na prioridade
  const stripColorMap: Record<string, string> = {
    baixa: "bg-emerald-500",
    media: "bg-blue-500",
    alta: "bg-amber-500",
    urgente: "bg-rose-500",
  };
  const stripColor = stripColorMap[card.priority] || "bg-slate-300";

  // Mapeamento de badges de status estilo CRM
  const getStatusBadge = () => {
    if (overdue) {
      return (
        <Badge className="bg-rose-500 text-white hover:bg-rose-600 border-none rounded-sm text-[10px] h-6 px-3">
          Atrasada
        </Badge>
      );
    }
    if (card.completed_at) {
      return (
        <Badge className="bg-emerald-500 text-white hover:bg-emerald-600 border-none rounded-sm text-[10px] h-6 px-3">
          Concluída
        </Badge>
      );
    }
    return (
      <Badge className="bg-emerald-500 text-white hover:bg-emerald-600 border-none rounded-sm text-[10px] h-6 px-3">
        Planejada
      </Badge>
    );
  };

  const formattedValue = (card.metadata as any)?.value 
    ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format((card.metadata as any).value)
    : "R$ 0,00";

  const ownerName = meta?.members?.[0]?.profiles?.full_name || "Não atribuído";
  const cardId = card.id.slice(0, 5).toUpperCase();

  return (
    <div
      onClick={onClick}
      className={cn(
        "cursor-pointer rounded-sm border-none bg-white p-4 text-sm shadow-sm transition hover:shadow-md",
        card.completed_at && "opacity-80",
        isDragging && "rotate-2 shadow-lg",
      )}
    >
      <div className="flex flex-col gap-3">
        {/* Title and dots */}
        <div className="flex items-start justify-between">
          <div className="font-semibold text-emerald-600 text-xs">
            {typeof (card.metadata as any)?.client_name === "string" 
              ? (card.metadata as any).client_name 
              : card.title}
          </div>
          <div className="text-slate-300 text-xs font-bold leading-none">...</div>
        </div>

        {/* Color Strip */}
        <div className={cn("h-[3px] w-full rounded-full", stripColor)} />

        {/* Responsible */}
        <div className="space-y-0.5">
          <div className="text-[10px] text-slate-400">Responsável: {ownerName}</div>
          <div className="h-[1px] w-full bg-slate-100" />
        </div>

        {/* Value and Date */}
        <div className="flex items-end justify-between">
          <div className="space-y-1">
            <div className="text-xs font-medium text-slate-500">{formattedValue}</div>
            <div className="text-[10px] text-slate-400"># {cardId}</div>
          </div>
          <div className="flex flex-col items-end gap-1">
            {card.due_date && (
              <div className="text-[9px] text-slate-400">
                Início {new Date(card.due_date).toLocaleDateString("pt-BR")}
              </div>
            )}
            {getStatusBadge()}
          </div>
        </div>
      </div>
    </div>
  );
}
