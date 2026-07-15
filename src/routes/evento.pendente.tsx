import { createFileRoute, Link } from "@tanstack/react-router";
import { Clock } from "lucide-react";

export const Route = createFileRoute("/evento/pendente")({
  ssr: false,
  head: () => ({ meta: [{ title: "Pagamento em análise — Evento" }, { name: "robots", content: "noindex" }] }),
  component: () => (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="surface rounded-2xl p-10 max-w-md text-center">
        <Clock className="h-12 w-12 text-amber-400 mx-auto mb-4" />
        <h1 className="text-2xl font-bold mb-2">Pagamento em análise</h1>
        <p className="text-sm text-muted-foreground mb-4">
          Assim que o Mercado Pago confirmar, sua vaga será liberada e você receberá um e-mail.
        </p>
        <Link to="/" className="text-cyan underline text-sm">Voltar</Link>
      </div>
    </div>
  ),
});
