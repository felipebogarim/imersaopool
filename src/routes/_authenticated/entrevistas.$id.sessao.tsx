import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ChapterCapture } from "@/components/ChapterCapture";

export const Route = createFileRoute("/_authenticated/entrevistas/$id/sessao")({
  head: () => ({ meta: [{ title: "Sessão — PoolFlux" }] }),
  component: SessaoCapture,
});

function SessaoCapture() {
  const { id } = Route.useParams();

  const { data: interview } = useQuery({
    queryKey: ["interview-sessao", id],
    queryFn: async () =>
      (await supabase.from("interviews").select("id, roteiro_id, entrevistado_nome").eq("id", id).maybeSingle()).data,
  });

  if (!interview) return <p className="text-muted-foreground p-8">Carregando...</p>;
  if (!interview.roteiro_id) {
    return (
      <div className="surface rounded-xl p-6 text-sm text-muted-foreground">
        Esta entrevista não tem roteiro vinculado — vincule um roteiro para capturar por capítulos.
      </div>
    );
  }

  return <ChapterCapture sessaoId={interview.id} roteiroId={interview.roteiro_id} />;
}
