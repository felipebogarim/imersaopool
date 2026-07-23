import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/unsubscribe")({
  ssr: false,
  head: () => ({ meta: [{ title: "Cancelar assinatura — PoolFlux" }] }),
  component: UnsubscribePage,
});

type State = "loading" | "valid" | "invalid" | "already" | "success" | "error";

function UnsubscribePage() {
  const [state, setState] = useState<State>("loading");
  const [msg, setMsg] = useState<string>("");

  useEffect(() => {
    const token = new URL(window.location.href).searchParams.get("token");
    if (!token) { setState("invalid"); setMsg("Token ausente."); return; }
    fetch(`/email/unsubscribe?token=${encodeURIComponent(token)}`)
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) { setState("invalid"); setMsg(j.error ?? "Token inválido."); return; }
        if (j.valid === false && j.reason === "already_unsubscribed") { setState("already"); return; }
        if (j.valid) setState("valid");
        else { setState("invalid"); setMsg("Token inválido."); }
      })
      .catch(() => { setState("error"); setMsg("Erro de rede."); });
  }, []);

  async function confirm() {
    setState("loading");
    const token = new URL(window.location.href).searchParams.get("token")!;
    const r = await fetch("/email/unsubscribe", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token }),
    });
    const j = await r.json();
    if (j.success) setState("success");
    else if (j.reason === "already_unsubscribed") setState("already");
    else { setState("error"); setMsg(j.error ?? "Falha ao cancelar."); }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="max-w-md w-full rounded-lg border border-border bg-card p-8 text-center">
        <h1 className="text-xl font-semibold text-foreground mb-2">Cancelar assinatura</h1>
        {state === "loading" && <p className="text-muted-foreground">Verificando…</p>}
        {state === "valid" && (
          <>
            <p className="text-sm text-muted-foreground mb-6">
              Confirme que deseja parar de receber notificações por e-mail.
            </p>
            <button onClick={confirm} className="rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium">
              Confirmar cancelamento
            </button>
          </>
        )}
        {state === "success" && <p className="text-emerald-600">Assinatura cancelada com sucesso.</p>}
        {state === "already" && <p className="text-muted-foreground">Este endereço já estava descadastrado.</p>}
        {state === "invalid" && <p className="text-destructive">{msg || "Link inválido."}</p>}
        {state === "error" && <p className="text-destructive">{msg || "Ocorreu um erro."}</p>}
      </div>
    </div>
  );
}
