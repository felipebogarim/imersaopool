import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/evento/sucesso")({
  ssr: false,
  head: () => ({ meta: [{ title: "Inscrição confirmada — Evento" }, { name: "robots", content: "noindex" }] }),
  component: () => (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="surface rounded-2xl p-10 max-w-md text-center">
        <CheckCircle2 className="h-12 w-12 text-cyan mx-auto mb-4" />
        <h1 className="text-2xl font-bold mb-2">Pagamento aprovado!</h1>
        <p className="text-sm text-muted-foreground mb-4">
          Sua vaga está garantida. Você receberá um e-mail de confirmação com os detalhes.
        </p>
        <Link to="/" className="text-cyan underline text-sm">Voltar</Link>
      </div>
    </div>
  ),
});
