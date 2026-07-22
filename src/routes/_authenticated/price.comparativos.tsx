import { createFileRoute } from "@tanstack/react-router";
import { BarChart3 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/price/comparativos")({
  head: () => ({
    meta: [
      { title: "Comparativos | Price" },
      { name: "description", content: "Comparativos de preços entre competidores (em construção)." },
    ],
  }),
  component: ComparativosPage,
});

function ComparativosPage() {
  return (
    <div className="surface rounded-xl p-12 text-center space-y-3">
      <BarChart3 className="h-10 w-10 mx-auto text-muted-foreground" />
      <h2 className="text-lg font-semibold">Comparativos</h2>
      <p className="text-sm text-muted-foreground max-w-md mx-auto">
        Esta área será construída em breve. Aqui você poderá comparar tabelas
        de preços entre competidores, categorias e períodos.
      </p>
    </div>
  );
}
