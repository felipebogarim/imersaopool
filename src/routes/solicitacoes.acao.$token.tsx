import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { BrandMark } from "@/components/Brand";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  confirmInternalTicketAction,
  getInternalTicketActionInfo,
  type ActionInfoResult,
} from "@/lib/internal-tickets/public-actions.functions";

export const Route = createFileRoute("/solicitacoes/acao/$token")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Confirmar ação — Solicitações Internas PoolFlux" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PublicTicketActionPage,
});

const INVALID_REASON_LABEL: Record<string, string> = {
  not_found: "Este link não é válido.",
  used: "Este link já foi usado.",
  expired: "Este link expirou.",
};

function PublicTicketActionPage() {
  const { token } = Route.useParams();
  const loadFn = useServerFn(getInternalTicketActionInfo);
  const confirmFn = useServerFn(confirmInternalTicketAction);

  const [info, setInfo] = useState<ActionInfoResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<{ ticketNumber: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const result = await loadFn({ data: { token } });
        setInfo(result);
      } catch {
        setInfo({ valid: false, reason: "not_found" });
      } finally {
        setLoading(false);
      }
    })();
  }, [token, loadFn]);

  async function handleConfirm() {
    setSubmitting(true);
    setError(null);
    try {
      const result = await confirmFn({ data: { token, note: note.trim() || undefined } });
      setDone({ ticketNumber: result.ticketNumber });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível confirmar a ação.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border bg-card p-6 shadow-sm">
        <div className="mb-6 flex items-center gap-2">
          <BrandMark className="h-7" />
          <span className="text-xs uppercase tracking-widest text-muted-foreground">
            Solicitações Internas
          </span>
        </div>

        {loading && (
          <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" /> Carregando…
          </div>
        )}

        {!loading && info && !info.valid && (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <XCircle className="h-10 w-10 text-destructive" />
            <p className="text-sm text-muted-foreground">{INVALID_REASON_LABEL[info.reason]}</p>
          </div>
        )}

        {!loading && info && info.valid && done && (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <CheckCircle2 className="h-10 w-10 text-emerald-600" />
            <p className="text-sm font-medium">Ação confirmada.</p>
            <p className="text-xs text-muted-foreground">Ticket {done.ticketNumber}</p>
          </div>
        )}

        {!loading && info && info.valid && !done && (
          <div className="space-y-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                {info.ticketNumber} · {info.sectorName}
              </p>
              <h1 className="mt-1 text-lg font-semibold">{info.title}</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Status atual: {info.currentStatusLabel}
              </p>
            </div>

            {!info.applicable && !info.alreadyInTargetStatus ? (
              <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
                Esta ação não pode mais ser aplicada ao ticket no status atual.
              </p>
            ) : (
              <>
                <p className="text-sm">
                  Confirmar: <strong>{info.actionLabel}</strong>
                </p>
                {info.requiresText && (
                  <Textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Escreva sua resposta…"
                    rows={5}
                    autoFocus
                  />
                )}
                {error && <p className="text-sm text-destructive">{error}</p>}
                <Button
                  className="w-full"
                  disabled={submitting || (info.requiresText && !note.trim())}
                  onClick={handleConfirm}
                >
                  {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Confirmar
                </Button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
