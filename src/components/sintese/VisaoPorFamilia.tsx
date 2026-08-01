import { useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronDown, Upload, Table2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { parseMapaFamilia, toneDaColuna, toneDoItem, type MapaFamiliaPayload } from "@/lib/mapa-familia-parser";

type Tone = ReturnType<typeof toneDoItem>;

const TONE_BG: Record<Tone, string> = {
  positivo: "var(--mapa-positivo)",
  negativo: "var(--mapa-negativo)",
  concorrente: "var(--mapa-concorrente)",
  preco: "var(--mapa-preco)",
  competidor: "var(--mapa-competidor)",
};

export function VisaoPorFamilia() {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [aberto, setAberto] = useState(true);
  const [visao, setVisao] = useState<string>("consolidado");
  const [busy, setBusy] = useState(false);

  const { data: versao } = useQuery({
    queryKey: ["mapa-familia-ativo"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mapa_familia_versoes")
        .select("id, versao, arquivo, payload, created_at")
        .eq("ativo", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const payload = versao?.payload as unknown as MapaFamiliaPayload | undefined;

  const rep = useMemo(
    () => payload?.representantes.find(r => r.nome === visao) ?? null,
    [payload, visao],
  );

  async function onUpload(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    try {
      const buffer = await file.arrayBuffer();
      const parsed = parseMapaFamilia(buffer, file.name);
      const { data: user } = await supabase.auth.getUser();
      const proxima = (versao?.versao ?? 0) + 1;
      await supabase.from("mapa_familia_versoes").update({ ativo: false }).eq("ativo", true);
      const { error } = await supabase.from("mapa_familia_versoes").insert({
        versao: proxima,
        arquivo: file.name,
        payload: parsed as any,
        ativo: true,
        created_by: user.user?.id ?? null,
      });
      if (error) throw error;
      toast.success(`Planilha carregada: v${proxima} passa a ser a versão oficial.`);
      setVisao("consolidado");
      qc.invalidateQueries({ queryKey: ["mapa-familia-ativo"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao carregar a planilha.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <section className="surface rounded-xl overflow-hidden">
      <input
        ref={fileRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={e => onUpload(e.target.files?.[0])}
      />
      <div className="flex flex-wrap items-center gap-3 px-4 py-3">
        <button type="button" onClick={() => setAberto(v => !v)} className="flex items-center gap-2 text-left">
          <ChevronDown className={cn("h-4 w-4 transition-transform", !aberto && "-rotate-90")} />
          <span className="text-sm font-semibold">Visão por família</span>
        </button>
        <span className="text-xs text-muted-foreground">
          {payload
            ? `v${versao?.versao} · ${payload.representantes.length} entrevistas · ${versao?.arquivo ?? "planilha"}`
            : "Nenhuma planilha carregada."}
        </span>
        <div className="ml-auto flex items-center gap-2">
          {payload && (
            <Select value={visao} onValueChange={setVisao}>
              <SelectTrigger className="h-8 w-56 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="consolidado">Consolidado</SelectItem>
                {payload.representantes.map(r => (
                  <SelectItem key={r.nome} value={r.nome}>{r.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button size="sm" variant="outline" disabled={busy} onClick={() => fileRef.current?.click()}>
            <Upload className="h-4 w-4 mr-1" /> Carregar planilha
          </Button>
        </div>
      </div>

      {aberto && (
        <div className="border-t px-4 py-4">
          {!payload ? (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <Table2 className="h-6 w-6 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Carregue a planilha do mapa de entrevistas por família para montar o quadro visual.
              </p>
            </div>
          ) : visao === "consolidado" ? (
            <Quadro
              colunas={payload.consolidado.colunas}
              cantoLabel="FAMÍLIA"
              linhas={payload.consolidado.linhas.map(l => ({ rotulo: l.familia, valores: l.valores }))}
              tone={toneDaColuna}
              toneEixo="coluna"
            />
          ) : rep ? (
            <Quadro
              colunas={payload.familias}
              cantoLabel="ITEM"
              linhas={payload.itens
                .filter(i => rep.linhas[i])
                .map(i => ({ rotulo: i, valores: rep.linhas[i] }))}
              tone={toneDoItem}
              toneEixo="linha"
            />
          ) : (
            <p className="text-sm text-muted-foreground">Visão indisponível nesta versão da planilha.</p>
          )}
        </div>
      )}
    </section>
  );
}

function Quadro({
  colunas,
  linhas,
  cantoLabel,
  tone,
  toneEixo,
}: {
  colunas: string[];
  linhas: { rotulo: string; valores: Record<string, string> }[];
  cantoLabel: string;
  tone: (chave: string) => Tone;
  toneEixo: "linha" | "coluna";
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[900px] border-collapse text-xs">
        <thead>
          <tr>
            <th
              className="sticky left-0 z-10 border p-2 text-left font-semibold uppercase tracking-wide"
              style={{ background: "var(--mapa-cabecalho)", color: "var(--mapa-texto)", minWidth: 170 }}
            >
              {cantoLabel}
            </th>
            {colunas.map(c => (
              <th
                key={c}
                className="border p-2 text-left font-semibold uppercase tracking-wide"
                style={{ background: "var(--mapa-cabecalho)", color: "var(--mapa-texto)", minWidth: 200 }}
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {linhas.map(l => (
            <tr key={l.rotulo} className="align-top">
              <th
                className="sticky left-0 z-10 border p-2 text-left font-semibold"
                style={{ background: "var(--mapa-cabecalho)", color: "var(--mapa-texto)" }}
              >
                {l.rotulo}
              </th>
              {colunas.map(c => (
                <td
                  key={c}
                  className="border p-2 leading-relaxed"
                  style={{
                    background: TONE_BG[tone(toneEixo === "linha" ? l.rotulo : c)],
                    color: "var(--mapa-texto)",
                  }}
                >
                  {l.valores[c] || "—"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
