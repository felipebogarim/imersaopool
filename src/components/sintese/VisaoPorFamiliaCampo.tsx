import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ChevronDown, Table2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Immersion2DataSchema } from "@/lib/visao-imersao-2-parser";
import {
  buildMapaFamiliaCampo,
  COLUNAS_FAMILIA_CAMPO,
  type EvidenciaFamilia,
  type ImersaoFonte,
} from "@/lib/imersao-sintese-map";

const TONE_BG: Record<string, string> = {
  positivo: "var(--mapa-positivo)",
  negativo: "var(--mapa-negativo)",
  concorrente: "var(--mapa-concorrente)",
  preco: "var(--mapa-preco)",
  competidor: "var(--mapa-competidor)",
};

/**
 * Visão por família EXCLUSIVA do universo Visita de campo.
 * Gerada a partir dos relatórios Visão Imersão 2 — nunca da planilha
 * Mapa_Entrevistas_por_Familia_Produtos.xlsx.
 */
export function VisaoPorFamiliaCampo({
  regiao = "todas",
  abertoPadrao = true,
}: {
  regiao?: string;
  abertoPadrao?: boolean;
}) {
  const [aberto, setAberto] = useState(abertoPadrao);
  const [detalhe, setDetalhe] = useState<{ familia: string; coluna: string; itens: EvidenciaFamilia[] } | null>(null);

  const { data: reports = [] } = useQuery({
    queryKey: ["mapa-familia-campo"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("field_immersion_v2_reports")
        .select("id, client_name, visit_date, source_filename, structured_data")
        .order("visit_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const fontes = useMemo<ImersaoFonte[]>(() => {
    const out: ImersaoFonte[] = [];
    for (const r of reports as any[]) {
      const raw = r.structured_data;
      const candidate = raw?.data?.client ? raw.data : raw?.schema === "visao_imersao_2_data_v1" && raw?.client ? raw : (raw?.data ?? raw?.visao_imersao_2_data_v1 ?? raw);
      const parsed = Immersion2DataSchema.safeParse(candidate);
      if (!parsed.success) continue;
      out.push({
        id: r.id,
        client_name: r.client_name,
        visit_date: r.visit_date,
        source_filename: r.source_filename,
        data: parsed.data,
      });
    }
    return out;
  }, [reports]);

  const filtradas = useMemo(
    () =>
      regiao === "todas"
        ? fontes
        : fontes.filter(f => (f.data.client?.location ?? "").trim() === regiao),
    [fontes, regiao],
  );

  const mapa = useMemo(() => buildMapaFamiliaCampo(filtradas), [filtradas]);

  return (
    <section className="surface rounded-xl overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 px-4 py-3">
        <button type="button" onClick={() => setAberto(v => !v)} className="flex items-center gap-2 text-left">
          <ChevronDown className={cn("h-4 w-4 transition-transform", !aberto && "-rotate-90")} />
          <span className="text-sm font-semibold">Visão por família — Visitas de campo</span>
        </button>
        <span className="text-xs text-muted-foreground">
          Mapa_Visitas_de_Campo_por_Familia · {mapa.fontes} imersões · {mapa.clientes.length} clientes
        </span>
      </div>

      {aberto && (
        <div className="border-t px-4 py-4 space-y-4">
          {!mapa.linhas.length ? (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <Table2 className="h-6 w-6 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Nenhuma imersão em campo disponível para montar o mapa por família.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1000px] border-collapse text-xs">
                <thead>
                  <tr>
                    <th
                      className="sticky left-0 z-10 border p-2 text-left font-semibold uppercase tracking-wide"
                      style={{ background: "var(--mapa-cabecalho)", color: "var(--mapa-texto)", minWidth: 180 }}
                    >
                      FAMÍLIA
                    </th>
                    {COLUNAS_FAMILIA_CAMPO.map(c => (
                      <th
                        key={c.key}
                        className="border p-2 text-left font-semibold uppercase tracking-wide"
                        style={{ background: "var(--mapa-cabecalho)", color: "var(--mapa-texto)", minWidth: 200 }}
                      >
                        {c.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {mapa.linhas.map(l => (
                    <tr key={l.familia} className="align-top">
                      <th
                        className="sticky left-0 z-10 border p-2 text-left font-semibold"
                        style={{ background: "var(--mapa-cabecalho)", color: "var(--mapa-texto)" }}
                      >
                        {l.familia}
                        <span className="block text-[10px] font-normal opacity-80">
                          {l.clientes.length} cliente(s)
                        </span>
                      </th>
                      {COLUNAS_FAMILIA_CAMPO.map(c => {
                        const itens = l.celulas[c.key] ?? [];
                        return (
                          <td
                            key={c.key}
                            className="border p-2 leading-relaxed"
                            style={{ background: TONE_BG[c.tone], color: "var(--mapa-texto)" }}
                          >
                            {itens.length ? (
                              <button
                                type="button"
                                className="text-left underline-offset-2 hover:underline"
                                onClick={() => setDetalhe({ familia: l.familia, coluna: c.label, itens })}
                              >
                                <span className="block">
                                  {itens.slice(0, 2).map(i => i.texto).join(" · ")}
                                </span>
                                <span className="mt-1 block text-[10px] opacity-80">
                                  {itens.length} evidência(s) — ver origem
                                </span>
                              </button>
                            ) : (
                              "—"
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {detalhe && (
            <div className="rounded-lg border p-3 space-y-2">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold">
                  {detalhe.familia} · {detalhe.coluna}
                </p>
                <button
                  type="button"
                  className="ml-auto text-xs text-muted-foreground hover:underline"
                  onClick={() => setDetalhe(null)}
                >
                  fechar
                </button>
              </div>
              <ul className="space-y-2">
                {detalhe.itens.map((i, idx) => (
                  <li key={idx} className="rounded border bg-background p-2 text-xs">
                    <p className="font-medium">{i.texto}</p>
                    {i.citacao && <p className="mt-1 italic text-muted-foreground">{i.citacao}</p>}
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {i.cliente} · {i.data} {i.regiao ? `· ${i.regiao}` : ""} · {i.relatorio}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
