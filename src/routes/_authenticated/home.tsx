import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/home")({
  head: () => ({
    meta: [
      { title: "Home — PoolFlux" },
      { name: "description", content: "Página inicial do PoolFlux." },
      { property: "og:title", content: "Home — PoolFlux" },
      { property: "og:type", content: "website" },
    ],
  }),
  component: HomeComponent,
});

function HomeComponent() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold">Home</h1>
      <p className="mt-4 text-muted-foreground">
        No menu, crie uma área na primeira posição com o o nome Home. Na sequencia, mandarei o conteúdo.
      </p>
    </div>
  );
}
