import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { BrandLogo, PoolFlowLogo } from "@/components/Brand";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { clearAuthGateCache } from "@/lib/auth-gate";
import { purgeAppCaches } from "@/lib/app-refresh";
import { firstAccessDestination } from "@/lib/first-access-redirect";
import { resolveRepInviteSession } from "@/lib/rep-metas-access";

export const Route = createFileRoute("/auth")({
  ssr: false,
  validateSearch: (
    search: Record<string, unknown>,
  ): { e?: string; primeiro?: boolean; conviteRep?: boolean; next?: string } => ({
    e: search.e as string | undefined,
    primeiro: search.primeiro === "1" || search.primeiro === 1 || search.primeiro === true,
    conviteRep: search.conviteRep === "1" || search.conviteRep === 1 || search.conviteRep === true,
    next: typeof search.next === "string" ? search.next : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Entrar — PoolFlux" },
      {
        name: "description",
        content:
          "Acesse a plataforma PoolFlux para conduzir imersões comerciais, acompanhar performance de representantes e consultar o BI de clientes.",
      },
      { property: "og:title", content: "Entrar — PoolFlux" },
      {
        property: "og:description",
        content:
          "Acesse a plataforma PoolFlux para conduzir imersões comerciais e acompanhar performance de representantes.",
      },
      { property: "og:url", content: "https://poolflux.app/auth" },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: "https://poolflux.app/auth" }],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { e: emailConvite, primeiro, conviteRep, next } = Route.useSearch();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState(emailConvite ?? "");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [preparingAccess, setPreparingAccess] = useState(primeiro || conviteRep);
  const [requestingRecovery, setRequestingRecovery] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
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
        if (active) setPreparingAccess(false);
        return;
      }

      if (conviteRep) {
        const action = resolveRepInviteSession(data.session?.user.email, emailConvite);
        if (action === "open_destination") {
          window.location.replace(firstAccessDestination(next));
          return;
        }
        if (action === "switch_account") {
          await supabase.auth.signOut({ scope: "local" });
          clearAuthGateCache();
        }
        await purgeAppCaches();
        if (active) setPreparingAccess(false);
        return;
      }

      if (data.session) window.location.replace(next ? firstAccessDestination(next) : "/home");
    }

    prepareAuth();
    return () => {
      active = false;
    };
  }, [conviteRep, emailConvite, navigate, next, primeiro]);

  async function signIn() {
    const normalizedEmail = email.trim().toLowerCase();
    const recipientEmail = String(emailConvite ?? "")
      .trim()
      .toLowerCase();
    if (!normalizedEmail || !password) {
      toast.error("Informe o e-mail e a senha para entrar.");
      return;
    }
    if (conviteRep && (!recipientEmail || normalizedEmail !== recipientEmail)) {
      toast.error("Entre com o e-mail destinatário deste convite.");
      return;
    }

    setLoading(true);
    clearAuthGateCache();
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });
      if (error) {
        // Registra tentativa suspeita/falha para o monitor de intrusão
        try {
          await supabase.rpc("log_auth_failure", {
            _email: normalizedEmail,
            _reason: error.message,
            _metadata: { user_agent: navigator.userAgent },
          });
        } catch {
          /* silencioso */
        }
        toast.error(error.message);
        return;
      }

      if (
        conviteRep &&
        resolveRepInviteSession(data.user?.email, recipientEmail) !== "open_destination"
      ) {
        await supabase.auth.signOut({ scope: "local" });
        clearAuthGateCache();
        await purgeAppCaches();
        toast.error("Este convite pertence a outro usuário.");
        return;
      }

      toast.success("Bem-vindo!");
      setLoading(false);
      if (next) {
        window.location.replace(firstAccessDestination(next));
        return;
      }
      void navigate({ to: "/home", replace: true }).catch((navigationError) => {
        const message =
          navigationError instanceof Error
            ? navigationError.message
            : "Não foi possível abrir o painel.";
        toast.error(message);
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Não foi possível entrar. Tente novamente.";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  async function signUp() {
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin + "/home", data: { full_name: fullName } },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Cadastro criado. Verifique seu e-mail.");
  }

  async function signInGoogle() {
    try {
      const redirect = new URL("/auth", window.location.origin);
      if (next) redirect.searchParams.set("next", firstAccessDestination(next));
      if (conviteRep && emailConvite) {
        redirect.searchParams.set("conviteRep", "1");
        redirect.searchParams.set("e", emailConvite);
      }
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: redirect.toString(),
      });
      if (result?.redirected) return;
      // Some flows return an error shape even when session was set. Check session first.
      const { data: sess } = await supabase.auth.getSession();
      if (sess.session) {
        window.location.replace(next ? firstAccessDestination(next) : "/home");
        return;
      }
      if (result?.error) {
        console.error("Google sign-in error:", result.error);
        const err = result.error;
        const msg = err instanceof Error ? err.message : "Falha ao autenticar com Google";
        return toast.error(`Erro ao logar: ${msg}`);
      }
      toast.error("Erro ao logar: sessão não iniciada");
    } catch (e) {
      console.error("Google sign-in exception:", e);
      toast.error(`Erro ao logar: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  async function requestPasswordRecovery() {
    const normalizedEmail = email.trim().toLowerCase();
    const recipientEmail = String(emailConvite ?? "")
      .trim()
      .toLowerCase();
    if (!normalizedEmail) {
      toast.error("Informe o e-mail para recuperar a senha.");
      return;
    }
    if (conviteRep && (!recipientEmail || normalizedEmail !== recipientEmail)) {
      toast.error("Recupere a senha do e-mail destinatário deste convite.");
      return;
    }

    const redirect = new URL("/recuperar-senha", window.location.origin);
    redirect.searchParams.set("e", normalizedEmail);
    if (next) redirect.searchParams.set("next", firstAccessDestination(next));
    setRequestingRecovery(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
        redirectTo: redirect.toString(),
      });
      if (error) throw error;
      toast.success("Enviamos as instruções de recuperação para o seu e-mail.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível recuperar a senha.");
    } finally {
      setRequestingRecovery(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md text-center">
        <Link to="/" className="inline-flex justify-center mb-8">
          {mounted &&
          (emailConvite?.toLowerCase().includes("flow") ||
            emailConvite?.toLowerCase().includes("crm")) ? (
            <PoolFlowLogo className="h-12 w-auto" />
          ) : (
            <BrandLogo />
          )}
        </Link>
        <div className="surface rounded-2xl p-6 sm:p-8 text-left">
          <h1 className="text-2xl font-bold mb-1">Acessar plataforma</h1>
          <p className="text-sm text-muted-foreground mb-6">Imersão Comercial Pool</p>

          {!conviteRep && (
            <>
              <Button
                onClick={signInGoogle}
                variant="outline"
                className="w-full mb-4"
                disabled={preparingAccess}
              >
                <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                  <path
                    fill="#fff"
                    d="M21.35 11.1h-9.17v2.96h5.27c-.23 1.5-1.7 4.4-5.27 4.4-3.17 0-5.76-2.62-5.76-5.86s2.59-5.86 5.76-5.86c1.8 0 3.01.77 3.7 1.43l2.52-2.43C16.65 4.27 14.6 3.3 12.18 3.3 6.96 3.3 2.73 7.5 2.73 12.6S6.96 21.9 12.18 21.9c6.5 0 9.17-4.55 9.17-7.99 0-.6-.07-1.05-.18-1.5z"
                  />
                </svg>
                Continuar com Google
              </Button>
              <div className="relative my-4 text-center text-xs text-muted-foreground">
                <span className="bg-card px-2 relative z-10">ou com e-mail</span>
                <div className="absolute inset-y-1/2 inset-x-0 border-t border-border" />
              </div>
            </>
          )}

          <Tabs defaultValue="signin">
            {!conviteRep && (
              <TabsList className="grid grid-cols-2 w-full">
                <TabsTrigger value="signin">Entrar</TabsTrigger>
                <TabsTrigger value="signup">Criar conta</TabsTrigger>
              </TabsList>
            )}
            <TabsContent value="signin" className="space-y-3 mt-4">
              {primeiro && (
                <div className="rounded-lg border border-primary/30 bg-primary/10 p-3 text-xs text-foreground">
                  <strong>Primeiro acesso.</strong> Informe a senha temporária que você recebeu.
                  Logo após entrar, você definirá a sua própria senha.
                </div>
              )}
              <div>
                <Label>E-mail</Label>
                <Input
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading || preparingAccess || (conviteRep && Boolean(emailConvite))}
                />
              </div>
              <div>
                <Label>{primeiro ? "Senha temporária" : "Senha"}</Label>
                <Input
                  type="password"
                  autoComplete="current-password"
                  autoFocus={primeiro}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") signIn();
                  }}
                  disabled={loading || preparingAccess}
                />
              </div>
              {!primeiro && (
                <button
                  type="button"
                  onClick={() => void requestPasswordRecovery()}
                  disabled={loading || preparingAccess || requestingRecovery}
                  className="text-xs font-medium text-primary hover:underline disabled:opacity-50"
                >
                  {requestingRecovery ? "Enviando instruções…" : "Esqueci minha senha"}
                </button>
              )}
              <Button onClick={signIn} disabled={loading || preparingAccess} className="w-full">
                {(loading || preparingAccess) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{" "}
                Entrar
              </Button>
            </TabsContent>
            {!conviteRep && (
              <TabsContent value="signup" className="space-y-3 mt-4">
                <div>
                  <Label>Nome completo</Label>
                  <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
                </div>
                <div>
                  <Label>E-mail</Label>
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div>
                  <Label>Senha</Label>
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <Button onClick={signUp} disabled={loading} className="w-full">
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Criar conta
                </Button>
              </TabsContent>
            )}
          </Tabs>
        </div>
      </div>
    </div>
  );
}
