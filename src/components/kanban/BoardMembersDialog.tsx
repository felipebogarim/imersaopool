import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { X } from "lucide-react";
import { toast } from "sonner";
import type { Board, KanbanRole } from "@/lib/kanban-types";

interface Props {
  board: Board;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

export function BoardMembersDialog({ board, open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<KanbanRole>("member");
  const [inviting, setInviting] = useState(false);

  const { data: members = [] } = useQuery({
    queryKey: ["kanban-ws-members-list", board.workspace_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("kanban_workspace_members")
        .select("id, user_id, role")
        .eq("workspace_id", board.workspace_id);
      const rows = data ?? [];
      const byId = await fetchProfilesMap(rows.map((r: any) => r.user_id));
      return rows.map((r: any) => ({ ...r, profiles: byId[r.user_id] ?? null }));
    },
    enabled: open,
  });

  async function invite() {
    if (!email.trim()) return;
    setInviting(true);
    const { data: profile } = await supabase.from("profiles").select("id").eq("email", email.trim().toLowerCase()).maybeSingle();
    if (!profile) {
      setInviting(false);
      return toast.error("Usuário não encontrado. Ele precisa se cadastrar primeiro.");
    }
    const { error } = await supabase.from("kanban_workspace_members").insert({
      workspace_id: board.workspace_id, user_id: profile.id, role,
    });
    setInviting(false);
    if (error) return toast.error(error.message);
    toast.success("Membro adicionado");
    setEmail("");
    qc.invalidateQueries({ queryKey: ["kanban-ws-members-list", board.workspace_id] });
    qc.invalidateQueries({ queryKey: ["kanban-ws-members", board.workspace_id] });
  }

  async function updateRole(id: string, newRole: KanbanRole) {
    await supabase.from("kanban_workspace_members").update({ role: newRole }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["kanban-ws-members-list", board.workspace_id] });
  }

  async function remove(id: string) {
    if (!confirm("Remover este membro?")) return;
    await supabase.from("kanban_workspace_members").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["kanban-ws-members-list", board.workspace_id] });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Membros do workspace</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="flex gap-2">
            <Input placeholder="e-mail do usuário" value={email} onChange={(e) => setEmail(e.target.value)} />
            <Select value={role} onValueChange={(v) => setRole(v as KanbanRole)}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="member">Membro</SelectItem>
                <SelectItem value="observer">Observador</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={invite} disabled={inviting}>Convidar</Button>
          </div>
          <ul className="divide-y rounded-lg border">
            {members.map((m: any) => (
              <li key={m.id} className="flex items-center justify-between p-2">
                <div>
                  <div className="text-sm font-medium">{m.profiles?.full_name ?? "—"}</div>
                  <div className="text-xs text-muted-foreground">{m.profiles?.email}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Select value={m.role} onValueChange={(v) => updateRole(m.id, v as KanbanRole)}
                          disabled={m.role === "owner"}>
                    <SelectTrigger className="h-7 w-28 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="owner">Owner</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="member">Membro</SelectItem>
                      <SelectItem value="observer">Observador</SelectItem>
                    </SelectContent>
                  </Select>
                  {m.role !== "owner" && (
                    <button onClick={() => remove(m.id)}><X className="h-4 w-4 text-muted-foreground hover:text-destructive" /></button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </DialogContent>
    </Dialog>
  );
}
