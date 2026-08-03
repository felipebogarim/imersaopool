import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Save, KeyRound, UserCog, LogOut } from "lucide-react";
import { toast } from "sonner";
import { purgeAppCaches } from "@/lib/app-refresh";

export const Route = createFileRoute("/_authenticated/perfil")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Meu perfil · PoolFlux" },
      { name: "description", content: "Edite seus dados de perfil e atualize sua senha de acesso." },
      { property: "og:title", content: "Meu perfil · PoolFlux" },
      { property: "og:description", content: "Edite seus dados de perfil e atualize sua senha de acesso." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PerfilPage,
});

function strong(pw: string) {
  return pw.length >= 8 && /[a-zA-Z]/.test(pw) && /\d/.test(pw) && /[^a-zA-Z0-9]/.test(pw);
}

function PerfilPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState({ full_name: "", phone: "", cargo: "", regiao: "" });
  const [savingProfile, setSavingProfile] = useState(false);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [savingPw, setSavingPw] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["meu-perfil"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id;
      if (!uid) return null;
      const { data: p } = await supabase
        .from("profiles")
        .select("id, full_name, email, phone, cargo, regiao")
        .eq("id", uid)
        .maybeSingle();
      return { uid, email: u.user?.email ?? p?.email ?? "", profile: p };
    },
  });

  useEffect(() => {
    const p = data?.profile as any;
    if (!p) return;
    setForm({
      full_name: p.full_name ?? "",
      phone: p.phone ?? "",
      cargo: p.cargo ?? "",
      regiao: p.regiao ?? "",
    });
  }, [data]);

  async function salvarPerfil() {
    if (!data?.uid) return;
    setSavingProfile(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: form.full_name.trim() || null,
          phone: form.phone.trim() || null,
          cargo: form.cargo.trim() || null,
          regiao: form.regiao.trim() || null,
        })
        .eq("id", data.uid);
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["meu-perfil"] });
      await qc.invalidateQueries({ queryKey: ["workspace-header"] });
      toast.success("Perfil atualizado");
    } catch (e: any) {
      toast.error("Não foi possível salvar", { description: e.message });
    } finally {
      setSavingProfile(false);
    }
  }

  async function salvarSenha() {
    if (!strong(pw)) {
      return toast.error("Senha fraca", {
        description: "Use no mínimo 8 caracteres, com letras, números e símbolos.",
      });
    }
    if (pw !== pw2) return toast.error("As senhas não conferem");
    setSavingPw(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: pw });
      if (error) throw error;
      setPw("");
      setPw2("");
      toast.success("Senha atualizada com sucesso");
    } catch (e: any) {
      toast.error("Não foi possível atualizar a senha", { description: e.message });
    } finally {
      setSavingPw(false);
    }
  }

  async function sair() {
    await supabase.auth.signOut();
    window.location.href = "/auth";
  }


  return (
    <div>
      <div className="border-b border-border px-4 sm:px-8 py-6">
        <div className="flex items-center gap-3">
          <UserCog className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Meu perfil</h1>
            <p className="text-sm text-muted-foreground">{data?.email ?? "—"}</p>
          </div>
        </div>
      </div>

      <PageHeader title="Dados e segurança" subtitle="Atualize seus dados pessoais e sua senha de acesso." />

      <div className="p-4 sm:p-8 space-y-6 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>Editar perfil</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nome completo</Label>
              <Input
                value={form.full_name}
                onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                disabled={isLoading}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Telefone</Label>
                <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Cargo</Label>
                <Input value={form.cargo} onChange={e => setForm(f => ({ ...f, cargo: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Região</Label>
              <Input value={form.regiao} onChange={e => setForm(f => ({ ...f, regiao: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>E-mail</Label>
              <Input value={data?.email ?? ""} disabled />
              <p className="text-xs text-muted-foreground">
                O e-mail de acesso só pode ser alterado por um administrador.
              </p>
            </div>
            <Button onClick={salvarPerfil} disabled={savingProfile || isLoading}>
              {savingProfile ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar perfil
            </Button>
          </CardContent>
        </Card>

        <Card id="senha" className="scroll-mt-24">
          <CardHeader>
            <CardTitle>Atualizar senha</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nova senha</Label>
              <Input type="password" value={pw} onChange={e => setPw(e.target.value)} autoComplete="new-password" />
              <p className="text-xs text-muted-foreground">
                Mínimo de 8 caracteres, com letras, números e símbolos.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Confirmar nova senha</Label>
              <Input type="password" value={pw2} onChange={e => setPw2(e.target.value)} autoComplete="new-password" />
            </div>
            <Button onClick={salvarSenha} disabled={savingPw || !pw || !pw2}>
              {savingPw ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
              Atualizar senha
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Sessão</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Encerre sua sessão neste dispositivo.
            </p>
            <Button variant="destructive" onClick={sair}>
              <LogOut className="h-4 w-4" /> Sair
            </Button>
          </CardContent>
        </Card>
      </div>

    </div>
  );
}
