import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

/** Repositório de notas de um bloco de análise. */
export function BlocoNotasDialog({
  blocoKey,
  titulo,
  open,
  onOpenChange,
}: {
  blocoKey: string;
  titulo: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const qc = useQueryClient();
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const key = ["bloco-notes", blocoKey];

  const { data: notes = [] } = useQuery({
    queryKey: key,
    enabled: open,
    queryFn: async () =>
      (
        await supabase
          .from("bloco_notes")
          .select("id, content, author_id, author_name, created_at")
          .eq("bloco_key", blocoKey)
          .order("created_at", { ascending: false })
      ).data ?? [],
  });

  async function add() {
    if (!content.trim()) return;
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    const meta = (u.user?.user_metadata ?? {}) as any;
    const authorName = meta.full_name || meta.name || u.user?.email || "—";
    const { error } = await supabase.from("bloco_notes").insert({
      bloco_key: blocoKey,
      author_id: u.user!.id,
      author_name: authorName,
      content: content.trim(),
    } as never);
    setSaving(false);
    if (error) return toast.error(error.message);
    setContent("");
    qc.invalidateQueries({ queryKey: key });
    toast.success("Nota salva");
  }

  async function remove(id: string) {
    const { error } = await supabase.from("bloco_notes").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: key });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Notas · {titulo}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder="Escreva uma nota sobre este bloco..."
            rows={3}
          />
          <div className="flex justify-end">
            <Button size="sm" onClick={add} disabled={saving || !content.trim()}>
              Adicionar nota
            </Button>
          </div>
          <div className="max-h-72 space-y-2 overflow-y-auto">
            {notes.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma nota ainda.</p>}
            {notes.map((n: any) => (
              <div key={n.id} className="rounded-lg border p-3">
                <div className="flex items-start gap-2">
                  <p className="flex-1 whitespace-pre-wrap text-sm">{n.content}</p>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => remove(n.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {n.author_name ?? "—"} · {new Date(n.created_at).toLocaleString("pt-BR")}
                </p>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
