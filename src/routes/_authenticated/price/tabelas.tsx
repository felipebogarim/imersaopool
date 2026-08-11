import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Upload, FileSpreadsheet, MoreVertical, Download, Trash2, RefreshCw } from "lucide-react";
import { useState, useRef } from "react";
import { toast } from "sonner";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/price/tabelas")({
  head: () => ({
    meta: [
      { title: "Tabelas de Preços | Price" },
      { name: "description", content: "Upload e gestão de tabelas de preços vinculadas a competidores." },
    ],
  }),
  component: TabelasPage,
});

const CATEGORIAS = [
  { value: "normal", label: "Normal" },
  { value: "atacado", label: "Atacado" },
  { value: "promocional", label: "Promocional" },
  { value: "outra", label: "Outra" },
] as const;

type FormState = {
  titulo: string;
  competitor_id: string;
  categoria: "normal" | "atacado" | "promocional" | "outra";
  categoria_outra: string;
  data_referencia: string;
  observacoes: string;
  file: File | null;
};

const emptyForm: FormState = {
  titulo: "",
  competitor_id: "",
  categoria: "normal",
  categoria_outra: "",
  data_referencia: new Date().toISOString().slice(0, 10),
  observacoes: "",
  file: null,
};

function TabelasPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [replaceTargetId, setReplaceTargetId] = useState<string | null>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);

  const { data: competitors = [] } = useQuery({
    queryKey: ["price-competitors"],
    queryFn: async () =>
      (await supabase.from("price_competitors").select("id,nome").order("nome")).data ?? [],
  });

  const { data: tabelas = [], isLoading } = useQuery({
    queryKey: ["price-tables"],
    queryFn: async () =>
      (await supabase
        .from("price_tables")
        .select("*, competitor:price_competitors(id,nome)")
        .order("data_referencia", { ascending: false })
        .order("created_at", { ascending: false })).data ?? [],
  });

  async function uploadFile(file: File): Promise<{ path: string; name: string; size: number; mime: string }> {
    const ext = file.name.split(".").pop() ?? "bin";
    const path = `${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("price-tables").upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || undefined,
    });
    if (error) throw error;
    return { path, name: file.name, size: file.size, mime: file.type || "application/octet-stream" };
  }

  async function save() {
    if (!form.titulo.trim()) return toast.error("Título obrigatório");
    if (!form.competitor_id) return toast.error("Escolha o competidor");
    if (form.categoria === "outra" && !form.categoria_outra.trim())
      return toast.error("Descreva a categoria 'outra'");

    setSaving(true);
    try {
      let file_path: string | null = null;
      let file_name: string | null = null;
      let file_size: number | null = null;
      let file_mime: string | null = null;
      if (form.file) {
        const up = await uploadFile(form.file);
        file_path = up.path;
        file_name = up.name;
        file_size = up.size;
        file_mime = up.mime;
      }
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("price_tables").insert({
        titulo: form.titulo,
        competitor_id: form.competitor_id,
        categoria: form.categoria,
        categoria_outra: form.categoria === "outra" ? form.categoria_outra : null,
        data_referencia: form.data_referencia,
        observacoes: form.observacoes || null,
        file_path,
        file_name,
        file_size,
        file_mime,
        created_by: user?.id,
      } as any);
      if (error) throw error;
      toast.success("Tabela registrada");
      setForm(emptyForm);
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["price-tables"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao salvar");
    } finally {
      setSaving(false);
    }
  }

  async function downloadFile(row: any) {
    if (!row.file_path) return toast.error("Sem arquivo anexado");
    const { data, error } = await supabase.storage.from("price-tables").createSignedUrl(row.file_path, 60);
    if (error || !data) return toast.error(error?.message ?? "Falha ao gerar link");
    window.open(data.signedUrl, "_blank");
  }

  async function removeRow(row: any) {
    if (!confirm(`Excluir a tabela "${row.titulo}"?`)) return;
    if (row.file_path) {
      await supabase.storage.from("price-tables").remove([row.file_path]);
    }
    const { error } = await supabase.from("price_tables").delete().eq("id", row.id);
    if (error) return toast.error(error.message);
    toast.success("Tabela removida");
    qc.invalidateQueries({ queryKey: ["price-tables"] });
  }

  function triggerReplace(rowId: string) {
    setReplaceTargetId(rowId);
    replaceInputRef.current?.click();
  }

  async function onReplaceChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !replaceTargetId) return;
    const row = tabelas.find((r: any) => r.id === replaceTargetId);
    if (!row) return;
    try {
      const up = await uploadFile(file);
      const oldPath = row.file_path;
      const { error } = await supabase
        .from("price_tables")
        .update({
          file_path: up.path,
          file_name: up.name,
          file_size: up.size,
          file_mime: up.mime,
          data_referencia: new Date().toISOString().slice(0, 10),
        })
        .eq("id", row.id);
      if (error) throw error;
      if (oldPath) await supabase.storage.from("price-tables").remove([oldPath]);
      toast.success("Tabela atualizada");
      qc.invalidateQueries({ queryKey: ["price-tables"] });
    } catch (err: any) {
      toast.error(err?.message ?? "Falha ao substituir arquivo");
    } finally {
      setReplaceTargetId(null);
    }
  }

  function categoriaLabel(row: any) {
    if (row.categoria === "outra") return row.categoria_outra || "Outra";
    return CATEGORIAS.find((c) => c.value === row.categoria)?.label ?? row.categoria;
  }

  return (
    <div className="space-y-4">
      <input ref={replaceInputRef} type="file" className="hidden" onChange={onReplaceChosen} />

      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <FileSpreadsheet className="h-4 w-4" />
          {tabelas.length} tabela{tabelas.length === 1 ? "" : "s"} registrada{tabelas.length === 1 ? "" : "s"}
        </div>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setForm(emptyForm); }}>
          <DialogTrigger asChild>
            <Button>
              <Upload className="h-4 w-4 mr-1" /> Carregar tabela
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Nova tabela de preços</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Título *</Label>
                <Input value={form.titulo} onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))} placeholder="Ex.: Tabela Distribuidor A - Nov/26" />
              </div>
              <div>
                <Label>Competidor *</Label>
                <Select value={form.competitor_id} onValueChange={(v) => setForm((f) => ({ ...f, competitor_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {competitors.map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                    ))}
                    {competitors.length === 0 && (
                      <div className="px-3 py-2 text-xs text-muted-foreground">
                        Cadastre um competidor primeiro.
                      </div>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Categoria *</Label>
                  <Select value={form.categoria} onValueChange={(v: any) => setForm((f) => ({ ...f, categoria: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CATEGORIAS.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Data de referência *</Label>
                  <Input type="date" value={form.data_referencia} onChange={(e) => setForm((f) => ({ ...f, data_referencia: e.target.value }))} />
                </div>
              </div>
              {form.categoria === "outra" && (
                <div>
                  <Label>Descreva a categoria *</Label>
                  <Input value={form.categoria_outra} onChange={(e) => setForm((f) => ({ ...f, categoria_outra: e.target.value }))} />
                </div>
              )}
              <div>
                <Label>Arquivo (xlsx, pdf, csv...)</Label>
                <Input type="file" onChange={(e) => setForm((f) => ({ ...f, file: e.target.files?.[0] ?? null }))} />
              </div>
              <div>
                <Label>Observações</Label>
                <Textarea value={form.observacoes} onChange={(e) => setForm((f) => ({ ...f, observacoes: e.target.value }))} />
              </div>
              <Button onClick={save} className="w-full" disabled={saving}>
                {saving ? "Salvando..." : "Registrar tabela"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="surface rounded-xl overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-3">Título</th>
              <th className="text-left px-4 py-3">Competidor</th>
              <th className="text-left px-4 py-3">Categoria</th>
              <th className="text-left px-4 py-3">Data</th>
              <th className="text-left px-4 py-3">Arquivo</th>
              <th className="text-right px-4 py-3">Ações</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">Carregando...</td></tr>
            ) : tabelas.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">Nenhuma tabela registrada ainda.</td></tr>
            ) : (
              tabelas.map((row: any) => (
                <tr key={row.id} className="border-t border-border">
                  <td className="px-4 py-3 font-medium">{row.titulo}</td>
                  <td className="px-4 py-3 text-muted-foreground">{row.competitor?.nome ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{categoriaLabel(row)}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {row.data_referencia ? format(new Date(row.data_referencia + "T00:00:00"), "dd/MM/yyyy") : "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs max-w-[260px] truncate">
                    {row.file_name ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem disabled={!row.file_path} onClick={() => downloadFile(row)}>
                          <Download className="h-4 w-4 mr-2" /> Baixar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => triggerReplace(row.id)}>
                          <RefreshCw className="h-4 w-4 mr-2" /> Atualizar (novo arquivo)
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive" onClick={() => removeRow(row)}>
                          <Trash2 className="h-4 w-4 mr-2" /> Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
