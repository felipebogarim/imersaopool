import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export function GerarTarefaDialog({
  tarefa,
  onClose,
}: {
  tarefa: { title: string; description: string } | null;
  onClose: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [listId, setListId] = useState<string>("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (tarefa) {
      setTitle(tarefa.title);
      setDescription(tarefa.description);
    }
  }, [tarefa]);

  const { data: listas = [] } = useQuery({
    queryKey: ["kanban-listas-sintese"],
    enabled: !!tarefa,
    queryFn: async () => {
      const { data: boards } = await supabase
        .from("kanban_boards")
        .select("id, title")
        .order("created_at", { ascending: true });
      const ids = (boards ?? []).map(b => b.id);
      if (!ids.length) return [];
      const { data: lists } = await supabase
        .from("kanban_lists")
        .select("id, title, board_id, position")
        .in("board_id", ids)
        .order("position", { ascending: true });
      return (lists ?? []).map(l => ({
        ...l,
        boardTitle: boards?.find(b => b.id === l.board_id)?.title ?? "Quadro",
      }));
    },
  });

  useEffect(() => {
    if (!listId && listas.length) setListId(listas[0].id);
  }, [listas, listId]);

  async function criar() {
    if (!listId) return toast.error("Selecione uma lista do Kanban.");
    setBusy(true);
    try {
      const lista: any = listas.find((l: any) => l.id === listId);
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("kanban_cards").insert({
        board_id: lista.board_id,
        list_id: listId,
        title: title.slice(0, 200),
        description,
        position: Date.now(),
        created_by: u.user?.id ?? null,
      } as never);
      if (error) throw error;
      toast.success("Tarefa criada no Kanban.");
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao criar tarefa.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={!!tarefa} onOpenChange={v => !v && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Gerar tarefa no Kanban</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Título</Label><Input value={title} onChange={e => setTitle(e.target.value)} /></div>
          <div><Label>Descrição</Label><Textarea rows={5} value={description} onChange={e => setDescription(e.target.value)} /></div>
          <div>
            <Label>Lista de destino</Label>
            <Select value={listId} onValueChange={setListId}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {listas.map((l: any) => (
                  <SelectItem key={l.id} value={l.id}>{l.boardTitle} · {l.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancelar</Button>
          <Button onClick={criar} disabled={busy}>Criar tarefa</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
