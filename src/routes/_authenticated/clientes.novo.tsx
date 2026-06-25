import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { VoiceInput, VoiceTextarea } from "@/components/VoiceInput";
import { LabelHelp } from "@/components/FieldHelp";
import { CLIENT_HELP } from "@/lib/field-help-texts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";

export const Route = createFileRoute("/_authenticated/clientes/novo")({
  head: () => ({ meta: [{ title: "Novo cliente — PoolFlux" }] }),
  component: NewClient,
});

function NewClient() {
  const navigate = useNavigate();
  const [form, setForm] = useState<Record<string, any>>({ status: "ativo" });
  const [saving, setSaving] = useState(false);

  const { data: reps = [] } = useQuery({
    queryKey: ["reps"],
    queryFn: async () => (await supabase.from("representatives").select("id, nome").order("nome")).data ?? [],
  });

  function set(k: string, v: any) { setForm(f => ({ ...f, [k]: v })); }

  async function save() {
    if (!form.nome_fantasia) return toast.error("Informe o nome fantasia");
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const payload = { ...form, created_by: user?.id, agente_id: user?.id };
    const { data, error } = await supabase.from("clients").insert(payload as any).select("id").single();
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Cliente cadastrado");
    navigate({ to: "/clientes/$id", params: { id: data.id } });
  }

  return (
    <div>
      <PageHeader
        title="Novo cliente"
        actions={<Button variant="ghost" asChild><Link to="/clientes"><ArrowLeft className="h-4 w-4 mr-1" /> Voltar</Link></Button>}
      />
      <div className="p-8 max-w-4xl">
        <div className="surface rounded-xl p-6 space-y-5">
          <div className="grid md:grid-cols-2 gap-4">
            <div><LabelHelp label="Nome fantasia" required help={CLIENT_HELP.nome_fantasia} /><VoiceInput value={form.nome_fantasia ?? ""} onChange={v => set("nome_fantasia", v)} /></div>
            <div><LabelHelp label="Razão social" help={CLIENT_HELP.razao_social} /><VoiceInput value={form.razao_social ?? ""} onChange={v => set("razao_social", v)} /></div>
            <div><LabelHelp label="CNPJ / CPF" help={CLIENT_HELP.documento} /><VoiceInput value={form.documento ?? ""} onChange={v => set("documento", v)} /></div>
            <div>
              <LabelHelp label="Grupo" help={CLIENT_HELP.grupo} withMediaSuffix={false} />
              <Select value={form.grupo} onValueChange={v => set("grupo", v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{["G1","G2","G2+","Corporativo"].map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <LabelHelp label="Categoria" help={CLIENT_HELP.categoria} withMediaSuffix={false} />
              <Select value={form.categoria} onValueChange={v => set("categoria", v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{["Black","Gold","Silver"].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <LabelHelp label="Status" help={CLIENT_HELP.status} withMediaSuffix={false} />
              <Select value={form.status} onValueChange={v => set("status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{["ativo","prospect","inativo"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><LabelHelp label="Cidade" help={CLIENT_HELP.cidade} /><VoiceInput value={form.cidade ?? ""} onChange={v => set("cidade", v)} /></div>
            <div><LabelHelp label="Estado" help={CLIENT_HELP.estado} /><VoiceInput value={form.estado ?? ""} onChange={v => set("estado", v)} maxLength={2} /></div>
            <div><LabelHelp label="Região" help={CLIENT_HELP.regiao} /><VoiceInput value={form.regiao ?? ""} onChange={v => set("regiao", v)} /></div>
            <div><LabelHelp label="Endereço" help={CLIENT_HELP.endereco} /><VoiceInput value={form.endereco ?? ""} onChange={v => set("endereco", v)} /></div>
            <div><LabelHelp label="Nome do comprador" help={CLIENT_HELP.nome_comprador} /><VoiceInput value={form.nome_comprador ?? ""} onChange={v => set("nome_comprador", v)} /></div>
            <div><LabelHelp label="Telefone" help={CLIENT_HELP.telefone} /><VoiceInput value={form.telefone ?? ""} onChange={v => set("telefone", v)} /></div>
            <div><LabelHelp label="WhatsApp" help={CLIENT_HELP.whatsapp} /><VoiceInput value={form.whatsapp ?? ""} onChange={v => set("whatsapp", v)} /></div>
            <div><LabelHelp label="E-mail" help={CLIENT_HELP.email} /><VoiceInput type="email" value={form.email ?? ""} onChange={v => set("email", v)} /></div>
            <div>
              <LabelHelp label="Representante responsável" help={CLIENT_HELP.representante} withMediaSuffix={false} />
              <Select value={form.representative_id} onValueChange={v => set("representative_id", v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{reps.map((r: any) => <SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div><LabelHelp label="Observações comerciais" help={CLIENT_HELP.observacoes} /><VoiceTextarea rows={3} value={form.observacoes ?? ""} onChange={v => set("observacoes", v)} /></div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" asChild><Link to="/clientes">Cancelar</Link></Button>
            <Button onClick={save} disabled={saving}>{saving ? "Salvando..." : "Cadastrar cliente"}</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
