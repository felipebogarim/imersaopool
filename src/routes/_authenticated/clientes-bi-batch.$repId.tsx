import { createFileRoute, Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Upload, Save, Trash2, FileSpreadsheet, Users } from "lucide-react";
import { toast } from "sonner";
import {
  parseClientBIWorkbookBatch,
  parseClientFamiliasWorkbookBatch,
} from "@/lib/client-bi-parser";

export const Route = createFileRoute("/_authenticated/clientes-bi-batch/$repId")({
  head: () => ({ meta: [{ title: "BI dos clientes — PoolFlux" }] }),
  component: BatchPage,
});

type Staged = {
  kind: "bi" | "familias";
  file: File;
  items: Array<{ razao_social: string; data: any }>;
};

function BatchPage() {
  const { repId } = Route.useParams();
  const qc = useQueryClient();
  const biRef = useRef<HTMLInputElement>(null);
  const famRef = useRef<HTMLInputElement>(null);
  const [stagedBI, setStagedBI] = useState<Staged | null>(null);
  const [stagedFam, setStagedFam] = useState<Staged | null>(null);
  const [busy, setBusy] = useState(false);

  const { data: rep } = useQuery({
    queryKey: ["rep-info", repId],
    queryFn: async () =>
      (await supabase.from("representatives").select("id, nome, company_id").eq("id", repId).single()).data,
  });

  const { data: saved = [], isLoading } = useQuery({
    queryKey: ["client-bi-saved-list", repId],
    enabled: !!repId,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("client_bi_uploads")
        .select("id, kind, filename, created_at, razao_social, substituida_em")
        .eq("representative_id", repId)
        .is("substituida_em", null)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  // Agrupa por (filename + kind + created_at truncado a segundo) para exibir cada import como uma linha
  const groupedSaved = (() => {
    const map = new Map<string, { kind: string; filename: string; created_at: string; ids: string[]; count: number }>();
    for (const r of saved as any[]) {
      const key = `${r.kind}::${r.filename ?? ""}::${(r.created_at ?? "").slice(0, 19)}`;
      const cur = map.get(key);
      if (cur) {
        cur.ids.push(r.id);
        cur.count += 1;
      } else {
        map.set(key, { kind: r.kind, filename: r.filename ?? "—", created_at: r.created_at, ids: [r.id], count: 1 });
      }
    }
    return Array.from(map.values());
  })();

  async function stage(kind: "bi" | "familias", file: File) {
    try {
      const buf = await file.arrayBuffer();
      const items =
        kind === "bi" ? parseClientBIWorkbookBatch(buf) : parseClientFamiliasWorkbookBatch(buf);
      if (!items.length) {
        toast.error("Nenhum cliente identificado na planilha.");
        return;
      }
      const staged: Staged = { kind, file, items };
      if (kind === "bi") setStagedBI(staged);
      else setStagedFam(staged);
      toast.success(`${items.length} cliente(s) identificado(s).`);
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao ler planilha.");
    }
  }

  const save = useMutation({
    mutationFn: async () => {
      if (!rep?.company_id) throw new Error("Representante sem empresa associada.");
      if (!stagedBI && !stagedFam) throw new Error("Carregue ao menos uma planilha.");
      const { data: userRes } = await supabase.auth.getUser();
      const userId = userRes.user?.id ?? null;
      let total = 0;
      for (const staged of [stagedBI, stagedFam].filter(Boolean) as Staged[]) {
        const razoes = staged.items.map((i) => i.razao_social);
        await (supabase as any)
          .from("client_bi_uploads")
          .update({ substituida_em: new Date().toISOString() })
          .eq("representative_id", repId)
          .eq("kind", staged.kind)
          .in("razao_social", razoes)
          .is("substituida_em", null);
        const payload = staged.items.map((it) => ({
          representative_id: repId,
          company_id: rep.company_id,
          razao_social: it.razao_social,
          kind: staged.kind,
          filename: staged.file.name,
          data: it.data,
          uploaded_by: userId,
        }));
        const { error } = await (supabase as any).from("client_bi_uploads").insert(payload);
        if (error) throw error;
        total += staged.items.length;
      }
      return total;
    },
    onSuccess: (n) => {
      toast.success(`Dados salvos e distribuídos para ${n} cliente(s).`);
      setStagedBI(null);
      setStagedFam(null);
      qc.invalidateQueries({ queryKey: ["client-bi-saved-list", repId] });
      qc.invalidateQueries({ queryKey: ["client-bi"] });
      qc.invalidateQueries({ queryKey: ["client-familias"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar."),
    onSettled: () => setBusy(false),
  });

  const del = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await (supabase as any)
        .from("client_bi_uploads")
        .update({ substituida_em: new Date().toISOString() })
        .in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Registro removido.");
      qc.invalidateQueries({ queryKey: ["client-bi-saved-list", repId] });
      qc.invalidateQueries({ queryKey: ["client-bi"] });
      qc.invalidateQueries({ queryKey: ["client-familias"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao remover."),
  });

  return (
    <div>
      <PageHeader
        title="BI dos clientes"
        subtitle={rep?.nome ? `Representante: ${rep.nome}` : undefined}
        actions={
          <Button variant="ghost" asChild>
            <Link to="/representantes/performance">
              <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
            </Link>
          </Button>
        }
      />
      <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-6">
        <div className="surface rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm font-medium">Carregar planilhas em lote</p>
          </div>
          <p className="text-xs text-muted-foreground">
            Envie uma planilha por vez. Cada planilha cria automaticamente a página de todos os
            clientes contidos nela. Nenhum resultado é exibido aqui — os dados ficam disponíveis no
            kebab <strong>BI do cliente</strong> de cada linha do Performance.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="rounded-lg border border-border p-4 flex flex-col gap-2">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">
                Planilha de BI (dados)
              </div>
              <div className="text-sm truncate">
                {stagedBI ? (
                  <>
                    <FileSpreadsheet className="inline h-3.5 w-3.5 mr-1 text-muted-foreground" />
                    {stagedBI.file.name}{" "}
                    <span className="text-xs text-muted-foreground">
                      ({stagedBI.items.length} cliente(s))
                    </span>
                  </>
                ) : (
                  <span className="text-muted-foreground">Nenhuma planilha carregada</span>
                )}
              </div>
              <input
                ref={biRef}
                type="file"
                accept=".xlsx"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (f) stage("bi", f);
                }}
              />
              <Button size="sm" variant="outline" onClick={() => biRef.current?.click()}>
                <Upload className="h-3.5 w-3.5 mr-1" /> {stagedBI ? "Trocar arquivo" : "Selecionar arquivo"}
              </Button>
            </div>

            <div className="rounded-lg border border-border p-4 flex flex-col gap-2">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">
                Planilha do gráfico (resultado por família)
              </div>
              <div className="text-sm truncate">
                {stagedFam ? (
                  <>
                    <FileSpreadsheet className="inline h-3.5 w-3.5 mr-1 text-muted-foreground" />
                    {stagedFam.file.name}{" "}
                    <span className="text-xs text-muted-foreground">
                      ({stagedFam.items.length} cliente(s))
                    </span>
                  </>
                ) : (
                  <span className="text-muted-foreground">Nenhuma planilha carregada</span>
                )}
              </div>
              <input
                ref={famRef}
                type="file"
                accept=".xlsx"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (f) stage("familias", f);
                }}
              />
              <Button size="sm" variant="outline" onClick={() => famRef.current?.click()}>
                <Upload className="h-3.5 w-3.5 mr-1" /> {stagedFam ? "Trocar arquivo" : "Selecionar arquivo"}
              </Button>
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              onClick={() => {
                setBusy(true);
                save.mutate();
              }}
              disabled={busy || (!stagedBI && !stagedFam) || !rep?.company_id}
            >
              <Save className="h-4 w-4 mr-1" /> Salvar
            </Button>
          </div>
        </div>

        <div className="surface rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <p className="text-sm font-medium">Planilhas salvas</p>
            <p className="text-xs text-muted-foreground">
              Cada linha representa um upload em lote. Os dados ficam vinculados aos clientes.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-2">Tipo</th>
                  <th className="text-left px-4 py-2">Arquivo</th>
                  <th className="text-left px-4 py-2">Clientes</th>
                  <th className="text-left px-4 py-2">Salvo em</th>
                  <th className="px-2 py-2 w-12"></th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                      Carregando…
                    </td>
                  </tr>
                ) : groupedSaved.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                      Nenhuma planilha salva ainda.
                    </td>
                  </tr>
                ) : (
                  groupedSaved.map((g, i) => (
                    <tr key={i} className="border-t border-border">
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border border-border bg-muted">
                          {g.kind === "bi" ? "BI (dados)" : "Gráfico (famílias)"}
                        </span>
                      </td>
                      <td className="px-4 py-3 truncate max-w-[320px]">{g.filename}</td>
                      <td className="px-4 py-3 tabular-nums">{g.count}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {new Date(g.created_at).toLocaleString("pt-BR")}
                      </td>
                      <td className="px-2 py-2 text-right">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => del.mutate(g.ids)}
                          title="Remover"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
