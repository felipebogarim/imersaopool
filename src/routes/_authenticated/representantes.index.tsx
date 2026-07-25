import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { VoiceInput, VoiceTextarea } from "@/components/VoiceInput";
import { LabelHelp } from "@/components/FieldHelp";
import { REP_HELP } from "@/lib/field-help-texts";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { EntityKebab } from "@/components/EntityKebab";
import { Plus, Pencil } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/representantes/")({
  head: () => ({ meta: [{ title: "Representantes — PoolFlux" }] }),
  component: RepsPage,
});

function RepsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const { data: reps = [] } = useQuery({
    queryKey: ["reps-list"],
    queryFn: async () => (await supabase.from("representatives").select("*").order("nome")).data ?? [],
  });

  function openNew() { setEditing(null); setForm({}); setOpen(true); }
  function openEdit(r: any) {
    setEditing(r);
    setForm({ nome: r.nome ?? "", representacao: r.representacao ?? "", email: r.email ?? "", telefone: r.telefone ?? "", regiao: r.regiao ?? "", outras_marcas: r.outras_marcas ?? "", observacoes: r.observacoes ?? "" });
    setOpen(true);
  }

  async function save() {
    if (!form.nome) return toast.error("Nome obrigatório");
    if (editing) {
      const { error } = await supabase.from("representatives").update(form as any).eq("id", editing.id);
      if (error) return toast.error(error.message);
      toast.success("Representante atualizado");
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("representatives").insert({ ...form, created_by: user?.id } as any);
      if (error) return toast.error(error.message);
      toast.success("Representante cadastrado");
    }
    setForm({}); setEditing(null); setOpen(false);
    qc.invalidateQueries({ queryKey: ["reps-list"] });
  }
  async function remove(r: any) {
    if (!confirm(`Excluir representante "${r.nome}"?`)) return;
    const { error } = await supabase.from("representatives").delete().eq("id", r.id);
    if (error) return toast.error(error.message);
    toast.success("Representante excluído");
    qc.invalidateQueries({ queryKey: ["reps-list"] });
  }


  return (
    <div>
      <PageHeader title="Representantes" subtitle="Cadastro dos representantes comerciais"
        actions={<Button onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Novo</Button>}
      />
      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setEditing(null); setForm({}); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Editar representante" : "Novo representante"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><LabelHelp label="Nome" required help={REP_HELP.nome} /><VoiceInput value={form.nome ?? ""} onChange={v => setForm(f => ({ ...f, nome: v }))} /></div>
            <div><LabelHelp label="Representação" help="Razão social da representação (empresa)" /><VoiceInput value={form.representacao ?? ""} onChange={v => setForm(f => ({ ...f, representacao: v }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><LabelHelp label="E-mail" help={REP_HELP.email} /><VoiceInput type="email" value={form.email ?? ""} onChange={v => setForm(f => ({ ...f, email: v }))} /></div>
              <div><LabelHelp label="Telefone" help={REP_HELP.telefone} /><VoiceInput value={form.telefone ?? ""} onChange={v => setForm(f => ({ ...f, telefone: v }))} /></div>
            </div>
            <div><LabelHelp label="Região" help={REP_HELP.regiao} /><VoiceInput value={form.regiao ?? ""} onChange={v => setForm(f => ({ ...f, regiao: v }))} /></div>
            <div><LabelHelp label="Outras marcas que trabalha" help={REP_HELP.outras_marcas} /><VoiceTextarea rows={2} value={form.outras_marcas ?? ""} onChange={v => setForm(f => ({ ...f, outras_marcas: v }))} /></div>
            <div><LabelHelp label="Observações" help={REP_HELP.observacoes} /><VoiceTextarea rows={2} value={form.observacoes ?? ""} onChange={v => setForm(f => ({ ...f, observacoes: v }))} /></div>
            <Button onClick={save} className="w-full">{editing ? "Salvar alterações" : "Cadastrar"}</Button>
          </div>
        </DialogContent>
      </Dialog>
      <div className="p-4 sm:p-8">
        {/* Desktop / tablet: table */}
        <div className="surface rounded-xl overflow-hidden hidden md:block">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-3">Nome</th>
                  <th className="text-left px-4 py-3">Representação</th>
                  <th className="text-left px-4 py-3">E-mail</th>
                  <th className="text-left px-4 py-3">Telefone</th>
                  <th className="text-left px-4 py-3">Região</th>
                  <th className="px-4 py-3 w-20"></th>
                </tr>
              </thead>
              <tbody>
                {reps.length === 0 ? <tr><td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">Nenhum representante cadastrado.</td></tr> :
                  reps.map((r: any) => (
                    <tr key={r.id} className="border-t border-border">
                      <td className="px-4 py-3 font-medium">{r.nome}</td>
                      <td className="px-4 py-3 text-muted-foreground">{r.representacao || "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{r.email || "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{r.telefone || "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{r.regiao || "—"}</td>
                      <td className="px-4 py-3 text-right">
                        <EntityKebab type="representante" id={r.id} onEdit={() => openEdit(r)} onDelete={() => remove(r)} />
                      </td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          </div>
        </div>

        {/* Mobile: stacked cards */}
        <div className="md:hidden space-y-3">
          {reps.length === 0 ? (
            <div className="surface rounded-xl px-4 py-12 text-center text-sm text-muted-foreground">
              Nenhum representante cadastrado.
            </div>
          ) : reps.map((r: any) => (
            <div key={r.id} className="surface rounded-xl p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-sm truncate">{r.nome}</p>
                  {r.representacao && (
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{r.representacao}</p>
                  )}
                </div>
                <div className="shrink-0">
                  <EntityKebab type="representante" id={r.id} onEdit={() => openEdit(r)} onDelete={() => remove(r)} />
                </div>
              </div>
              <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
                {r.email && (<><dt className="text-muted-foreground">E-mail</dt><dd className="min-w-0 truncate">{r.email}</dd></>)}
                {r.telefone && (<><dt className="text-muted-foreground">Telefone</dt><dd className="min-w-0 truncate">{r.telefone}</dd></>)}
                {r.regiao && (<><dt className="text-muted-foreground">Região</dt><dd className="min-w-0 truncate">{r.regiao}</dd></>)}
              </dl>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
