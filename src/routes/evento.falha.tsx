import { createFileRoute, Link } from "@tanstack/react-router";
import { XCircle } from "lucide-react";

export const Route = createFileRoute("/evento/falha")({
  ssr: false,
  head: () => ({ meta: [{ title: "Pagamento não concluído — Evento" }, { name: "robots", content: "noindex" }] }),
  component: () => (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="surface rounded-2xl p-10 max-w-md text-center">
        <XCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
        <h1 className="text-2xl font-bold mb-2">Pagamento não concluído</h1>
        <p className="text-sm text-muted-foreground mb-4">
          Nenhuma cobrança foi realizada. Você pode tentar novamente escolhendo a experiência desejada.
        </p>
        <Link to="/evento/checkout" className="text-cyan underline text-sm">Tentar novamente</Link>
      </div>
    </div>
  ),
});
