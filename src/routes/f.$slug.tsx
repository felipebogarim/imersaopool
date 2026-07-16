import { createFileRoute, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormRenderer } from "@/components/FormRenderer";
import { FormSchemaSchema, type FormSchema } from "@/lib/form-schema";
import { toast } from "sonner";

type LoaderData = { id: string; title: string; schema: FormSchema };

export const Route = createFileRoute("/f/$slug")({
  ssr: false,
  loader: async ({ params }): Promise<LoaderData> => {
    const { data, error } = await supabase.rpc("get_active_form_by_slug", { _slug: params.slug });
    if (error) throw new Error(error.message);
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) throw notFound();
    const parsed = FormSchemaSchema.safeParse((row as any).schema);
    return {
      id: (row as any).id as string,
      title: (row as any).title as string,
      schema: parsed.success ? parsed.data : { fields: [] },
    };
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: loaderData ? `${loaderData.title}` : "Formulário" },
      { name: "robots", content: "noindex" },
    ],
  }),
  errorComponent: () => <PublicShell><p className="text-center text-muted-foreground">Não foi possível carregar este formulário.</p></PublicShell>,
  notFoundComponent: () => <PublicShell><p className="text-center text-muted-foreground">Formulário não encontrado ou desativado.</p></PublicShell>,
  component: PublicForm,
});

function PublicShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b py-4">
        <div className="max-w-2xl mx-auto px-4">
          <p className="text-sm font-semibold tracking-tight">PoolFlux Forms</p>
        </div>
      </header>
      <main className="flex-1 py-8">
        <div className="max-w-2xl mx-auto px-4">{children}</div>
      </main>
    </div>
  );
}

function PublicForm() {
  const data = Route.useLoaderData();
  const [sent, setSent] = useState(false);

  async function submit(answers: Record<string, unknown>) {
    const { error } = await supabase.rpc("submit_form_response", {
      _slug: (window.location.pathname.split("/f/")[1] ?? "").replace(/\/$/, ""),
      _answers: answers as any,
      _user_agent: navigator.userAgent,
    });
    if (error) {
      toast.error(error.message ?? "Não foi possível enviar");
      throw error;
    }
    setSent(true);
  }

  return (
    <PublicShell>
      <Card>
        <CardHeader>
          <CardTitle>{data.title}</CardTitle>
        </CardHeader>
        <CardContent>
          {sent ? (
            <div className="text-center py-8">
              <p className="text-lg font-semibold">Resposta enviada</p>
              <p className="text-sm text-muted-foreground mt-1">Obrigado por participar.</p>
            </div>
          ) : (
            <FormRenderer schema={data.schema} onSubmit={submit} />
          )}
        </CardContent>
      </Card>
    </PublicShell>
  );
}
