import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { BrandLogo } from "@/components/Brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { clearAuthGateCache } from "@/lib/auth-gate";
import { purgeAppCaches } from "@/lib/app-refresh";

export const Route = createFileRoute("/auth")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>) => ({
    e: typeof search["e"] === "string" ? (search["e"] as string) : undefined,
    primeiro: search["primeiro"] === "1" || search["primeiro"] === 1 || search["primeiro"] === true,
  }),
  head: () => ({
    meta: [
      { title: "Entrar — PoolFlux" },
      { name: "description", content: "Acesse a plataforma PoolFlux para conduzir imersões comerciais, acompanhar performance de representantes e consultar o BI de clientes." },
      { property: "og:title", content: "Entrar — PoolFlux" },
      { property: "og:description", content: "Acesse a plataforma PoolFlux para conduzir imersões comerciais e acompanhar performance de representantes." },
      { property: "og:url", content: "https://poolflux.app/auth" },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: "https://poolflux.app/auth" }],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { e: emailConvite, primeiro } = Route.useSearch();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState(emailConvite ?? "");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [preparingFirstAccess, setPreparingFirstAccess] = useState(primeiro);

  useEffect(() => {
    let active = true;

    async function prepareAuth() {
      const { data } = await supabase.auth.getSession();
      if (!active) return;

      if (primeiro) {
        // Um convite pode ser aberto no navegador de quem o enviou. Nesse caso,
        // encerra apenas a sessão local para nunca reutilizar o usuário anterior.
        if (data.session) {
          await supabase.auth.signOut({ scope: "local" });
          clearAuthGateCache();
        }
        await purgeAppCaches();
        if (active) setPreparingFirstAccess(false);
        return;
      }

      if (data.session) navigate({ to: "/dashboard" });
    }

    prepareAuth();
    return () => { active = false; };
  }, [navigate, primeiro]);

  async function signIn() {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !password) {
      toast.error("Informe o e-mail e a senha para entrar.");
      return;
    }

    setLoading(true);
    clearAuthGateCache();
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });
      if (error) {
        // Registra tentativa suspeita/falha para o monitor de intrusão
        try {
          await supabase.rpc("log_auth_failure", {
            _email: normalizedEmail,
            _reason: error.message,
            _metadata: { user_agent: navigator.userAgent } as any,
          });
        } catch { /* silencioso */ }
        toast.error(error.message);
        return;
      }

      toast.success("Bem-vindo!");
      setLoading(false);
      void navigate({ to: "/dashboard", replace: true }).catch((navigationError) => {
        const message = navigationError instanceof Error
          ? navigationError.message
          : "Não foi possível abrir o painel.";
        toast.error(message);
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Não foi possível entrar. Tente novamente.";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  async function signUp() {
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { emailRedirectTo: window.location.origin + "/dashboard", data: { full_name: fullName } },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Cadastro criado. Verifique seu e-mail.");
  }

  async function signInGoogle() {
    try {
      const result: any = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/auth" });
      if (result?.redirected) return;
      // Some flows return an error shape even when session was set. Check session first.
      const { data: sess } = await supabase.auth.getSession();
      if (sess.session) {
        navigate({ to: "/dashboard" });
        return;
      }
      if (result?.error) {
        console.error("Google sign-in error:", result.error);
        const err = result.error;
        const msg = err?.message || err?.error_description || err?.error || (typeof err === "string" ? err : "Falha ao autenticar com Google");
        return toast.error(`Erro ao logar: ${msg}`);
      }
      toast.error("Erro ao logar: sessão não iniciada");
    } catch (e: any) {
      console.error("Google sign-in exception:", e);
      toast.error(`Erro ao logar: ${e?.message ?? String(e)}`);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <Link to="/" className="flex justify-center mb-8"><BrandLogo /></Link>
        <div className="surface rounded-2xl p-6 sm:p-8">
          <h1 className="text-2xl font-bold mb-1">Acessar plataforma</h1>
          <p className="text-sm text-muted-foreground mb-6">Imersão Comercial Pool</p>

          <Button onClick={signInGoogle} variant="outline" className="w-full mb-4">
            <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24"><path fill="#fff" d="M21.35 11.1h-9.17v2.96h5.27c-.23 1.5-1.7 4.4-5.27 4.4-3.17 0-5.76-2.62-5.76-5.86s2.59-5.86 5.76-5.86c1.8 0 3.01.77 3.7 1.43l2.52-2.43C16.65 4.27 14.6 3.3 12.18 3.3 6.96 3.3 2.73 7.5 2.73 12.6S6.96 21.9 12.18 21.9c6.5 0 9.17-4.55 9.17-7.99 0-.6-.07-1.05-.18-1.5z"/></svg>
            Continuar com Google
          </Button>
          <div className="relative my-4 text-center text-xs text-muted-foreground">
            <span className="bg-card px-2 relative z-10">ou com e-mail</span>
            <div className="absolute inset-y-1/2 inset-x-0 border-t border-border" />
          </div>

          <Tabs defaultValue="signin">
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="signin">Entrar</TabsTrigger>
              <TabsTrigger value="signup">Criar conta</TabsTrigger>
            </TabsList>
            <TabsContent value="signin" className="space-y-3 mt-4">
              {primeiro && (
                <div className="rounded-lg border border-primary/30 bg-primary/10 p-3 text-xs text-foreground">
                  <strong>Primeiro acesso.</strong> Informe a senha temporária que você recebeu. Logo após entrar,
                  você definirá a sua própria senha.
                </div>
              )}
              <div><Label>E-mail</Label><Input type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} disabled={loading || preparingFirstAccess} /></div>
              <div>
                <Label>{primeiro ? "Senha temporária" : "Senha"}</Label>
                <Input
                  type="password"
                  autoComplete="current-password"
                  autoFocus={primeiro}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") signIn(); }}
                  disabled={loading || preparingFirstAccess}
                />
              </div>
              <Button onClick={signIn} disabled={loading || preparingFirstAccess} className="w-full">
                {(loading || preparingFirstAccess) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Entrar
              </Button>
            </TabsContent>
            <TabsContent value="signup" className="space-y-3 mt-4">
              <div><Label>Nome completo</Label><Input value={fullName} onChange={e => setFullName(e.target.value)} /></div>
              <div><Label>E-mail</Label><Input type="email" value={email} onChange={e => setEmail(e.target.value)} /></div>
              <div><Label>Senha</Label><Input type="password" value={password} onChange={e => setPassword(e.target.value)} /></div>
              <Button onClick={signUp} disabled={loading} className="w-full">
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Criar conta
              </Button>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
