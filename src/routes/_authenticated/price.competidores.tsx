import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/price/competidores")({
  head: () => ({
    meta: [
      { title: "Competidores | Price" },
      { name: "description", content: "Cadastro e listagem de competidores para análise de preços." },
    ],
  }),
  component: CompetidoresPage,
});

function CompetidoresPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});

  const { data = [], isLoading } = useQuery({
    queryKey: ["price-competitors"],
    queryFn: async () =>
      (await supabase.from("price_competitors").select("*").order("nome")).data ?? [],
  });

  async function save() {
    if (!form.nome) return toast.error("Nome obrigatório");
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("price_competitors")
      .insert({ ...form, created_by: user?.id } as any);
    if (error) return toast.error(error.message);
    toast.success("Competidor cadastrado");
    setForm({});
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["price-competitors"] });
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Users className="h-4 w-4" />
          {data.length} competidor{data.length === 1 ? "" : "es"}
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-1" /> Registrar competidor
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo competidor</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Nome *</Label>
                <Input value={form.nome ?? ""} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Categoria</Label>
                  <Input value={form.categoria ?? ""} onChange={(e) => setForm((f) => ({ ...f, categoria: e.target.value }))} />
                </div>
                <div>
                  <Label>Região</Label>
                  <Input value={form.regiao ?? ""} onChange={(e) => setForm((f) => ({ ...f, regiao: e.target.value }))} />
                </div>
              </div>
              <div>
                <Label>Observações</Label>
                <Textarea value={form.observacoes ?? ""} onChange={(e) => setForm((f) => ({ ...f, observacoes: e.target.value }))} />
              </div>
              <Button onClick={save} className="w-full">Cadastrar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="surface rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-3">Nome</th>
              <th className="text-left px-4 py-3">Categoria</th>
              <th className="text-left px-4 py-3">Região</th>
              <th className="text-left px-4 py-3">Observações</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={4} className="px-4 py-12 text-center text-muted-foreground">Carregando...</td></tr>
            ) : data.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-12 text-center text-muted-foreground">Nenhum competidor cadastrado.</td></tr>
            ) : (
              data.map((c: any) => (
                <tr key={c.id} className="border-t border-border">
                  <td className="px-4 py-3 font-medium">{c.nome}</td>
                  <td className="px-4 py-3 text-muted-foreground">{c.categoria || "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{c.regiao || "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs max-w-md truncate">{c.observacoes || "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
