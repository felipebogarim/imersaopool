import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BrainChat } from "@/components/brain/BrainChat";
import { getBrainAccess } from "@/lib/brain.functions";

export const Route = createFileRoute("/_authenticated/inteligencia")({
  ssr: false,
  head: () => ({ meta: [{ title: "Inteligência Comercial | PoolFlux" }] }),
  component: InteligenciaPage,
});

function InteligenciaPage() {
  const accessFn = useServerFn(getBrainAccess);
  const { data, isLoading, error } = useQuery({
    queryKey: ["brain-access"],
    queryFn: () => accessFn(),
  });
  if (isLoading) return <p className="p-6 text-sm text-muted-foreground">Verificando acesso…</p>;
  if (error || !data?.plataforma) {
    return (
      <p className="m-6 rounded-md border border-amber-400/50 bg-amber-50 p-4 text-sm dark:bg-amber-950/30">
        {data?.motivo ?? "Você não tem acesso à Inteligência Comercial."}
      </p>
    );
  }
  return (
    <div className="p-4">
      <BrainChat iface="plataforma" />
    </div>
  );
}
