import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { KeyRound, Loader2, Plus } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { createRepPortalAccess } from "@/lib/rep-portal.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

type Rep = {
  id: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  regiao: string | null;
  user_id?: string | null;
};

/** Cadastro rápido de representantes: o e-mail é o que permite enviar as sugestões. */
export function RepsPanel({
  open,
  onOpenChange,
  highlightRepId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  highlightRepId?: string | null;
}) {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [novo, setNovo] = useState({ nome: "", email: "", telefone: "", regiao: "" });

  const { data: reps = [], isLoading } = useQuery({
    queryKey: ["acoes-reps-reps"],
    enabled: open,
    queryFn: async (): Promise<Rep[]> => {
      // `user_id` só existe depois da migration do portal; sem ela, segue sem o vínculo.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = supabase as any;
      let res = await db
        .from("representatives")
        .select("id, nome, email, telefone, regiao, user_id")
        .order("nome");
      if (res.error)
        res = await db
          .from("representatives")
          .select("id, nome, email, telefone, regiao")
          .order("nome");
      if (res.error) throw res.error;
      return res.data as Rep[];
    },
  });

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return reps
      .filter(
        (r) => !t || r.nome.toLowerCase().includes(t) || (r.email ?? "").toLowerCase().includes(t),
      )
      .sort((a, b) => Number(b.id === highlightRepId) - Number(a.id === highlightRepId));
  }, [reps, q, highlightRepId]);

  const done = () => {
    void qc.invalidateQueries({ queryKey: ["acoes-reps-reps"] });
    void qc.invalidateQueries({ queryKey: ["acoes-reps"] });
  };

  const saveEmail = useMutation({
    mutationFn: async ({ id, email }: { id: string; email: string }) => {
      const e = email.trim().toLowerCase();
      if (e && !EMAIL_RE.test(e)) throw new Error("E-mail inválido.");
      const { error } = await supabase
        .from("representatives")
        .update({ email: e || null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      toast.success("E-mail salvo.");
      setDrafts((d) => {
        const { [v.id]: _omit, ...rest } = d;
        return rest;
      });
      done();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const accessFn = useServerFn(createRepPortalAccess);
  const access = useMutation({
    mutationFn: (repId: string) => accessFn({ data: { repId } }),
    onSuccess: (r) => {
      toast.success(`Convite enviado para ${r.email}.`);
      done();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const create = useMutation({
    mutationFn: async () => {
      const nome = novo.nome.trim();
      const email = novo.email.trim().toLowerCase();
      if (!nome) throw new Error("Informe o nome do representante.");
      if (!EMAIL_RE.test(email)) throw new Error("Informe um e-mail válido.");
      const { error } = await supabase.from("representatives").insert({
        nome,
        email,
        telefone: novo.telefone.trim() || null,
        regiao: novo.regiao.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Representante cadastrado.");
      setNovo({ nome: "", email: "", telefone: "", regiao: "" });
      done();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Representantes</DialogTitle>
          <DialogDescription>
            O e-mail é necessário para enviar as sugestões de ação. O representante não precisa ser
            usuário do sistema.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border p-3 space-y-2">
          <p className="text-sm font-medium">Novo representante</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <Input
              placeholder="Nome *"
              value={novo.nome}
              onChange={(e) => setNovo((p) => ({ ...p, nome: e.target.value }))}
            />
            <Input
              placeholder="E-mail *"
              value={novo.email}
              onChange={(e) => setNovo((p) => ({ ...p, email: e.target.value }))}
            />
            <Input
              placeholder="Telefone"
              value={novo.telefone}
              onChange={(e) => setNovo((p) => ({ ...p, telefone: e.target.value }))}
            />
            <Input
              placeholder="Região"
              value={novo.regiao}
              onChange={(e) => setNovo((p) => ({ ...p, regiao: e.target.value }))}
            />
          </div>
          <Button size="sm" onClick={() => create.mutate()} disabled={create.isPending}>
            {create.isPending ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <Plus className="mr-1 h-4 w-4" />
            )}
            Cadastrar
          </Button>
        </div>

        <Input
          placeholder="Buscar representante…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : (
          <ul className="space-y-1.5">
            {filtered.map((r) => {
              const value = drafts[r.id] ?? r.email ?? "";
              const dirty = value !== (r.email ?? "");
              return (
                <li
                  key={r.id}
                  className={`flex flex-wrap items-center gap-2 rounded-md border px-3 py-2 ${r.id === highlightRepId ? "border-amber-400 bg-amber-50 dark:bg-amber-950/20" : ""}`}
                >
                  <div className="min-w-[160px] flex-1">
                    <div className="text-sm font-medium">{r.nome}</div>
                    {r.regiao && <div className="text-xs text-muted-foreground">{r.regiao}</div>}
                  </div>
                  <Input
                    className="h-8 w-64"
                    placeholder="e-mail do representante"
                    value={value}
                    onChange={(e) => setDrafts((d) => ({ ...d, [r.id]: e.target.value }))}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!dirty || saveEmail.isPending}
                    onClick={() => saveEmail.mutate({ id: r.id, email: value })}
                  >
                    Salvar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    title="Cria o login do representante e envia o convite para ele definir a senha"
                    disabled={!r.email || dirty || (access.isPending && access.variables === r.id)}
                    onClick={() => {
                      if (
                        confirm(
                          `${r.user_id ? "Reenviar o convite de acesso" : "Criar o acesso ao portal"} para ${r.email}?`,
                        )
                      )
                        access.mutate(r.id);
                    }}
                  >
                    {access.isPending && access.variables === r.id ? (
                      <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                    ) : (
                      <KeyRound className="mr-1 h-4 w-4" />
                    )}
                    {r.user_id ? "Reenviar convite" : "Criar acesso"}
                  </Button>
                </li>
              );
            })}
            {!filtered.length && (
              <p className="text-sm text-muted-foreground">Nenhum representante encontrado.</p>
            )}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
