import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { PACOTES, isPacoteId, type PacoteId } from "@/lib/mp-config";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

const searchSchema = z.object({
  pacote: z.string().optional().transform((v) => (v && isPacoteId(v) ? v : "umdia")),
  resultado: z.enum(["sucesso", "pendente", "falha"]).optional(),
  order: z.string().uuid().optional(),
});

export const Route = createFileRoute("/_authenticated/admin/evento-checkout-teste")({
  validateSearch: (search) => searchSchema.parse(search),
  head: () => ({
    meta: [
      { title: "[TESTE] Checkout do evento — Admin" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: CheckoutTestePage,
});

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function ResultadoBanner({ tipo, orderId }: { tipo: "sucesso" | "pendente" | "falha"; orderId?: string }) {
  const cores = {
    sucesso: "border-emerald-500/40 bg-emerald-500/10 text-emerald-200",
    pendente: "border-amber-500/40 bg-amber-500/10 text-amber-200",
    falha: "border-red-500/40 bg-red-500/10 text-red-200",
  } as const;
  const titulo = {
    sucesso: "Pagamento de TESTE aprovado",
    pendente: "Pagamento de TESTE pendente",
    falha: "Pagamento de TESTE falhou",
  }[tipo];
  return (
    <div className={`rounded-xl border p-4 mb-6 ${cores[tipo]}`}>
      <div className="font-semibold">{titulo}</div>
      {orderId && <div className="text-xs opacity-80 mt-1">Pedido de teste: {orderId}</div>}
    </div>
  );
}

function CheckoutTestePage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const [checkingRole, setCheckingRole] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [pacoteId, setPacoteId] = useState<PacoteId>(search.pacote as PacoteId);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const pacote = PACOTES[pacoteId];

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate({ to: "/auth" }); return; }
      const { data } = await supabase
        .from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
      setIsAdmin(!!data);
      setCheckingRole(false);
    })();
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Sessão expirada. Faça login novamente.");
      const resp = await fetch("/api/public/mp/test/create-preference", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ pacote: pacoteId, nome, email, telefone: telefone || null }),
      });
      const json = await resp.json();
      if (!resp.ok) throw new Error(json?.error ?? "Falha ao gerar cobrança de teste");
      window.location.href = json.init_point as string;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro inesperado");
      setSubmitting(false);
    }
  }

  if (checkingRole) {
    return (
      <div className="min-h-[60vh] grid place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!isAdmin) {
    return (
      <div className="min-h-[60vh] grid place-items-center px-4">
        <div className="surface rounded-2xl p-8 max-w-md text-center">
          <h1 className="text-lg font-semibold mb-2">Acesso restrito</h1>
          <p className="text-sm text-muted-foreground">
            Esta página é exclusiva para administradores validarem a integração de pagamento em ambiente de teste.
          </p>
          <Link to="/dashboard" className="mt-4 inline-block underline text-sm">Voltar</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-10 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="surface rounded-2xl p-8">
          <div className="text-xs uppercase tracking-widest text-amber-400 mb-2">Ambiente de TESTE — Mercado Pago</div>
          <h1 className="text-2xl font-bold mb-1">Checkout de teste</h1>
          <p className="text-sm text-muted-foreground mb-6">
            Este fluxo utiliza credenciais e webhooks de <strong>teste</strong> e grava em <code>event_orders_test</code>.
            Nenhum pedido produtivo é afetado.
          </p>

          {search.resultado && <ResultadoBanner tipo={search.resultado} orderId={search.order} />}

          <form onSubmit={submit} className="space-y-5">
            <div className="space-y-2">
              <Label>Experiência</Label>
              <div className="grid gap-2">
                {Object.values(PACOTES).map((p) => (
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
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label htmlFor="nome">Nome (comprador de teste)</Label>
                <Input id="nome" required minLength={2} value={nome} onChange={(e) => setNome(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="email">E-mail (comprador de teste)</Label>
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
                Iniciar pagamento de teste
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
