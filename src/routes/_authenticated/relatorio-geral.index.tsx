import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/relatorio-geral/")({
  head: () => ({ meta: [{ title: "Relatório Geral | PoolFlux" }] }),
  component: RelatorioGeralList,
});

const STATUS: Record<string, string> = {
  rascunho: "Rascunho",
  gerando: "Gerando…",
  pronto: "Pronto",
  erro: "Erro",
};
const db = supabase as any;

function RelatorioGeralList() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [repId, setRepId] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);

  const { data: reps = [] } = useQuery({
    queryKey: ["reps-min"],
    queryFn: async () =>
      (await supabase.from("representatives").select("id, nome").order("nome")).data ?? [],
  });
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["general-reports"],
    queryFn: async () => {
      const { data, error } = await db
        .from("general_reports")
        .select("id, title, report_date, status, representative_id, representatives(nome)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  async function create() {
    if (!repId || !date) return toast.error("Informe o representante e a data.");
    setSaving(true);
    const { data, error } = await db
      .from("general_reports")
      .insert({ representative_id: repId, report_date: date })
      .select("id")
      .single();
    setSaving(false);
    if (error) return toast.error(error.message);
    setOpen(false);
    void qc.invalidateQueries({ queryKey: ["general-reports"] });
    void navigate({ to: "/relatorio-geral/$id", params: { id: data.id } });
  }

  async function remove(id: string) {
    if (!confirm("Excluir este relatório e seus arquivos?")) return;
    const { data: files } = await db
      .from("general_report_files")
      .select("storage_path")
      .eq("report_id", id);
    if (files?.length)
      await supabase.storage.from("general-reports").remove(files.map((f: any) => f.storage_path));
    const { error } = await db.from("general_reports").delete().eq("id", id);
    if (error) return toast.error(error.message);
    void qc.invalidateQueries({ queryKey: ["general-reports"] });
  }

  return (
    <div>
      <PageHeader
        title="Relatório Geral"
        subtitle="Envie planilhas, imagens, áudios, vídeos e apresentações — a IA lê tudo e monta o relatório."
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Novo relatório
          </Button>
        }
      />
      <div className="px-4 sm:px-8 py-6 space-y-2">
        {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
        {!isLoading && rows.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Nenhum relatório ainda. Clique em “Novo relatório”.
          </p>
        )}
        {rows.map((r) => (
          <div
            key={r.id}
            className="flex items-center gap-3 rounded-xl border border-border bg-card p-4"
          >
            <Link to="/relatorio-geral/$id" params={{ id: r.id }} className="flex-1 min-w-0">
              <div className="font-medium truncate">
                {r.title || `Relatório — ${r.representatives?.nome ?? "sem representante"}`}
              </div>
              <div className="text-xs text-muted-foreground">
                {r.representatives?.nome ?? "—"} ·{" "}
                {new Date(r.report_date + "T12:00:00").toLocaleDateString("pt-BR")}
              </div>
            </Link>
            <span className="text-xs rounded-full border border-border px-2 py-0.5">
              {STATUS[r.status] ?? r.status}
            </span>
            <Button variant="ghost" size="icon" onClick={() => remove(r.id)} aria-label="Excluir">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo relatório geral</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Representante *</Label>
              <Select value={repId} onValueChange={setRepId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {reps.map((r: any) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Data *</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={create} disabled={saving}>
              {saving ? "Criando…" : "Criar e anexar arquivos"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
