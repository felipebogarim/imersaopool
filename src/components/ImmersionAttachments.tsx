import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, Paperclip, Trash2, Download, Upload } from "lucide-react";
import { toast } from "sonner";

const BUCKET = "imersoes-anexos";

export function ImmersionAttachments({ immersionId }: { immersionId: string }) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const { data: files = [] } = useQuery({
    queryKey: ["attachments", immersionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attachments")
        .select("*")
        .eq("entity_type", "immersion")
        .eq("entity_id", immersionId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  async function upload(file: File) {
    if (file.size > 50 * 1024 * 1024) return toast.error("Arquivo maior que 50MB");
    setUploading(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const path = `${immersionId}/${Date.now()}-${file.name.replace(/[^\w.\-]/g, "_")}`;
      const up = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type });
      if (up.error) throw up.error;
      const ins = await supabase.from("attachments").insert({
        entity_type: "immersion",
        entity_id: immersionId,
        storage_path: path,
        file_name: file.name,
        mime_type: file.type,
        size_bytes: file.size,
        uploaded_by: u.user?.id,
      });
      if (ins.error) throw ins.error;
      toast.success("Arquivo enviado");
      qc.invalidateQueries({ queryKey: ["attachments", immersionId] });
    } catch (e: any) {
      toast.error(e?.message ?? "Falha no upload");
    } finally {
      setUploading(false);
    }
  }

  async function download(path: string, name: string) {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60);
    if (error) return toast.error(error.message);
    const a = document.createElement("a");
    a.href = data.signedUrl; a.download = name; a.click();
  }

  async function remove(id: string, path: string) {
    if (!confirm("Excluir arquivo?")) return;
    await supabase.storage.from(BUCKET).remove([path]);
    const { error } = await supabase.from("attachments").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["attachments", immersionId] });
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        <input
          ref={fileRef}
          type="file"
          className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }}
        />
        <Button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}>
          {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
          Enviar arquivo
        </Button>
        <PickerBtn accept="image/*" label="Foto" onPick={upload} disabled={uploading} />
        <PickerBtn accept="video/*" label="Vídeo" onPick={upload} disabled={uploading} />
        <PickerBtn accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.md,.markdown" label="Documento" onPick={upload} disabled={uploading} />
      </div>

      {files.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum arquivo enviado ainda.</p>
      ) : (
        <ul className="divide-y border border-border rounded-lg">
          {files.map(f => (
            <li key={f.id} className="flex items-center gap-3 p-3">
              <Paperclip className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{f.file_name}</div>
                <div className="text-xs text-muted-foreground">
                  {f.size_bytes ? `${(f.size_bytes / 1024).toFixed(1)} KB` : ""} · {new Date(f.created_at).toLocaleString("pt-BR")}
                </div>
              </div>
              <Button size="icon" variant="ghost" onClick={() => download(f.storage_path, f.file_name)} title="Baixar">
                <Download className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="ghost" onClick={() => remove(f.id, f.storage_path)} title="Excluir">
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PickerBtn({ accept, label, onPick, disabled }: { accept: string; label: string; onPick: (f: File) => void; disabled?: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <input ref={ref} type="file" accept={accept} className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) onPick(f); e.target.value = ""; }} />
      <Button type="button" variant="outline" onClick={() => ref.current?.click()} disabled={disabled}>
        <Upload className="h-4 w-4 mr-2" /> {label}
      </Button>
    </>
  );
}
