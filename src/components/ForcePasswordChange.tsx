import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { KeyRound, Loader2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

/**
 * Bloqueia o painel no primeiro acesso de contas criadas com senha temporária
 * (user_metadata.must_change_password === true) até que o usuário defina a própria senha.
 */
export function ForcePasswordChange() {
  const [required, setRequired] = useState(false);
  const [senha, setSenha] = useState("");
  const [confirma, setConfirma] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;

    async function check() {
      const { data } = await supabase.auth.getUser();
      if (!alive) return;
      setRequired(data.user?.user_metadata?.["must_change_password"] === true);
    }

    check();
    const { data: sub } = supabase.auth.onAuthStateChange(() => { check(); });
    return () => { alive = false; sub.subscription.unsubscribe(); };
  }, []);

  if (!required) return null;

  async function submit() {
    if (senha.length < 8) return toast.error("A nova senha deve ter ao menos 8 caracteres");
    if (senha !== confirma) return toast.error("As senhas não conferem");
    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: senha,
        data: { must_change_password: false },
      });
      if (error) throw error;
      toast.success("Senha atualizada com sucesso");
      setRequired(false);
      setSenha(""); setConfirma("");
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível atualizar a senha");
    } finally {
      setSaving(false);
    }
  }

  async function sair() {
    await supabase.auth.signOut();
    window.location.href = "/auth";
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-lg space-y-4">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-primary/10 p-2 text-primary">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold tracking-tight">Atualize sua senha</h2>
            <p className="text-sm text-muted-foreground">
              Este é o seu primeiro acesso. Por segurança, defina uma senha pessoal antes de continuar.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Nova senha</Label>
            <Input
              type="password"
              autoComplete="new-password"
              value={senha}
              onChange={e => setSenha(e.target.value)}
              placeholder="Mínimo de 8 caracteres"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Confirmar nova senha</Label>
            <Input
              type="password"
              autoComplete="new-password"
              value={confirma}
              onChange={e => setConfirma(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") submit(); }}
            />
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 pt-1">
          <Button variant="ghost" size="sm" onClick={sair} className="text-muted-foreground">Sair</Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <KeyRound className="h-4 w-4 mr-2" />}
            Salvar nova senha
          </Button>
        </div>
      </div>
    </div>
  );
}
