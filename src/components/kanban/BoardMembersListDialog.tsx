import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MoreHorizontal, User, Mail, MessageSquare, Download, Layout } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Board, KCard, KList } from "@/lib/kanban-types";
import { exportMemberActionsPdf, shareOnWhatsApp, shareViaEmail } from "@/lib/kanban-member-pdf";
import { useState } from "react";
import { MemberActionsPanel } from "./MemberActionsPanel";

interface Props {
  board: Board;
  lists: KList[];
  cards: KCard[];
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

interface Member {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  type: "profile" | "representative";
}

export function BoardMembersListDialog({ board, lists, cards, open, onOpenChange }: Props) {
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);

  // Derivar membros dos cards do board
  const members = useMemo(() => {
    const map = new Map<string, Member>();

    // 1. Membros vinculados via kanban_card_members (Perfis)
    // Para simplificar, vamos buscar os nomes dos membros associados aos cards deste board
    // Idealmente faríamos um join, mas para o MVP vamos usar o que temos nos cards e metadados
    
    cards.forEach(card => {
      const meta = (card.metadata || {}) as any;
      
      // Representante vinculado
      if (meta.rep_id && meta.rep_name) {
        map.set(`rep-${meta.rep_id}`, {
          id: meta.rep_id,
          name: meta.rep_name,
          type: "representative"
        });
      }

      // Responsável vinculado (perfil)
      if (meta.responsible_id && meta.responsible_name) {
        map.set(`prof-${meta.responsible_id}`, {
          id: meta.responsible_id,
          name: meta.responsible_name,
          type: "profile"
        });
      }
    });

    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [cards]);

  const handleDownloadPdf = (member: Member) => {
    const memberCards = cards.filter(c => {
      const meta = (c.metadata || {}) as any;
      return meta.rep_id === member.id || meta.responsible_id === member.id;
    });
    exportMemberActionsPdf(member, board.name, memberCards, lists);
  };

  const handleShareWhatsApp = (member: Member) => {
    // Busca telefone se for representante, ou placeholder
    shareOnWhatsApp("", member.name, board.name);
  };

  const handleShareEmail = (member: Member) => {
    shareViaEmail(member.email || "", member.name, board.name);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Membros vinculados às ações</DialogTitle>
          </DialogHeader>
          
          <div className="mt-4 space-y-2">
            {members.length === 0 ? (
              <p className="text-center py-8 text-sm text-muted-foreground">
                Nenhum membro vinculado a cards neste board.
              </p>
            ) : (
              members.map((member) => (
                <div 
                  key={`${member.type}-${member.id}`}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/5 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                      <User className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-sm font-medium">{member.name}</div>
                      <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
                        {member.type === "representative" ? "Representante" : "Usuário"}
                      </div>
                    </div>
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setSelectedMember(member)}>
                        <Layout className="h-4 w-4 mr-2" /> Painél de Ações
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleShareWhatsApp(member)}>
                        <MessageSquare className="h-4 w-4 mr-2" /> Compartilhar (WhatsApp)
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleShareEmail(member)}>
                        <Mail className="h-4 w-4 mr-2" /> Compartilhar (E-mail)
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDownloadPdf(member)}>
                        <Download className="h-4 w-4 mr-2" /> Baixar PDF
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {selectedMember && (
        <MemberActionsPanel
          member={selectedMember}
          boardName={board.name}
          cards={cards.filter(c => {
            const meta = (c.metadata || {}) as any;
            return meta.rep_id === selectedMember.id || meta.responsible_id === selectedMember.id;
          })}
          lists={lists}
          open={!!selectedMember}
          onOpenChange={(o) => !o && setSelectedMember(null)}
        />
      )}
    </>
  );
}

import { useMemo } from "react";
