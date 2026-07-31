import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ShieldAlert, ExternalLink, Loader2 } from "lucide-react";

const SESSION_KEY = "confidentiality_ack_v1";

export function ConfidentialityModal() {
  const [open, setOpen] = useState(false);
  const [checked, setChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function check() {
      const { data: s } = await supabase.auth.getSession();
      const session = s.session;
      if (!session?.user) return;
      // Aviso exibido apenas uma vez por usuário (persistido no banco + cache local).
      const key = `${SESSION_KEY}:${session.user.id}`;
      if (localStorage.getItem(key)) return;
      // Se o usuário já registrou ciência antes (em qualquer dispositivo), não exibir novamente.
      const { data: prev } = await supabase
        .from("terms_acceptances")
        .select("id")
        .eq("user_id", session.user.id)
        .eq("acceptance_type", "login_confidentiality_acknowledgement")
        .limit(1);
      if (prev && prev.length > 0) {
        localStorage.setItem(key, "1");
        return;
      }
      setOpen(true);
    }
    check();

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") {
        setChecked(false);
        check();
      }
      if (event === "SIGNED_OUT") setOpen(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") e.preventDefault(); };
    document.addEventListener("keydown", onKey, true);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.body.style.overflow = "";
    };
  }, [open]);

  async function confirm() {
    setSubmitting(true);
    setError(null);
    try {
      const { data: u } = await supabase.auth.getUser();
      const session = (await supabase.auth.getSession()).data.session;
      const sessionId = session?.access_token?.slice(-16);
      const { error: rpcErr } = await supabase.rpc("record_login_acknowledgement", {
        _session_id: sessionId ?? undefined,
        _user_agent: navigator.userAgent.slice(0, 500),
      });
      if (rpcErr) throw rpcErr;
      if (u.user) {
        localStorage.setItem(`${SESSION_KEY}:${u.user.id}`, "1");
      }
      setOpen(false);
    } catch (e: any) {
      setError(e?.message ?? "Não foi possível registrar sua ciência. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="conf-title"
        className="bg-background border border-border rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
      >
        <div className="p-6 sm:p-8">
          <div className="flex items-start gap-3 mb-4">
            <ShieldAlert className="h-7 w-7 text-destructive shrink-0 mt-1" />
            <h2 id="conf-title" className="text-lg sm:text-xl font-bold tracking-tight">
              AMBIENTE CONFIDENCIAL E RESTRITO
            </h2>
          </div>
          <div className="space-y-3 text-sm text-foreground/90 leading-relaxed">
            <p>
              Esta plataforma opera sob regime de confidencialidade estrita. É proibido revelar,
              solicitar, copiar, fotografar, gravar, transcrever, exportar ou compartilhar valores
              absolutos, metas nominais, faturamento, margens, custos, preços, volumes, resultados
              individuais ou qualquer outro dado empresarial direto.
            </p>
            <p>
              Todas as análises devem utilizar exclusivamente as faixas percentuais, classificações
              e informações agregadas disponibilizadas pela plataforma. Também é proibido tentar
              calcular, deduzir ou reconstruir os valores diretos que originaram as faixas
              apresentadas.
            </p>
            <p>
              Os dados protegidos não são disponibilizados nos painéis administrativos funcionais e
              seu acesso é limitado aos componentes técnicos estritamente necessários ao
              processamento autorizado.
            </p>
            <p>
              O acesso é individual, pessoal e intransferível. O compartilhamento de credenciais,
              capturas de tela, relatórios ou informações obtidas neste ambiente poderá provocar o
              bloqueio imediato do acesso e a responsabilização contratual e legal do usuário.
            </p>
            <p className="pt-1 font-medium">
              Ao prosseguir, declaro que li, compreendi e me comprometo a cumprir estas regras.
            </p>
          </div>

          <label className="flex items-start gap-3 mt-5 p-3 rounded-md border border-border bg-muted/30 cursor-pointer">
            <Checkbox
              checked={checked}
              onCheckedChange={(v) => setChecked(v === true)}
              className="mt-0.5"
            />
            <span className="text-sm">
              Estou ciente das regras de confidencialidade e proteção de dados.
            </span>
          </label>

          {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

          <div className="mt-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
              <a
                href="/termos-de-uso"
                target="_blank"
                rel="noopener"
                className="text-sm text-primary hover:underline inline-flex items-center gap-1"
              >
                <ExternalLink className="h-3.5 w-3.5" /> Consultar os Termos de Uso completos
              </a>
              <a
                href="/__l5e/assets-v1/b3cfe05f-1f3f-48bd-a147-7bb152e1800a/Relatorio_Final_Seguranca_Privacidade_Conformidade.pdf"
                target="_blank"
                rel="noopener"
                className="text-sm text-primary hover:underline inline-flex items-center gap-1"
              >
                <ExternalLink className="h-3.5 w-3.5" /> Entenda porque é seguro
              </a>
            </div>
            <Button
              onClick={confirm}
              disabled={!checked || submitting}
              className="w-full sm:w-auto"
            >
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              ESTOU CIENTE E DESEJO PROSSEGUIR
            </Button>
          </div>

        </div>
      </div>
    </div>
  );
}
