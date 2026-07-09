import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Check, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import { generatePerspectivasForSession } from "@/lib/generate-perspectivas.functions";

export const Route = createFileRoute("/_authenticated/entrevistas/$id/sessao")({
  head: () => ({ meta: [{ title: "Sessão — PoolFlux" }] }),
  component: SessaoCapture,
});

function SessaoCapture() {
  const { id } = Route.useParams();
  const qc = useQueryClient();

  const { data: interview } = useQuery({
    queryKey: ["interview-sessao", id],
    queryFn: async () =>
      (await supabase.from("interviews").select("id, roteiro_id, entrevistado_nome").eq("id", id).maybeSingle()).data,
  });

  const { data: capitulos = [] } = useQuery({
    queryKey: ["capitulos-of", interview?.roteiro_id],
    enabled: !!interview?.roteiro_id,
    queryFn: async () =>
      (
        await supabase
          .from("capitulos")
          .select("id, ordem, codigo, titulo, orientacao, hipotese, lente_default, campos_matriz")
          .eq("roteiro_id", interview!.roteiro_id!)
          .order("ordem")
      ).data ?? [],
  });

  const { data: respostas = [] } = useQuery({
    queryKey: ["sessao-capitulos", id],
    queryFn: async () =>
      (
        await supabase
          .from("sessao_capitulos")
          .select("id, capitulo_id, resposta_texto, status_revisao")
          .eq("sessao_id", id)
      ).data ?? [],
  });

  if (!interview) return <p className="text-muted-foreground p-8">Carregando...</p>;
  if (!interview.roteiro_id) {
    return (
      <div className="surface rounded-xl p-6 text-sm text-muted-foreground">
        Esta entrevista não tem roteiro vinculado — vincule um roteiro para capturar por capítulos.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="font-semibold text-lg">Captura por capítulos</h2>
      {capitulos.map((c: any) => {
        const existing = respostas.find((r: any) => r.capitulo_id === c.id);
        return (
          <CapituloBlock
            key={c.id}
            capitulo={c}
            sessaoId={id}
            existing={existing}
            onSaved={() => qc.invalidateQueries({ queryKey: ["sessao-capitulos", id] })}
          />
        );
      })}
    </div>
  );
}

function CapituloBlock({
  capitulo,
  sessaoId,
  existing,
  onSaved,
}: {
  capitulo: any;
  sessaoId: string;
  existing: any;
  onSaved: () => void;
}) {
  const [texto, setTexto] = useState(existing?.resposta_texto ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setTexto(existing?.resposta_texto ?? "");
  }, [existing?.id]);

  async function save() {
    setSaving(true);
    const payload: any = {
      sessao_id: sessaoId,
      capitulo_id: capitulo.id,
      resposta_texto: texto,
      origem: "humano",
    };
    let error;
    if (existing?.id) {
      ({ error } = await supabase.from("sessao_capitulos").update(payload).eq("id", existing.id));
    } else {
      ({ error } = await supabase.from("sessao_capitulos").insert(payload));
    }
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Capítulo salvo");
    onSaved();
  }

  return (
    <section className="surface rounded-xl p-5">
      <header className="flex items-start justify-between gap-4 mb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">#{capitulo.ordem}</span>
            <h3 className="font-medium">{capitulo.titulo}</h3>
            <Badge variant="outline" className="text-[10px]">{capitulo.lente_default}</Badge>
          </div>
          {capitulo.orientacao && (
            <p className="text-sm text-muted-foreground mt-1">{capitulo.orientacao}</p>
          )}
          {capitulo.hipotese && (
            <p className="text-xs italic text-muted-foreground mt-1">Hipótese: {capitulo.hipotese}</p>
          )}
        </div>
        {existing && (
          <Badge variant="secondary" className="shrink-0">
            <Check className="h-3 w-3 mr-1" /> registrado
          </Badge>
        )}
      </header>
      <Textarea
        rows={5}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder="Registre a resposta livre. A IA vai extrair as perspectivas depois."
      />
      <div className="flex justify-end mt-2">
        <Button size="sm" onClick={save} disabled={saving || !texto.trim()}>
          {saving ? "Salvando..." : existing ? "Atualizar" : "Salvar capítulo"}
        </Button>
      </div>
    </section>
  );
}
