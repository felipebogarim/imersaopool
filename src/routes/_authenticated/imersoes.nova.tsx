import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";

const searchSchema = z.object({ client: z.string().optional() });

export const Route = createFileRoute("/_authenticated/imersoes/nova")({
  head: () => ({ meta: [{ title: "Nova imersão — PoolFlux" }] }),
  validateSearch: searchSchema,
  component: NewImmersion,
});

function NewImmersion() {
  const navigate = useNavigate();
  const { client: preClient } = Route.useSearch();
  const [form, setForm] = useState<Record<string, any>>({ client_id: preClient });
  const [saving, setSaving] = useState(false);

  const { data: clients = [] } = useQuery({
    queryKey: ["clients-select"],
    queryFn: async () => (await supabase.from("clients").select("id, nome_fantasia").order("nome_fantasia")).data ?? [],
  });
  const { data: reps = [] } = useQuery({
    queryKey: ["reps-select"],
    queryFn: async () => (await supabase.from("representatives").select("id, nome").order("nome")).data ?? [],
  });

  async function save() {
    if (!form.titulo || !form.client_id) return toast.error("Informe título e cliente");
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase.from("immersions").insert({
      ...form,
      created_by: user?.id,
      agente_id: user?.id,
    }).select("id").single();
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Imersão criada");
    navigate({ to: "/imersoes/$id", params: { id: data.id } });
  }

  return (
    <div>
      <PageHeader
        title="Nova imersão"
        actions={<Button variant="ghost" asChild><Link to="/imersoes"><ArrowLeft className="h-4 w-4 mr-1" /> Voltar</Link></Button>}
      />
      <div className="p-8 max-w-3xl">
        <div className="surface rounded-xl p-6 space-y-4">
          <div><Label>Título da imersão *</Label><Input value={form.titulo ?? ""} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} placeholder="Ex: Imersão Cliente XYZ — Out/2025" /></div>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label>Cliente *</Label>
              <Select value={form.client_id} onValueChange={v => setForm(f => ({ ...f, client_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione um cliente" /></SelectTrigger>
                <SelectContent>{clients.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nome_fantasia}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Representante</Label>
              <Select value={form.representative_id} onValueChange={v => setForm(f => ({ ...f, representative_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{reps.map((r: any) => <SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Data prevista da visita</Label><Input type="date" value={form.data_visita ?? ""} onChange={e => setForm(f => ({ ...f, data_visita: e.target.value }))} /></div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" asChild><Link to="/imersoes">Cancelar</Link></Button>
            <Button onClick={save} disabled={saving}>{saving ? "Criando..." : "Criar imersão"}</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
