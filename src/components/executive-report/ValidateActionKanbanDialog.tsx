import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ExecutiveAction } from "@/lib/executive-report/types";

type Props = {
  action: ExecutiveAction | null;
  client?: { id: string; name: string } | null;
  representative?: { id: string; name: string } | null;
  onClose: () => void;
  onCreated: (action: ExecutiveAction) => Promise<void> | void;
};

export function ValidateActionKanbanDialog({
  action,
  client,
  representative,
  onClose,
  onCreated,
}: Props) {
  const [boardId, setBoardId] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: workspaces = [] } = useQuery({
    queryKey: ["kanban-workspaces-min"],
    enabled: !!action,
    queryFn: async () =>
      (
        await supabase
          .from("kanban_workspaces")
          .select("id,name")
          .is("archived_at", null)
          .order("created_at")
      ).data ?? [],
  });

  const { data: boards = [] } = useQuery({
    queryKey: ["kanban-boards-min"],
    enabled: !!action,
    queryFn: async () =>
      (
        await supabase
          .from("kanban_boards")
          .select("id,name,workspace_id")
          .is("archived_at", null)
          .order("position")
      ).data ?? [],
  });

  async function confirm() {
    if (!action || !boardId) return toast.error("Escolha um board.");
    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error("Usuário não autenticado.");

      const { data: initialLists, error: listsError } = await supabase
        .from("kanban_lists")
        .select("id,position")
        .eq("board_id", boardId)
        .is("archived_at", null)
        .order("position")
        .limit(1);
      if (listsError) throw listsError;
      let lists = initialLists;
      if (!lists?.length) {
        const { data, error } = await supabase
          .from("kanban_lists")
          .insert({ board_id: boardId, name: "A fazer", position: 1000 })
          .select("id,position");
        if (error) throw error;
        lists = data;
      }

      const metadata: Record<string, string> = {
        source: "executive_report_action",
        executive_action_id: action.row_id ?? action.id,
      };
      if (client) {
        metadata.client_id = client.id;
        metadata.client_name = client.name;
      }
      if (representative) {
        metadata.rep_id = representative.id;
        metadata.rep_name = representative.name;
      }

      const priority =
        action.priority === "high" ? "alta" : action.priority === "low" ? "baixa" : "media";
      const { error: cardError } = await supabase.from("kanban_cards").insert({
        board_id: boardId,
        list_id: lists![0].id,
        title: action.title.slice(0, 200),
        description: action.description ?? null,
        position: Date.now(),
        priority,
        due_date: action.due_date ?? null,
        created_by: userId,
        metadata,
      });
      if (cardError) throw cardError;

      await onCreated(action);
      toast.success("Ação validada e adicionada à Gestão de Tarefas.");
      setBoardId("");
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível criar o card.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={!!action} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Validar ação e criar card</DialogTitle>
        </DialogHeader>
        {action && (
          <div className="space-y-4">
            <div className="rounded-md bg-muted/40 p-3">
              <p className="text-sm font-medium">{action.title}</p>
              {action.description && (
                <p className="mt-1 text-xs text-muted-foreground">{action.description}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Board de destino</Label>
              <Select value={boardId} onValueChange={setBoardId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um board" />
                </SelectTrigger>
                <SelectContent>
                  {boards.map((board) => {
                    const workspace = workspaces.find((item) => item.id === board.workspace_id);
                    return (
                      <SelectItem key={board.id} value={board.id}>
                        {workspace?.name ? `${workspace.name} / ` : ""}
                        {board.name}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => void confirm()} disabled={saving || !boardId}>
            {saving ? "Salvando…" : "Validar e criar card"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
