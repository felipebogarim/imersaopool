import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { VoiceInput, VoiceTextarea } from "@/components/VoiceInput";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";

export const Route = createFileRoute("/_authenticated/clientes/$id/editar")({
  head: () => ({ meta: [{ title: "Editar cliente — PoolFlux" }] }),
  component: EditClient,
});

function EditClient() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);

  const { data: client } = useQuery({
    queryKey: ["client-edit", id],
    queryFn: async () => (await supabase.from("clients").select("*").eq("id", id).single()).data,
  });
  const { data: reps = [] } = useQuery({
    queryKey: ["reps"],
    queryFn: async () => (await supabase.from("representatives").select("id, nome").order("nome")).data ?? [],
  });

  useEffect(() => { if (client) setForm(client); }, [client]);

  function set(k: string, v: any) { setForm(f => ({ ...f, [k]: v })); }

  async function save() {
    if (!form.nome_fantasia) return toast.error("Informe o nome fantasia");
    setSaving(true);
    const { id: _id, created_at, updated_at, created_by, agente_id, ...payload } = form;
    const { error } = await supabase.from("clients").update(payload as any).eq("id", id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Cliente atualizado");
    navigate({ to: "/clientes/$id", params: { id } });
  }

  if (!client) return <div className="p-8">Carregando...</div>;

  return (
    <div>
      <PageHeader
        title="Editar cliente"
        actions={<Button variant="ghost" asChild><Link to="/clientes/$id" params={{ id }}><ArrowLeft className="h-4 w-4 mr-1" /> Voltar</Link></Button>}
      />
      <div className="p-8 max-w-4xl">
        <div className="surface rounded-xl p-6 space-y-5">
          <div className="grid md:grid-cols-2 gap-4">
            <div><Label>Nome fantasia *</Label><VoiceInput value={form.nome_fantasia ?? ""} onChange={v => set("nome_fantasia", v)} /></div>
            <div><Label>Razão social</Label><VoiceInput value={form.razao_social ?? ""} onChange={v => set("razao_social", v)} /></div>
            <div><Label>CNPJ / CPF</Label><VoiceInput value={form.documento ?? ""} onChange={v => set("documento", v)} /></div>
            <div>
              <Label>Grupo</Label>
              <Select value={form.grupo ?? undefined} onValueChange={v => set("grupo", v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{["G1","G2","G2+","Corporativo"].map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Categoria</Label>
              <Select value={form.categoria ?? undefined} onValueChange={v => set("categoria", v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{["Black","Gold","Silver"].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status ?? undefined} onValueChange={v => set("status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{["ativo","prospect","inativo"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Cidade</Label><Input value={form.cidade ?? ""} onChange={e => set("cidade", e.target.value)} /></div>
            <div><Label>Estado</Label><Input value={form.estado ?? ""} onChange={e => set("estado", e.target.value)} maxLength={2} /></div>
            <div><Label>Região</Label><Input value={form.regiao ?? ""} onChange={e => set("regiao", e.target.value)} /></div>
            <div><Label>Endereço</Label><Input value={form.endereco ?? ""} onChange={e => set("endereco", e.target.value)} /></div>
            <div><Label>Nome do comprador</Label><Input value={form.nome_comprador ?? ""} onChange={e => set("nome_comprador", e.target.value)} /></div>
            <div><Label>Telefone</Label><Input value={form.telefone ?? ""} onChange={e => set("telefone", e.target.value)} /></div>
            <div><Label>WhatsApp</Label><Input value={form.whatsapp ?? ""} onChange={e => set("whatsapp", e.target.value)} /></div>
            <div><Label>E-mail</Label><Input type="email" value={form.email ?? ""} onChange={e => set("email", e.target.value)} /></div>
            <div>
              <Label>Representante responsável</Label>
              <Select value={form.representative_id ?? undefined} onValueChange={v => set("representative_id", v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{reps.map((r: any) => <SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div><Label>Observações comerciais</Label><Textarea rows={3} value={form.observacoes ?? ""} onChange={e => set("observacoes", e.target.value)} /></div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" asChild><Link to="/clientes/$id" params={{ id }}>Cancelar</Link></Button>
            <Button onClick={save} disabled={saving}>{saving ? "Salvando..." : "Salvar alterações"}</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
