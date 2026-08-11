import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Calendar, MessageSquare, CheckSquare, Paperclip, Building2, Sparkles } from "lucide-react";
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

  return (
    <div
      onClick={onClick}
      className={cn(
        "cursor-pointer rounded-md border bg-background p-2.5 text-sm shadow-sm transition hover:shadow-md",
        card.completed_at && "opacity-60",
        isDragging && "rotate-2",
      )}
    >
      {card.cover_color && <div className="mb-2 h-2 w-full rounded" style={{ background: card.cover_color }} />}
      {meta?.labels && meta.labels.length > 0 && (
        <div className="mb-1.5 flex flex-wrap gap-1">
          {meta.labels.map((l: any, i: number) => (
            <span key={i} className="h-1.5 w-8 rounded-full" style={{ background: l.color }} title={l.name} />
          ))}
        </div>
      )}
      <div className="font-medium leading-snug">{card.title}</div>
      {suggested.suggested && (
        <Badge variant="outline" className={cn("mt-1.5 gap-1 text-[10px]", SUGGESTED_COLOR[suggested.status])}>
          <Sparkles className="h-3 w-3" /> {SUGGESTED_LABEL[suggested.status]}
        </Badge>
      )}
      {typeof (card.metadata as any)?.client_name === "string" && (
        <Badge variant="secondary" className="mt-1.5 max-w-full truncate text-[10px]">
          <Building2 className="mr-1 h-3 w-3 shrink-0" />
          {(card.metadata as any).client_name}
        </Badge>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Badge variant="outline" className={cn("h-5 px-1.5 text-[10px]", PRIORITY_COLOR[card.priority])}>
          {PRIORITY_LABEL[card.priority]}
        </Badge>
        {card.due_date && (
          <span className={cn("flex items-center gap-1", overdue && "font-medium text-red-600")}>
            <Calendar className="h-3 w-3" />
            {new Date(card.due_date).toLocaleDateString("pt-BR")}
          </span>
        )}
        {(meta?.checklistTotal ?? 0) > 0 && (
          <span className="flex items-center gap-0.5">
            <CheckSquare className="h-3 w-3" /> {meta!.checklistDone}/{meta!.checklistTotal}
          </span>
        )}
        {(meta?.comments ?? 0) > 0 && (
          <span className="flex items-center gap-0.5"><MessageSquare className="h-3 w-3" /> {meta!.comments}</span>
        )}
        {(meta?.attachments ?? 0) > 0 && (
          <span className="flex items-center gap-0.5"><Paperclip className="h-3 w-3" /> {meta!.attachments}</span>
        )}
      </div>
      {meta?.members && meta.members.length > 0 && (
        <div className="mt-2 flex -space-x-1">
          {meta.members.slice(0, 4).map((m: any) => (
            <div key={m.user_id} className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-background bg-primary/20 text-[10px] font-medium">
              {(m.profiles?.full_name ?? "?").split(" ").map((n: string) => n[0]).slice(0, 2).join("")}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
