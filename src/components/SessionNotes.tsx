import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { NotebookPen, Trash2 } from "lucide-react";
import { toast } from "sonner";

export function SessionNotes({
  entityType,
  entityId,
}: {
  entityType: "interview" | "immersion";
  entityId: string;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);

  const key = ["session-notes", entityType, entityId];
  const { data: notes = [] } = useQuery({
    queryKey: key,
    queryFn: async () =>
      (
        await supabase
          .from("session_notes")
          .select("id, content, author_id, author_name, created_at")
          .eq("entity_type", entityType)
          .eq("entity_id", entityId)
          .order("created_at", { ascending: false })
      ).data ?? [],
    enabled: open,
  });

  async function add() {
    if (!content.trim()) return;
    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    const authorName =
      (userData.user?.user_metadata as any)?.full_name ||
      (userData.user?.user_metadata as any)?.name ||
      userData.user?.email ||
      "—";
    const { error } = await supabase.from("session_notes").insert({
      entity_type: entityType,
      entity_id: entityId,
      author_id: userData.user!.id,
      author_name: authorName,
      content: content.trim(),
    } as any);
    setSaving(false);
    if (error) return toast.error(error.message);
    setContent("");
    qc.invalidateQueries({ queryKey: key });
    toast.success("Anotação salva");
  }

  async function remove(id: string) {
    const { error } = await supabase.from("session_notes").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: key });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <NotebookPen className="h-4 w-4 mr-1" /> Anotações
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Caderno de anotações</DialogTitle>
        </DialogHeader>

        <div className="space-y-2">
          <Textarea
            rows={3}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Escreva uma anotação rápida (será salva com data, hora e autor)"
          />
          <div className="flex justify-end">
            <Button size="sm" onClick={add} disabled={saving || !content.trim()}>
              {saving ? "Salvando..." : "Adicionar anotação"}
            </Button>
          </div>
        </div>

        <div className="mt-2 max-h-[50vh] overflow-y-auto space-y-2 pr-1">
          {notes.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Sem anotações ainda.</p>
          ) : (
            notes.map((n: any) => (
              <div key={n.id} className="border rounded-lg p-3">
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                  <span>
                    {n.author_name ?? "—"} •{" "}
                    {new Date(n.created_at).toLocaleString("pt-BR")}
                  </span>
                  <Button size="icon" variant="ghost" onClick={() => remove(n.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <p className="text-sm whitespace-pre-wrap">{n.content}</p>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
