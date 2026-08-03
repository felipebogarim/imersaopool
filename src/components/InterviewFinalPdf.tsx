import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { FileText, Loader2, Trash2, Upload, ExternalLink } from "lucide-react";
import { toast } from "sonner";

const BUCKET = "entrevistas-anexos";

/** Incorpora o PDF final da entrevista e permite abri-lo em nova janela. */
export function InterviewFinalPdf({ interviewId }: { interviewId: string }) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const queryKey = ["interview-pdf", interviewId];

  const { data: files = [] } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attachments")
        .select("*")
        .eq("entity_type", "interview")
        .eq("entity_id", interviewId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  async function upload(file: File) {
    if (!/pdf$/i.test(file.type) && !/\.pdf$/i.test(file.name)) {
      return toast.error("Envie um arquivo PDF");
    }
    if (file.size > 50 * 1024 * 1024) return toast.error("Arquivo maior que 50MB");
    setUploading(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const path = `${interviewId}/${Date.now()}-${file.name.replace(/[^\w.\-]/g, "_")}`;
      const up = await supabase.storage.from(BUCKET).upload(path, file, { contentType: "application/pdf" });
      if (up.error) throw up.error;
      const ins = await supabase.from("attachments").insert({
        entity_type: "interview",
        entity_id: interviewId,
        storage_path: path,
        file_name: file.name,
        mime_type: "application/pdf",
        size_bytes: file.size,
        uploaded_by: u.user?.id,
      } as any);
      if (ins.error) throw ins.error;
      toast.success("PDF incorporado");
      qc.invalidateQueries({ queryKey });
    } catch (e: any) {
      toast.error(e?.message ?? "Falha no upload");
    } finally {
      setUploading(false);
    }
  }

  async function abrir(path: string) {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 30);
    if (error || !data) return toast.error(error?.message ?? "Não foi possível abrir o PDF");
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  async function remove(id: string, path: string) {
    if (!confirm("Excluir este PDF?")) return;
    await supabase.storage.from(BUCKET).remove([path]);
    const { error } = await supabase.from("attachments").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey });
  }

  return (
    <section className="surface rounded-xl p-5 space-y-4">
      <div>
        <h2 className="font-semibold flex items-center gap-2">
          <FileText className="h-4 w-4 text-cyan" /> Resultado final em PDF
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          Incorpore o PDF final da entrevista e abra a leitura em uma nova janela.
        </p>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }}
      />
      <Button type="button" className="w-full" onClick={() => fileRef.current?.click()} disabled={uploading}>
        {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
        Incorporar resultado final (PDF)
      </Button>

      {files.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum PDF incorporado ainda.</p>
      ) : (
        <ul className="space-y-2">
          {files.map((f: any) => (
            <li key={f.id} className="rounded-lg border border-border p-3 space-y-2">
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{f.file_name}</div>
                <div className="text-xs text-muted-foreground">
                  {f.size_bytes ? `${(f.size_bytes / 1024).toFixed(0)} KB · ` : ""}
                  {new Date(f.created_at).toLocaleString("pt-BR")}
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="flex-1" onClick={() => abrir(f.storage_path)}>
                  <ExternalLink className="h-3.5 w-3.5 mr-1" /> Visualizar PDF
                </Button>
                <Button size="sm" variant="ghost" onClick={() => remove(f.id, f.storage_path)} title="Excluir">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
