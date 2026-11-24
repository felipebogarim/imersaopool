import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { BrandMark } from "@/components/Brand";
import { Button } from "@/components/ui/button";
import { RepMetasCliente } from "@/components/performance-metas/RepMetasPortal";

// Portal do representante → metas de um cliente (link do convite de revisão de metas).
// O servidor só devolve clientes da carteira do representante logado.
export const Route = createFileRoute("/portal-rep_/metas/$rowId")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Metas do cliente | PoolFlux" }, { name: "robots", content: "noindex" }],
  }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/auth" });
  },
  component: RepMetasPage,
});

function RepMetasPage() {
  const { rowId } = Route.useParams();
  const navigate = useNavigate();
  async function signOut() {
    await supabase.auth.signOut();
    void navigate({ to: "/auth" });
  }
  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <BrandMark className="h-8 w-8" />
            <h1 className="text-base font-semibold leading-tight">Portal do Representante</h1>
          </div>
          <Button variant="outline" size="sm" onClick={() => void signOut()}>
            <LogOut className="mr-1 h-4 w-4" />
            Sair
          </Button>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-6">
        <RepMetasCliente rowId={rowId} />
      </main>
    </div>
  );
}
