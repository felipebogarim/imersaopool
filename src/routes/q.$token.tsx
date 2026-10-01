/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/q/$token")({ component: PublicQuestionnaire });

function PublicQuestionnaire() {
  const { token } = Route.useParams();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [sent, setSent] = useState(false);
  const [saving, setSaving] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ["public-gro-questionnaire", token],
    queryFn: async () => {
      const { data: result, error } = await (supabase as any).rpc("gro_get_questionnaire_public", {
        _token: token,
      });
      if (error) throw error;
      return result;
    },
  });
  const questions = Array.isArray(data?.questions) ? data.questions : [];

  async function submit() {
    setSaving(true);
    const { error } = await (supabase as any).rpc("gro_submit_questionnaire", {
      _token: token,
      _answers: answers,
      _source: "link",
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    setSent(true);
  }

  if (isLoading)
    return (
      <main className="grid min-h-screen place-items-center bg-slate-50 p-4">Carregando…</main>
    );
  if (!data)
    return (
      <main className="grid min-h-screen place-items-center bg-slate-50 p-4">
        <Card className="max-w-md">
          <CardContent className="p-8 text-center">
            <h1 className="text-xl font-semibold">Questionário indisponível</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              O link expirou, ainda não foi aberto ou a aplicação foi encerrada.
            </p>
          </CardContent>
        </Card>
      </main>
    );
  if (sent)
    return (
      <main className="grid min-h-screen place-items-center bg-slate-50 p-4">
        <Card className="max-w-md">
          <CardContent className="p-8 text-center">
            <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-teal-600" />
            <h1 className="text-xl font-semibold">Resposta registrada</h1>
            <p className="mt-2 text-sm text-muted-foreground">Obrigado pela participação.</p>
          </CardContent>
        </Card>
      </main>
    );

  return (
    <main className="min-h-screen bg-slate-50 p-4 sm:p-8">
      <Card className="mx-auto max-w-2xl">
        <CardHeader>
          <CardTitle>{data.name}</CardTitle>
          <p className="text-sm text-muted-foreground">{data.description}</p>
        </CardHeader>
        <CardContent className="space-y-5">
          {questions.length ? (
            questions.map((question: any, index: number) => {
              const key = String(question.id ?? index);
              return (
                <div key={key} className="space-y-1">
                  <Label>
                    {index + 1}. {question.label ?? question.text}
                  </Label>
                  {question.type === "textarea" ? (
                    <Textarea
                      value={answers[key] ?? ""}
                      onChange={(event) => setAnswers({ ...answers, [key]: event.target.value })}
                    />
                  ) : (
                    <Input
                      value={answers[key] ?? ""}
                      onChange={(event) => setAnswers({ ...answers, [key]: event.target.value })}
                    />
                  )}
                </div>
              );
            })
          ) : (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
              Este template ainda não possui perguntas oficiais importadas. Nenhuma resposta pode
              ser enviada até a configuração técnica.
            </div>
          )}
          <Button className="w-full" disabled={!questions.length || saving} onClick={submit}>
            {saving ? "Enviando…" : "Enviar respostas"}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            As respostas individuais são confidenciais e acessíveis somente à consultoria.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
