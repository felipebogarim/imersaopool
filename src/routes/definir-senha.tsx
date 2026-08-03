import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Check, Eye, EyeOff, KeyRound, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { checkFirstAccessToken, setPasswordFromToken } from "@/lib/first-access.functions";
import { purgeAppCaches } from "@/lib/app-refresh";

export const Route = createFileRoute("/definir-senha")({
  validateSearch: z.object({ t: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "Definir senha de acesso | PoolFlux" },
      { name: "description", content: "Crie sua senha pessoal e ative seu acesso ao painel PoolFlux." },
      { property: "og:title", content: "Definir senha de acesso | PoolFlux" },
      { property: "og:description", content: "Crie sua senha pessoal e ative seu acesso ao painel PoolFlux." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DefinirSenhaPage,
});

function PasswordField({
  id, label, value, onChange, onEnter,
}: { id: string; label: string; value: string; onChange: (v: string) => void; onEnter?: () => void }) {
  const [show, setShow] = useState(false);
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type={show ? "text" : "password"}
          autoComplete="new-password"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && onEnter) onEnter(); }}
          className="pr-10"
        />
        <button
          type="button"
          aria-label={show ? "Ocultar senha" : "Mostrar senha"}
          onClick={() => setShow((s) => !s)}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

function DefinirSenhaPage() {
  const { t } = Route.useSearch();
  const navigate = useNavigate();
  const [state, setState] = useState<"loading" | "ok" | "invalid">("loading");
  const [info, setInfo] = useState<{ email: string; name: string | null }>({ email: "", name: null });
  const [motivo, setMotivo] = useState("Convite inválido.");
  const [senha, setSenha] = useState("");
  const [confirma, setConfirma] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!t) { setState("invalid"); return; }
      try {
        const res: any = await checkFirstAccessToken({ data: { token: t } });
        if (!alive) return;
        if (res?.valid) {
          setInfo({ email: res.email, name: res.name });
          setState("ok");
        } else {
          setMotivo(
            res?.reason === "used"
              ? "Este convite já foi utilizado. Faça login normalmente."
              : res?.reason === "expired"
                ? "Este convite expirou. Peça um novo ao administrador."
                : "Convite inválido.",
          );
          setState("invalid");
        }
      } catch {
        if (alive) setState("invalid");
      }
    })();
    return () => { alive = false; };
  }, [t]);

  const regras = [
    { ok: senha.length >= 8, label: "Mínimo de 8 caracteres" },
    { ok: /[A-Za-z]/.test(senha), label: "Pelo menos uma letra" },
    { ok: /[0-9]/.test(senha), label: "Pelo menos um número" },
    { ok: /[^A-Za-z0-9]/.test(senha), label: "Pelo menos um símbolo (!@#$…)" },
  ];
  const forte = regras.every((r) => r.ok);
  const confere = confirma.length > 0 && senha === confirma;

  async function submit() {
    if (!t || !forte || !confere) return;
    setSaving(true);
    try {
      await setPasswordFromToken({ data: { token: t, password: senha } });
      const { error } = await supabase.auth.signInWithPassword({ email: info.email, password: senha });
      if (error) {
        toast.success("Senha criada! Faça login para continuar.");
        navigate({ to: "/auth" });
        return;
      }
      // Garante que a sessão já esteja persistida antes de recarregar a app.
      for (let i = 0; i < 20; i++) {
        const { data } = await supabase.auth.getSession();
        if (data.session) break;
        await new Promise((r) => setTimeout(r, 150));
      }
      toast.success("Senha criada com sucesso");
      window.location.href = "/dashboard";
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível criar a senha");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-lg space-y-5">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Crie sua senha de acesso</h1>
          <p className="text-sm text-muted-foreground">
            {state === "ok"
              ? <>Bem-vindo(a){info.name ? `, ${info.name}` : ""}! Defina a senha da conta <strong>{info.email}</strong>.</>
              : "Validando seu convite…"}
          </p>
        </div>

        {state === "loading" && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
          </div>
        )}

        {state === "invalid" && (
          <div className="space-y-4">
            <p className="text-sm text-destructive">{motivo}</p>
            <Button variant="outline" onClick={() => navigate({ to: "/auth" })}>Ir para o login</Button>
          </div>
        )}

        {state === "ok" && (
          <div className="space-y-4">
            <PasswordField id="senha" label="Nova senha" value={senha} onChange={setSenha} />
            <ul className="space-y-1">
              {regras.map((r) => (
                <li key={r.label} className={`flex items-center gap-1.5 text-xs ${r.ok ? "text-primary" : "text-muted-foreground"}`}>
                  {r.ok ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />} {r.label}
                </li>
              ))}
            </ul>
            <PasswordField id="confirma" label="Confirmar senha" value={confirma} onChange={setConfirma} onEnter={submit} />
            {confirma.length > 0 && !confere && (
              <p className="text-xs text-destructive">As senhas não conferem.</p>
            )}
            <Button className="w-full" onClick={submit} disabled={saving || !forte || !confere}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <KeyRound className="h-4 w-4 mr-2" />}
              Criar senha e entrar
            </Button>
          </div>
        )}
      </div>
    </main>
  );
}
