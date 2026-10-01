/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useGroContext } from "@/hooks/useGroContext";
import { supabase } from "@/integrations/supabase/client";

const db = supabase as any;
export const Route = createFileRoute("/_authenticated/gro/configuracoes")({ component: Config });
function Config() {
  const { data: context } = useGroContext();
  const { data = [] } = useQuery({
    queryKey: ["gro-questionnaire-templates"],
    enabled: !!context?.isConsultant,
    queryFn: async () => {
      const { data, error } = await db
        .from("gro_questionnaire_templates")
        .select("*")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
  if (!context?.isConsultant)
    return <div className="p-8 text-center">Configurações restritas à consultoria.</div>;
  return (
    <div className="mx-auto max-w-5xl p-4 sm:p-8">
      <h1 className="text-2xl font-bold">Configurações GRO NR1</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Modelos técnicos versionados e parâmetros de aplicação.
      </p>
      <div className="mt-6 space-y-3">
        {data.map((item: any) => (
          <Card key={item.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">
                  {item.name} · v{item.version}
                </CardTitle>
                <Badge variant={item.technical_parameters_ready ? "default" : "outline"}>
                  {item.technical_parameters_ready
                    ? "Parâmetros validados"
                    : "Aguardando importação"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {item.description || "Sem descrição"} · {item.question_count} perguntas
            </CardContent>
          </Card>
        ))}
        {!data.length && (
          <Card>
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              Nenhum modelo oficial importado. Crie a estrutura em Questionários sem fabricar
              metodologia.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
