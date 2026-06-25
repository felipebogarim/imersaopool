import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BrandLogo } from "@/components/Brand";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { VoiceTextarea } from "@/components/VoiceInput";
import { FieldHelp } from "@/components/FieldHelp";
import { REP_PUBLIC_HELP } from "@/lib/field-help-texts";
import { toast } from "sonner";
import { CheckCircle2, Loader2 } from "lucide-react";

export const Route = createFileRoute("/r/$token")({
  ssr: false,
  head: () => ({ meta: [{ title: "Formulário do Representante — PoolFlux" }] }),
  component: PublicRepForm,
});

const QUESTIONS = [
  { key: "percepcao_marca", q: "Como o cliente percebe a nossa marca hoje?", help: REP_PUBLIC_HELP.marca },
  { key: "marcas_concorrentes", q: "Quais outras marcas prevalecem na loja? Quais concorrentes têm maior presença?", help: REP_PUBLIC_HELP.concorrentes },
  { key: "oportunidades", q: "Quais são nossas maiores oportunidades nesse cliente?", help: REP_PUBLIC_HELP.oportunidades },
  { key: "ameacas", q: "Quais são nossas maiores ameaças nesse cliente?", help: REP_PUBLIC_HELP.ameacas },
  { key: "acoes_faturamento", q: "O que pode ser feito para ampliar o faturamento?", help: REP_PUBLIC_HELP.faturamento },
  { key: "cuidados", q: "O que precisamos tomar cuidado nessa conta?", help: REP_PUBLIC_HELP.cuidados },
] as const;

function PublicRepForm() {
  const { token } = Route.useParams();
  const [info, setInfo] = useState<any>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.rpc("get_immersion_by_token", { _token: token });
      setLoading(false);
      if (error || !data || data.length === 0) return;
      setInfo(data[0]);
      if (data[0].already_submitted) setDone(true);
    })();
  }, [token]);

  async function submit() {
    setSubmitting(true);
    const { error } = await supabase.rpc("submit_representative_input", { _token: token, _data: form });
    setSubmitting(false);
    if (error) return toast.error(error.message);
    setDone(true);
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-cyan" /></div>;
  }
  if (!info) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="surface rounded-2xl p-8 max-w-md text-center">
          <h1 className="text-xl font-bold mb-2">Link inválido ou expirado</h1>
          <p className="text-sm text-muted-foreground">Solicite um novo link ao agente responsável.</p>
        </div>
      </div>
    );
  }
  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="surface rounded-2xl p-10 max-w-md text-center">
          <CheckCircle2 className="h-12 w-12 text-cyan mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Obrigado!</h1>
          <p className="text-sm text-muted-foreground">Sua contribuição foi recebida e estará disponível para a equipe.</p>
        </div>
      </div>
    );
  }
  return (
    <div className="min-h-screen py-10 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="flex justify-center mb-8"><BrandLogo /></div>
        <div className="surface rounded-2xl p-8">
          <div className="text-xs uppercase tracking-widest text-cyan mb-2">Visão prévia do representante</div>
          <h1 className="text-2xl font-bold mb-1">{info.titulo}</h1>
          <p className="text-sm text-muted-foreground mb-8">
            Cliente: <span className="text-foreground">{info.client_name}</span>
            {info.representative_name && <> • {info.representative_name}</>}
          </p>

          <div className="space-y-5">
            <div>
              <Label className="mb-1.5 block">Comentários gerais (opcional)</Label>
              <FieldHelp text={REP_PUBLIC_HELP.texto_livre} withMediaSuffix={false} />
              <Textarea rows={3} value={form.texto_livre ?? ""} onChange={e => setForm(f => ({ ...f, texto_livre: e.target.value }))} />
            </div>
            {QUESTIONS.map(({ key, q, help }) => (
              <div key={key}>
                <Label className="mb-1.5 block text-sm">{q}</Label>
                <FieldHelp text={help} withMediaSuffix={false} />
                <Textarea rows={3} value={form[key] ?? ""} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} />
              </div>
            ))}
          </div>

          <div className="mt-8 flex justify-end">
            <Button onClick={submit} disabled={submitting} size="lg">
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Enviar respostas
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
