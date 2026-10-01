/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from "react";
import { BookOpen } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";

const db = supabase as any;
const SECTIONS = [
  ["who_we_are", "Quem somos hoje"],
  ["people_practices", "O que já fazemos pelas pessoas"],
  ["strengths", "Características que aparecem com força"],
  ["development", "Pontos que queremos desenvolver"],
  ["communication", "Insights para comunicação e cultura"],
  ["themes", "Possíveis temas para RH/Marketing"],
] as const;

export function GroCulture({ context, periodId, data, isConsultant }: any) {
  const qc = useQueryClient();
  const culture = data.culture[0];
  const [content, setContent] = useState<Record<string, string>>({});
  useEffect(() => setContent(culture?.content ?? {}), [culture?.content, culture?.id]);

  async function save(status = culture?.status ?? "draft") {
    const payload = {
      company_id: context.companyId,
      period_id: periodId,
      content,
      status,
      published_at:
        status === "published" ? new Date().toISOString() : (culture?.published_at ?? null),
    };
    const { error } = await db
      .from("gro_culture_reads")
      .upsert(payload, { onConflict: "period_id" });
    if (error) return toast.error(error.message);
    await qc.invalidateQueries({ queryKey: ["gro-workspace"] });
    toast.success(status === "published" ? "Nossa Cultura publicada" : "Leitura salva");
  }

  if (!isConsultant && !culture)
    return (
      <Card>
        <CardContent className="p-10 text-center">
          <BookOpen className="mx-auto mb-3 h-9 w-9 text-muted-foreground" />
          <h3 className="font-semibold">Nossa Cultura ainda não foi publicada</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Esta entrega complementar ficará disponível após revisão.
          </p>
        </CardContent>
      </Card>
    );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>Nossa Cultura</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Leitura editorial complementar · tempo estimado de 2 a 3 minutos
            </p>
          </div>
          <Badge variant="outline">{culture?.status ?? "rascunho"}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">
          Material de apoio para RH, endomarketing e cultura. Não é certificação, manifesto
          definitivo nem peça publicitária; pontos de atenção não são convertidos em elogios
          artificiais.
        </div>
        {SECTIONS.map(([key, label]) => (
          <section key={key}>
            {isConsultant ? (
              <>
                <Label>{label}</Label>
                <Textarea
                  className="mt-1 min-h-24"
                  value={content[key] ?? ""}
                  onChange={(event) => setContent({ ...content, [key]: event.target.value })}
                  placeholder="Escreva apenas com base em evidências validadas…"
                />
              </>
            ) : (
              <>
                <h3 className="font-semibold text-teal-800">{label}</h3>
                <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                  {content[key] || "Sem conteúdo publicado."}
                </p>
              </>
            )}
          </section>
        ))}
        {isConsultant && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => save()}>
              Salvar rascunho
            </Button>
            <Button onClick={() => save("published")}>Revisar e publicar</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
