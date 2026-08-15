import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { KCard, KList, PRIORITY_LABEL, PRIORITY_COLOR } from "@/lib/kanban-types";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props {
  member: { name: string; type: string };
  boardName: string;
  cards: KCard[];
  lists: KList[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MemberActionsPanel({ member, boardName, cards, lists, open, onOpenChange }: Props) {
  const activeCards = cards.filter(c => !c.archived_at);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-2 border-b">
          <div className="flex flex-col gap-1">
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              Painél de Ações: {member.name}
              <Badge variant="outline" className="text-[10px] uppercase font-normal">
                {member.type === "representative" ? "Representante" : "Usuário"}
              </Badge>
            </DialogTitle>
            <p className="text-sm text-muted-foreground">
              Board: {boardName} · {activeCards.length} ações vinculadas
            </p>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="p-6">
              {activeCards.length === 0 ? (
                <div className="text-center py-20 text-muted-foreground italic">
                  Nenhuma ação vinculada a este membro no momento.
                </div>
              ) : (
                <div className="space-y-4">
                  {lists.map(list => {
                    const listCards = activeCards.filter(c => c.list_id === list.id);
                    if (listCards.length === 0) return null;

                    return (
                      <div key={list.id} className="space-y-3">
                        <div className="flex items-center gap-2">
                          <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                            {list.name}
                          </h3>
                          <div className="h-px flex-1 bg-border" />
                          <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                            {listCards.length}
                          </Badge>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {listCards.map(card => (
                            <div 
                              key={card.id} 
                              className={cn(
                                "p-3 rounded-lg border bg-card transition-all",
                                card.completed_at ? "opacity-60 grayscale-[0.5]" : "shadow-sm"
                              )}
                            >
                              <div className="flex justify-between items-start mb-2">
                                <Badge className={cn("text-[9px] px-1.5 h-4 uppercase", PRIORITY_COLOR[card.priority])}>
                                  {PRIORITY_LABEL[card.priority]}
                                </Badge>
                                {card.due_date && (
                                  <span className="text-[10px] text-muted-foreground">
                                    {format(new Date(card.due_date), "dd/MM/yy", { locale: ptBR })}
                                  </span>
                                )}
                              </div>
                              <h4 className="text-sm font-medium leading-tight mb-2">
                                {card.title}
                              </h4>
                              {card.completed_at && (
                                <div className="mt-2 flex items-center gap-1.5 text-[10px] text-emerald-600 font-medium">
                                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                  Concluído em {format(new Date(card.completed_at), "dd/MM/yy", { locale: ptBR })}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
