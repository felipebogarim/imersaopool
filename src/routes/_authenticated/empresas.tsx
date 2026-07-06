import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Building2, Plus, ArrowRight, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

export const Route = createFileRoute("/_authenticated/empresas")({
  head: () => ({ meta: [{ title: "Empresas — PoolFlux" }] }),
  component: EmpresasPage,
});

const companySchema = z.object({
  nome: z.string().trim().min(2, "Nome fantasia obrigatório").max(120),
  razao_social: z.string().trim().max(180).optional().or(z.literal("")),
  cnpj: z.string().trim().max(20).optional().or(z.literal("")),
  cep: z.string().trim().max(10).optional().or(z.literal("")),
  logradouro: z.string().trim().max(180).optional().or(z.literal("")),
  numero: z.string().trim().max(20).optional().or(z.literal("")),
  bairro: z.string().trim().max(120).optional().or(z.literal("")),
  cidade: z.string().trim().max(120).optional().or(z.literal("")),
  estado: z.string().trim().max(60).optional().or(z.literal("")),
  pais: z.string().trim().max(60).optional().or(z.literal("")),
});
type CompanyForm = z.infer<typeof companySchema>;

const emptyForm: CompanyForm = {
  nome: "", razao_social: "", cnpj: "", cep: "", logradouro: "",
  numero: "", bairro: "", cidade: "", estado: "", pais: "Brasil",
};

function EmpresasPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<CompanyForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);

  const setField = (k: keyof CompanyForm) => (v: string) => setForm(f => ({ ...f, [k]: v }));

  const { data: me } = useQuery({
    queryKey: ["me-role-company"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id;
      if (!uid) return null;
      const [{ data: roles }, { data: profile }] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", uid),
        supabase.from("profiles").select("active_company_id, company_id").eq("id", uid).maybeSingle(),
      ]);
      const isAdmin = (roles ?? []).some(r => r.role === "admin");
      return { uid, isAdmin, activeId: profile?.active_company_id ?? null, homeId: profile?.company_id ?? null };
    },
  });

  const { data: companies } = useQuery({
    queryKey: ["companies-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("companies").select("id, nome, slug, created_at").order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  async function selectCompany(id: string) {
    if (!me?.uid) return;
    const { error } = await supabase.from("profiles").update({ active_company_id: id }).eq("id", me.uid);
    if (error) return toast.error(error.message);
    await qc.invalidateQueries();
    navigate({ to: "/dashboard" });
  }

  async function lookupCep() {
    const raw = (form.cep ?? "").replace(/\D/g, "");
    if (raw.length !== 8) return;
    setCepLoading(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${raw}/json/`);
      const data = await res.json();
      if (data.erro) { toast.error("CEP não encontrado"); return; }
      setForm(f => ({
        ...f,
        logradouro: data.logradouro ?? f.logradouro,
        bairro: data.bairro ?? f.bairro,
        cidade: data.localidade ?? f.cidade,
        estado: data.uf ?? f.estado,
        pais: f.pais || "Brasil",
      }));
    } catch {
      toast.error("Falha ao buscar CEP");
    } finally {
      setCepLoading(false);
    }
  }

  async function createCompany() {
    const parsed = companySchema.safeParse(form);
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    setSaving(true);
    const payload = Object.fromEntries(
      Object.entries(parsed.data).map(([k, v]) => [k, v === "" ? null : v])
    ) as any;
    payload.created_by = me?.uid;
    const { data, error } = await supabase.from("companies").insert(payload).select("id").single();
    setSaving(false);
    if (error) return toast.error(error.message);
    setOpen(false);
    setForm(emptyForm);
    await qc.invalidateQueries({ queryKey: ["companies-list"] });
    toast.success("Empresa criada");
    if (data?.id) selectCompany(data.id);
  }

  const list = me?.isAdmin ? (companies ?? []) : (companies ?? []).filter(c => c.id === me?.homeId);

  return (
    <div>
      <PageHeader
        title="Selecionar empresa"
        subtitle="Cada empresa é um espaço de trabalho isolado, com seus próprios dados."
        actions={
          me?.isAdmin ? (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button><Plus className="h-4 w-4 mr-2" /> Nova empresa</Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader><DialogTitle>Cadastrar nova empresa</DialogTitle></DialogHeader>
                <div className="grid gap-3 md:grid-cols-2 max-h-[70vh] overflow-y-auto pr-1">
                  <div className="md:col-span-2">
                    <Label>Nome fantasia *</Label>
                    <Input value={form.nome} onChange={e => setField("nome")(e.target.value)} placeholder="Nome principal exibido no sistema" autoFocus />
                  </div>
                  <div className="md:col-span-2">
                    <Label>Razão social</Label>
                    <Input value={form.razao_social ?? ""} onChange={e => setField("razao_social")(e.target.value)} />
                  </div>
                  <div>
                    <Label>CNPJ</Label>
                    <Input value={form.cnpj ?? ""} onChange={e => setField("cnpj")(e.target.value)} placeholder="00.000.000/0000-00" />
                  </div>
                  <div>
                    <Label>CEP</Label>
                    <div className="relative">
                      <Input
                        value={form.cep ?? ""}
                        onChange={e => setField("cep")(e.target.value)}
                        onBlur={lookupCep}
                        placeholder="00000-000"
                      />
                      {cepLoading && <Loader2 className="h-4 w-4 animate-spin absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground" />}
                    </div>
                  </div>
                  <div className="md:col-span-2">
                    <Label>Logradouro</Label>
                    <Input value={form.logradouro ?? ""} onChange={e => setField("logradouro")(e.target.value)} />
                  </div>
                  <div>
                    <Label>Número</Label>
                    <Input value={form.numero ?? ""} onChange={e => setField("numero")(e.target.value)} />
                  </div>
                  <div>
                    <Label>Bairro</Label>
                    <Input value={form.bairro ?? ""} onChange={e => setField("bairro")(e.target.value)} />
                  </div>
                  <div>
                    <Label>Cidade</Label>
                    <Input value={form.cidade ?? ""} onChange={e => setField("cidade")(e.target.value)} />
                  </div>
                  <div>
                    <Label>Estado</Label>
                    <Input value={form.estado ?? ""} onChange={e => setField("estado")(e.target.value)} placeholder="UF" />
                  </div>
                  <div className="md:col-span-2">
                    <Label>País</Label>
                    <Input value={form.pais ?? ""} onChange={e => setField("pais")(e.target.value)} />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
                  <Button onClick={createCompany} disabled={saving}>
                    {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Criar e entrar
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          ) : null
        }
      />
      <div className="p-8">
        {list.length === 0 ? (
          <div className="surface rounded-xl p-10 text-center">
            <Building2 className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <h3 className="text-lg font-semibold">Nenhuma empresa disponível</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {me?.isAdmin ? "Cadastre a primeira empresa para começar." : "Aguarde o administrador vincular sua conta a uma empresa."}
            </p>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {list.map(c => {
              const active = c.id === me?.activeId;
              return (
                <button
                  key={c.id}
                  onClick={() => selectCompany(c.id)}
                  className="surface rounded-xl p-5 text-left hover:border-primary transition group"
                >
                  <div className="flex items-center justify-between mb-3">
                    <Building2 className="h-6 w-6 text-cyan" />
                    {active ? <Check className="h-4 w-4 text-primary" /> : <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary" />}
                  </div>
                  <div className="font-semibold">{c.nome}</div>
                  {active && <div className="text-xs text-primary mt-1">Empresa ativa</div>}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
