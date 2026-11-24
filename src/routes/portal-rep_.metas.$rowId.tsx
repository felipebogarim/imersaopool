import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { RepMetasCliente } from "@/components/performance-metas/RepMetasPortal";
import { RepPortalChrome, useRepPortalData } from "@/components/rep-portal/RepPortalChrome";

// Portal do representante → metas de um cliente (link do convite de revisão de metas).
// O servidor só devolve clientes da carteira do representante logado. Mesmo cabeçalho e menu
// do portal; a aba "Metas" fica ativa e as demais levam à aba correspondente do portal.
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
  const { data, pendingCount, acceptedCount } = useRepPortalData();
  return (
    <div className="min-h-screen bg-muted/30">
      <RepPortalChrome
        activeTab="metas"
        repName={data?.rep.nome}
        pendingCount={pendingCount}
        acceptedCount={acceptedCount}
      />
      <main className="mx-auto max-w-6xl px-4 py-6">
        <RepMetasCliente rowId={rowId} />
      </main>
    </div>
  );
}
