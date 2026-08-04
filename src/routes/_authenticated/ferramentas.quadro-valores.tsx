import { useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Lock, Upload, FileSpreadsheet, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { FAROL_CELL_CLASS, FAROL_LABEL, FAROL_ORDER } from "@/lib/performance-farol";
import { parseQuadroFile, type QuadroDoc } from "@/lib/quadro-valores-parser";

export { MASTER_EMAIL } from "@/lib/nav-tree";

export const Route = createFileRoute("/_authenticated/ferramentas/quadro-valores")({
  head: () => ({
    meta: [
      { title: "Quadro de Valores do Cliente — PoolFlux" },
      {
        name: "description",
        content:
          "Área restrita ao gestor master: carregue planilha ou PDF e visualize o quadro de performance do cliente com os valores originais e faróis de cor.",
      },
      { property: "og:title", content: "Quadro de Valores do Cliente — PoolFlux" },
      {
        property: "og:description",
        content: "Quadro de performance do cliente com valores reais e faróis de cor, restrito ao gestor master.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: QuadroValoresPage,
});

function QuadroValoresPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [doc, setDoc] = useState<QuadroDoc | null>(null);
  const [aba, setAba] = useState(0);
  const [carregando, setCarregando] = useState(false);

  const { data: email, isLoading } = useQuery({
    queryKey: ["quadro-valores-email"],
    staleTime: 60_000,
    queryFn: async () => (await supabase.auth.getUser()).data.user?.email ?? null,
  });

  const isMaster = (email ?? "").toLowerCase() === MASTER_EMAIL;

  const tabela = useMemo(() => doc?.tabelas[aba] ?? null, [doc, aba]);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setCarregando(true);
    try {
      const parsed = await parseQuadroFile(file);
      if (!parsed.tabelas.length) {
        toast.error("Nenhuma tabela reconhecida no arquivo.");
        return;
      }
      setDoc(parsed);
      setAba(0);
      toast.success("Quadro carregado", { description: `${parsed.tabelas.length} tabela(s) lida(s).` });
    } catch (e: any) {
      toast.error("Falha ao ler o arquivo", { description: e?.message ?? String(e) });
    } finally {
      setCarregando(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isMaster) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-6 text-center">
        <Lock className="h-10 w-10 text-muted-foreground" />
        <h1 className="text-xl font-semibold">Área restrita</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          Este quadro exibe valores brutos e está disponível apenas para o gestor master.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Quadro de Valores do Cliente</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Carregue a planilha (.xlsx, .xls, .csv) ou o PDF e visualize o quadro no padrão visual da performance —
          porém com os valores exatamente como estão na origem, com faróis de cor nas células de atingimento.
        </p>
        <p className="mt-2 max-w-3xl text-xs text-muted-foreground">
          Conteúdo sensível: os dados ficam apenas nesta sessão do navegador e não são gravados no sistema.
        </p>
      </header>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls,.xlsm,.csv,.pdf"
          className="hidden"
          onChange={e => onFile(e.target.files?.[0])}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={carregando}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition hover:opacity-90 disabled:opacity-60"
        >
          {carregando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          Carregar planilha ou PDF
        </button>
        {doc ? (
          <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
            <FileSpreadsheet className="h-3.5 w-3.5" />
            {doc.origem}
          </span>
        ) : null}
      </div>

      {doc && doc.tabelas.length > 1 ? (
        <div className="mb-4 flex flex-wrap gap-1.5">
          {doc.tabelas.map((t, i) => (
            <button
              key={t.nome + i}
              type="button"
              onClick={() => setAba(i)}
              aria-pressed={aba === i}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                aba === i ? "bg-primary text-primary-foreground border-primary" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t.nome}
            </button>
          ))}
        </div>
      ) : null}

      {tabela ? (
        <>
          <div className="overflow-auto rounded-xl border">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-muted/60">
                  {tabela.header.map((h, i) => (
                    <th
                      key={i}
                      className="sticky top-0 border-b px-2 py-2 text-left font-semibold uppercase tracking-wide text-muted-foreground"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tabela.rows.map((row, r) => (
                  <tr key={r} className="odd:bg-background even:bg-muted/20">
                    {row.map((c, i) => (
                      <td
                        key={i}
                        className={cn(
                          "border-b border-border/60 px-2 py-1.5 tabular-nums",
                          i === 0 ? "whitespace-nowrap font-medium" : "text-right",
                          c.status ? cn("text-center font-semibold", FAROL_CELL_CLASS[c.status]) : "",
                        )}
                        title={c.status ? FAROL_LABEL[c.status] : undefined}
                      >
                        {c.texto}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Farol</span>
            {FAROL_ORDER.map(s => (
              <span key={s} className={cn("rounded-md px-2 py-0.5 text-[11px] font-medium", FAROL_CELL_CLASS[s])}>
                {FAROL_LABEL[s]}
              </span>
            ))}
          </div>
        </>
      ) : (
        <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          Nenhum arquivo carregado ainda.
        </div>
      )}
    </div>
  );
}
