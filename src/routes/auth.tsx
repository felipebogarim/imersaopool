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

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({ meta: [{ title: "Entrar — PoolFlux" }] }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard" });
    });
  }, [navigate]);

  async function signIn() {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Bem-vindo!");
    navigate({ to: "/dashboard" });
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
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/dashboard" });
    if (result.error) return toast.error(result.error.message);
    if (!result.redirected) navigate({ to: "/dashboard" });
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <Link to="/" className="flex justify-center mb-8"><BrandLogo /></Link>
        <div className="surface rounded-2xl p-8">
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
              <div><Label>E-mail</Label><Input type="email" value={email} onChange={e => setEmail(e.target.value)} /></div>
              <div><Label>Senha</Label><Input type="password" value={password} onChange={e => setPassword(e.target.value)} /></div>
              <Button onClick={signIn} disabled={loading} className="w-full">
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Entrar
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
