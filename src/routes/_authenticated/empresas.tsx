import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Building2, Plus, ArrowRight, Check } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/empresas")({
  head: () => ({ meta: [{ title: "Empresas — PoolFlux" }] }),
  component: EmpresasPage,
});

function EmpresasPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState("");
  const [saving, setSaving] = useState(false);

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

  async function createCompany() {
    if (!nome.trim()) return toast.error("Informe o nome da empresa");
    setSaving(true);
    const { data, error } = await supabase.from("companies").insert({ nome: nome.trim(), created_by: me?.uid }).select("id").single();
    setSaving(false);
    if (error) return toast.error(error.message);
    setOpen(false);
    setNome("");
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
              <DialogContent>
                <DialogHeader><DialogTitle>Cadastrar nova empresa</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div>
                    <Label>Nome da empresa</Label>
                    <Input value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex.: Pool Branding" autoFocus />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
                  <Button onClick={createCompany} disabled={saving}>Criar e entrar</Button>
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
