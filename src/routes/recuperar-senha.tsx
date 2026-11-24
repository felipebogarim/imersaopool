import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Check, Eye, EyeOff, KeyRound, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { purgeAppCaches } from "@/lib/app-refresh";
import { firstAccessDestination } from "@/lib/first-access-redirect";
import { resolveRepInviteSession } from "@/lib/rep-metas-access";

export const Route = createFileRoute("/recuperar-senha")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): { e?: string; next?: string } => ({
    e: typeof search.e === "string" ? search.e : undefined,
    next: typeof search.next === "string" ? search.next : undefined,
  }),
  head: () => ({
    meta: [{ title: "Recuperar senha — PoolFlux" }],
  }),
  component: RecuperarSenhaPage,
});

function RecuperarSenhaPage() {
  const { e: targetEmail, next } = Route.useSearch();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (
        active &&
        resolveRepInviteSession(data.session?.user.email, targetEmail) === "open_destination"
      ) {
        setReady(true);
      }
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (
        active &&
        resolveRepInviteSession(session?.user.email, targetEmail) === "open_destination"
      ) {
        setReady(true);
      }
    });
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [targetEmail]);

  const rules = [
    { ok: password.length >= 8, label: "Mínimo de 8 caracteres" },
    { ok: /[A-Za-z]/.test(password), label: "Pelo menos uma letra" },
    { ok: /[0-9]/.test(password), label: "Pelo menos um número" },
    { ok: /[^A-Za-z0-9]/.test(password), label: "Pelo menos um símbolo (!@#$…)" },
  ];
  const strong = rules.every((rule) => rule.ok);
  const matches = confirmation.length > 0 && password === confirmation;

  async function save() {
    if (!ready || !strong || !matches) return;
    setSaving(true);
    try {
      const { data } = await supabase.auth.getSession();
      if (resolveRepInviteSession(data.session?.user.email, targetEmail) !== "open_destination") {
        throw new Error("O link de recuperação não corresponde ao usuário autenticado.");
      }
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      await purgeAppCaches();
      toast.success("Senha redefinida com sucesso.");
      window.location.replace(firstAccessDestination(next));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível redefinir a senha.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-5 rounded-xl border border-border bg-card p-6 shadow-lg">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Redefinir senha</h1>
          <p className="text-sm text-muted-foreground">
            {ready ? "Crie uma nova senha para continuar." : "Validando o link de recuperação…"}
          </p>
        </div>

        {!ready ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Aguarde…
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="new-password">Nova senha</Label>
              <div className="relative">
                <Input
                  id="new-password"
                  type={show ? "text" : "password"}
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="pr-10"
                />
                <button
                  type="button"
                  aria-label={show ? "Ocultar senha" : "Mostrar senha"}
                  onClick={() => setShow((value) => !value)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                >
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <ul className="space-y-1">
              {rules.map((rule) => (
                <li
                  key={rule.label}
                  className={`flex items-center gap-1.5 text-xs ${rule.ok ? "text-primary" : "text-muted-foreground"}`}
                >
                  {rule.ok ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                  {rule.label}
                </li>
              ))}
            </ul>
            <div className="space-y-1.5">
              <Label htmlFor="confirm-password">Confirmar senha</Label>
              <Input
                id="confirm-password"
                type={show ? "text" : "password"}
                autoComplete="new-password"
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void save();
                }}
              />
            </div>
            {confirmation.length > 0 && !matches && (
              <p className="text-xs text-destructive">As senhas não conferem.</p>
            )}
            <Button
              className="w-full"
              onClick={() => void save()}
              disabled={saving || !strong || !matches}
            >
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <KeyRound className="mr-2 h-4 w-4" />
              )}
              Salvar nova senha
            </Button>
          </div>
        )}
      </div>
    </main>
  );
}
