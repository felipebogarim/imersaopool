import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { VoiceInput, VoiceTextarea } from "@/components/VoiceInput";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { ClientGroupField } from "@/components/ClientGroupField";

export const Route = createFileRoute("/_authenticated/clientes/$id/editar")({
  head: () => ({ meta: [{ title: "Editar cliente — PoolFlux" }] }),
  component: EditClient,
});

// Grouped field definitions for full ERP-aware edit form.
type F = { key: string; label: string; type?: "text" | "textarea" | "email" | "number"; maxLength?: number };

const SECTIONS: { title: string; fields: F[] }[] = [
  {
    title: "Identificação",
    fields: [
      { key: "codigo_erp", label: "Código ERP" },
      { key: "codigo_alternativo", label: "Código alternativo" },
      { key: "nome_fantasia", label: "Nome fantasia *" },
      { key: "razao_social", label: "Razão social" },
      { key: "fisica_juridica", label: "Física / Jurídica" },
      { key: "documento", label: "Documento" },
      { key: "cnpj", label: "CNPJ" },
      { key: "cpf", label: "CPF" },
      { key: "inscricao_estadual", label: "Inscrição estadual" },
      { key: "inscricao_municipal", label: "Inscrição municipal" },
      { key: "suframa", label: "SUFRAMA" },
      { key: "data_cadastro_erp", label: "Data cadastro ERP" },
    ],
  },
  {
    title: "Classificação",
    fields: [
      { key: "categoria_erp", label: "Categoria (ERP)" },
      { key: "grupo_erp", label: "Grupo (ERP)" },
      { key: "status_erp", label: "Status (ERP)" },
      { key: "conso_codigo", label: "Consolidador código" },
      { key: "conso_nome", label: "Consolidador nome" },
      { key: "rota", label: "Rota" },
      { key: "regiao", label: "Região" },
    ],
  },
  {
    title: "Endereço",
    fields: [
      { key: "sigla_endereco", label: "Sigla endereço" },
      { key: "endereco", label: "Endereço" },
      { key: "numero_endereco", label: "Número" },
      { key: "complemento", label: "Complemento" },
      { key: "bairro", label: "Bairro" },
      { key: "cep", label: "CEP" },
      { key: "municipio", label: "Município" },
      { key: "cidade", label: "Cidade" },
      { key: "estado", label: "Estado", maxLength: 2 },
      { key: "pais", label: "País" },
    ],
  },
  {
    title: "Entrega",
    fields: [
      { key: "tipo_end_entrega", label: "Tipo endereço entrega" },
      { key: "end_entrega", label: "Endereço entrega" },
      { key: "rua_entrega", label: "Rua entrega" },
      { key: "num_entrega", label: "Número entrega" },
      { key: "bai_entrega", label: "Bairro entrega" },
      { key: "cep_entrega", label: "CEP entrega" },
      { key: "mun_entrega", label: "Município entrega" },
      { key: "uf_entrega", label: "UF entrega", maxLength: 2 },
    ],
  },
  {
    title: "Contato",
    fields: [
      { key: "nome_comprador", label: "Nome do comprador" },
      { key: "assistente", label: "Assistente" },
      { key: "telefone", label: "Telefone" },
      { key: "whatsapp", label: "WhatsApp" },
      { key: "email", label: "E-mail", type: "email" },
      { key: "outro_email", label: "Outro e-mail", type: "email" },
    ],
  },
  {
    title: "Comercial",
    fields: [
      { key: "cod_representante", label: "Cód. representante (ERP)" },
      { key: "nome_representante_erp", label: "Nome representante (ERP)" },
      { key: "cond_pagamento", label: "Condição de pagamento" },
      { key: "tipo_frete", label: "Tipo de frete" },
      { key: "cod_transportadora", label: "Cód. transportadora" },
      { key: "desc_transportadora", label: "Descrição transportadora" },
      { key: "cod_tabela_nl", label: "Cód. tabela NL" },
      { key: "desc_tabela_nl", label: "Desc. tabela NL" },
      { key: "cod_tabela_sd", label: "Cód. tabela SD" },
      { key: "desc_tabela_sd", label: "Desc. tabela SD" },
      { key: "cod_tabela_st", label: "Cód. tabela ST" },
      { key: "desc_tabela_st", label: "Desc. tabela ST" },
    ],
  },
  {
    title: "Observações",
    fields: [
      { key: "info_comerciais", label: "Informações comerciais", type: "textarea" },
      { key: "obs_cliente", label: "Observações do cliente (ERP)", type: "textarea" },
      { key: "observacoes", label: "Observações comerciais", type: "textarea" },
    ],
  },
];

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
    const { id: _id, created_at, updated_at, created_by, agente_id, company_id, ...payload } = form;
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
      <div className="p-8 max-w-5xl">
        <div className="surface rounded-xl p-6 space-y-5">
          {/* Fixed top: enums + representative */}
          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <Label>Grupo (interno)</Label>
              <Select value={form.grupo ?? undefined} onValueChange={v => set("grupo", v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{["G1","G2","G2+","Corporativo"].map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Categoria (interno)</Label>
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
            <div className="md:col-span-3">
              <Label>Representante responsável (interno)</Label>
              <Select value={form.representative_id ?? undefined} onValueChange={v => set("representative_id", v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{reps.map((r: any) => <SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          <ClientGroupField
            pertenceGrupo={!!form.pertence_grupo}
            grupoNome={form.grupo_nome ?? ""}
            onChange={(v) => setForm((f) => ({ ...f, ...v }))}
          />

          <Accordion type="multiple" defaultValue={["Identificação", "Endereço", "Contato"]} className="w-full">
            {SECTIONS.map((sec) => (
              <AccordionItem key={sec.title} value={sec.title}>
                <AccordionTrigger className="text-sm font-semibold">{sec.title}</AccordionTrigger>
                <AccordionContent>
                  <div className="grid md:grid-cols-2 gap-4">
                    {sec.fields.map((f) => (
                      <div key={f.key} className={f.type === "textarea" ? "md:col-span-2" : ""}>
                        <Label>{f.label}</Label>
                        {f.type === "textarea" ? (
                          <VoiceTextarea rows={3} value={form[f.key] ?? ""} onChange={(v) => set(f.key, v)} />
                        ) : (
                          <VoiceInput
                            type={f.type ?? "text"}
                            maxLength={f.maxLength}
                            value={form[f.key] ?? ""}
                            onChange={(v) => set(f.key, v)}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>

          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <Button variant="outline" asChild><Link to="/clientes/$id" params={{ id }}>Cancelar</Link></Button>
            <Button onClick={save} disabled={saving}>{saving ? "Salvando..." : "Salvar alterações"}</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
