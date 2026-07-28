import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { PACOTES, isPacoteId, type PacoteId } from "@/lib/mp-config";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

const searchSchema = z.object({
  pacote: z.string().optional().transform((v) => (v && isPacoteId(v) ? v : "completa")),
});

export const Route = createFileRoute("/evento/checkout")({
  ssr: false,
  validateSearch: (search) => searchSchema.parse(search),
  head: () => ({
    meta: [
      { title: "Garanta sua vaga — PoolFlux" },
      { name: "description", content: "Escolha sua experiência e finalize a inscrição via Mercado Pago (Pix ou cartão em até 12x)." },
      { property: "og:title", content: "Garanta sua vaga — PoolFlux" },
      { property: "og:description", content: "Escolha sua experiência e finalize a inscrição via Mercado Pago (Pix ou cartão em até 12x)." },
      { property: "og:url", content: "https://poolflux.app/evento/checkout" },
      { property: "og:type", content: "website" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: CheckoutPage,
});

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function CheckoutPage() {
  const search = Route.useSearch();
  const [pacoteId, setPacoteId] = useState<PacoteId>(search.pacote as PacoteId);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const pacote = PACOTES[pacoteId];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      const resp = await fetch("/api/public/mp/create-preference", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pacote: pacoteId, nome, email, telefone: telefone || null }),
      });
      const json = await resp.json();
      if (!resp.ok) throw new Error(json?.error ?? "Falha ao gerar cobrança");
      window.location.href = json.init_point as string;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro inesperado");
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen py-10 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="surface rounded-2xl p-8">
          <div className="text-xs uppercase tracking-widest text-cyan mb-2">Inscrição</div>
          <h1 className="text-2xl font-bold mb-1">Garanta sua vaga</h1>
          <p className="text-sm text-muted-foreground mb-6">
            Escolha a experiência, preencha seus dados e finalize o pagamento pelo Mercado Pago (Pix ou cartão em até 12x).
          </p>

          <form onSubmit={submit} className="space-y-5">
            <div className="space-y-2">
              <Label>Experiência escolhida</Label>
              <div className="grid gap-2">
                {(Object.values(PACOTES)).map((p) => (
                  <label
                    key={p.id}
                    className={`flex items-start gap-3 rounded-xl border p-4 cursor-pointer transition ${
                      pacoteId === p.id ? "border-cyan bg-cyan/5" : "border-border hover:border-muted-foreground/40"
                    }`}
                  >
                    <input
                      type="radio"
                      name="pacote"
                      value={p.id}
                      checked={pacoteId === p.id}
                      onChange={() => setPacoteId(p.id)}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <div className="flex justify-between gap-3">
                        <div className="font-semibold">{p.titulo}</div>
                        <div className="font-semibold text-cyan">{BRL.format(p.valor)}</div>
                      </div>
                      <div className="text-xs text-muted-foreground">{p.periodo}</div>
                      <div className="text-xs text-muted-foreground mt-1">{p.descricao}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label htmlFor="nome">Nome completo</Label>
                <Input id="nome" required minLength={2} value={nome} onChange={(e) => setNome(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="email">E-mail</Label>
                <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="telefone">Telefone (opcional)</Label>
                <Input id="telefone" type="tel" value={telefone} onChange={(e) => setTelefone(e.target.value)} />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <div className="text-sm">
                Total: <span className="font-semibold text-foreground">{BRL.format(pacote.valor)}</span>
              </div>
              <Button type="submit" size="lg" disabled={submitting}>
                {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Ir para o pagamento
              </Button>
            </div>
          </form>
        </div>
        <p className="text-center text-xs text-muted-foreground mt-4">
          Você será redirecionado ao Mercado Pago. Voltar para{" "}
          <Link to="/" className="underline">página inicial</Link>.
        </p>
      </div>
    </div>
  );
}
