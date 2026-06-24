import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/price")({
  head: () => ({ meta: [{ title: "Price — PoolFlux" }] }),
  component: PricePage,
});

function PricePage() {
  return (
    <div>
      <PageHeader title="Price" subtitle="Shopping de preços e comparativo com competidores" />
      <div className="p-8">
        <Tabs defaultValue="competidores">
          <TabsList>
            <TabsTrigger value="competidores">Competidores</TabsTrigger>
            <TabsTrigger value="nossos">Nossos produtos</TabsTrigger>
            <TabsTrigger value="concorrentes">Produtos concorrentes</TabsTrigger>
            <TabsTrigger value="comparativo">Comparativo</TabsTrigger>
          </TabsList>
          <TabsContent value="competidores" className="mt-4"><Competitors /></TabsContent>
          <TabsContent value="nossos" className="mt-4"><OwnProducts /></TabsContent>
          <TabsContent value="concorrentes" className="mt-4">
            <div className="surface rounded-xl p-8 text-center text-sm text-muted-foreground">Cadastre competidores e seus produtos para começar.</div>
          </TabsContent>
          <TabsContent value="comparativo" className="mt-4">
            <div className="surface rounded-xl p-8 text-center text-sm text-muted-foreground">O comparativo aparece após cadastrar produtos e relações de equivalência.</div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function Competitors() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const { data = [] } = useQuery({
    queryKey: ["price-competitors"],
    queryFn: async () => (await supabase.from("price_competitors").select("*").order("nome")).data ?? [],
  });
  async function save() {
    if (!form.nome) return toast.error("Nome obrigatório");
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("price_competitors").insert({ ...form, created_by: user?.id } as any);
    if (error) return toast.error(error.message);
    toast.success("Competidor cadastrado");
    setForm({}); setOpen(false);
    qc.invalidateQueries({ queryKey: ["price-competitors"] });
  }
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" /> Novo competidor</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Novo competidor</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Nome *</Label><Input value={form.nome ?? ""} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} /></div>
              <div><Label>Categoria</Label><Input value={form.categoria ?? ""} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))} /></div>
              <div><Label>Região</Label><Input value={form.regiao ?? ""} onChange={e => setForm(f => ({ ...f, regiao: e.target.value }))} /></div>
              <Button onClick={save} className="w-full">Cadastrar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <div className="surface rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
            <tr><th className="text-left px-4 py-3">Nome</th><th className="text-left px-4 py-3">Categoria</th><th className="text-left px-4 py-3">Região</th></tr>
          </thead>
          <tbody>
            {data.length === 0 ? <tr><td colSpan={3} className="px-4 py-12 text-center text-muted-foreground">Nenhum competidor.</td></tr> :
              data.map((c: any) => (
                <tr key={c.id} className="border-t border-border">
                  <td className="px-4 py-3 font-medium">{c.nome}</td>
                  <td className="px-4 py-3 text-muted-foreground">{c.categoria || "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{c.regiao || "—"}</td>
                </tr>
              ))
            }
          </tbody>
        </table>
      </div>
    </div>
  );
}

function OwnProducts() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Record<string, any>>({});
  const { data = [] } = useQuery({
    queryKey: ["own-products"],
    queryFn: async () => (await supabase.from("own_products").select("*").order("nome")).data ?? [],
  });
  async function save() {
    if (!form.nome) return toast.error("Nome obrigatório");
    const { error } = await supabase.from("own_products").insert({
      ...form,
      preco_base: form.preco_base ? Number(form.preco_base) : null,
    } as any);
    if (error) return toast.error(error.message);
    toast.success("Produto cadastrado");
    setForm({}); setOpen(false);
    qc.invalidateQueries({ queryKey: ["own-products"] });
  }
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" /> Novo produto</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Novo produto próprio</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Código interno</Label><Input value={form.codigo_interno ?? ""} onChange={e => setForm(f => ({ ...f, codigo_interno: e.target.value }))} /></div>
              <div><Label>Nome *</Label><Input value={form.nome ?? ""} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Família</Label><Input value={form.familia ?? ""} onChange={e => setForm(f => ({ ...f, familia: e.target.value }))} /></div>
                <div><Label>Categoria</Label><Input value={form.categoria ?? ""} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))} /></div>
              </div>
              <div><Label>Preço base</Label><Input type="number" step="0.01" value={form.preco_base ?? ""} onChange={e => setForm(f => ({ ...f, preco_base: e.target.value }))} /></div>
              <Button onClick={save} className="w-full">Cadastrar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <div className="surface rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
            <tr><th className="text-left px-4 py-3">Código</th><th className="text-left px-4 py-3">Nome</th><th className="text-left px-4 py-3">Família</th><th className="text-right px-4 py-3">Preço base</th></tr>
          </thead>
          <tbody>
            {data.length === 0 ? <tr><td colSpan={4} className="px-4 py-12 text-center text-muted-foreground">Nenhum produto.</td></tr> :
              data.map((p: any) => (
                <tr key={p.id} className="border-t border-border">
                  <td className="px-4 py-3 text-muted-foreground">{p.codigo_interno || "—"}</td>
                  <td className="px-4 py-3 font-medium">{p.nome}</td>
                  <td className="px-4 py-3 text-muted-foreground">{p.familia || "—"}</td>
                  <td className="px-4 py-3 text-right">{p.preco_base ? `R$ ${Number(p.preco_base).toFixed(2)}` : "—"}</td>
                </tr>
              ))
            }
          </tbody>
        </table>
      </div>
    </div>
  );
}
