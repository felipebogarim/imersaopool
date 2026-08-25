import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PeriodoPicker, type PeriodoValue } from "@/components/PeriodoPicker";
import { Upload, X, CheckCircle2, AlertCircle, Loader2, FileSpreadsheet, FileText } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { parseWorkbook } from "@/lib/performance-parser";
import { generatePerformanceFromRaw } from "@/lib/generate-performance.functions";
import { expandFiles, guessRepId, pdfToAoa, type BulkEntry } from "@/lib/performance-bulk";
import { cn } from "@/lib/utils";

type Rep = { id: string; nome: string };

export function EnvioMassaDialog({
  open,
  onOpenChange,
  reps,
  onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  reps: Rep[];
  onDone?: () => void;
}) {
  const gerar = useServerFn(generatePerformanceFromRaw);
  const y = new Date().getFullYear();
  const [periodo, setPeriodo] = useState<PeriodoValue>({
    label: `1º Semestre ${y}`,
    inicio: `${y}-01-01`,
    fim: `${y}-06-30`,
  });
  const [entries, setEntries] = useState<BulkEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function onPick(fileList: FileList | null) {
    if (!fileList?.length) return;
    try {
      const files = await expandFiles(Array.from(fileList));
      if (!files.length) {
        toast.error("Nenhum arquivo aceito encontrado (.xlsx, .xls, .pdf ou .zip).");
        return;
      }
      const novos: BulkEntry[] = files.map((f, i) => ({
        id: `${Date.now()}-${i}-${f.name}`,
        name: f.name,
        kind: /\.pdf$/i.test(f.name) ? "pdf" : "xlsx",
        file: f,
        repId: guessRepId(f.name, reps),
        status: "pendente",
      }));
      setEntries((prev) => [...prev, ...novos]);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao ler os arquivos.");
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function patch(id: string, p: Partial<BulkEntry>) {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, ...p } : e)));
  }

  async function processEntry(entry: BulkEntry) {
    const rep = reps.find((r) => r.id === entry.repId);
    if (!rep) throw new Error("Selecione o representante deste arquivo.");

    let familias: string[];
    let targetsMatrix: Record<string, Record<string, number>>;
    let rows: any[];

    if (entry.kind === "xlsx") {
      const parsed = await parseWorkbook(await entry.file.arrayBuffer());
      if (parsed.conflitos?.length) throw new Error("Divergências entre texto e cor na planilha.");
      if (parsed.matriz && parsed.matriz_erros.length) throw new Error(parsed.matriz_erros[0]);
      if (!parsed.rows.length) throw new Error("Nenhuma linha de cliente encontrada.");
      const cm = (parsed.categoriaMetas ?? {}) as Record<string, any>;
      familias = parsed.familias;
      targetsMatrix =
        parsed.matriz?.matriz ?? ((cm.__family_metas_by_category__ ?? {}) as any);
      rows = parsed.rows.map((r) => ({
        razao_social: r.razao_social,
        categoria: r.categoria,
        metas_status: r.metas_status ?? {},
        total_pct_status: r.total_pct_status,
      }));
    } else {
      const aoa = await pdfToAoa(entry.file);
      if (!aoa.length) throw new Error("Não foi possível extrair conteúdo do PDF.");
      const result: any = await gerar({
        data: {
          sheets: [{ filename: entry.name, sheetName: "pdf", aoa }],
          periodoLabel: periodo.label,
          hint: `Representante: ${rep.nome}`,
        },
      });
      if (!result?.rows?.length) throw new Error("A leitura do PDF não retornou clientes.");
      const cm = (result.categoria_metas ?? {}) as Record<string, any>;
      familias = result.familias ?? [];
      targetsMatrix = (cm.__family_metas_by_category__ ?? {}) as any;
      rows = result.rows.map((r: any) => ({
        razao_social: r.razao_social,
        categoria: r.categoria,
        metas_status: r.metas_status ?? {},
        total_pct_status: r.total_pct_status,
      }));
    }

    const payload = {
      representative_id: entry.repId,
      periodo_label: periodo.label.trim(),
      periodo_inicio: periodo.inicio || null,
      periodo_fim: periodo.fim || null,
      familias,
      filename: entry.name,
      targets_matrix: targetsMatrix ?? {},
      rows,
    };
    const { error } = await (supabase as any).rpc("submit_performance_upload", { _payload: payload });
    if (error) throw error;
    return rows.length;
  }

  async function runAll() {
    if (!entries.length) return toast.error("Adicione ao menos um arquivo.");
    if (!periodo.label.trim()) return toast.error("Informe o período.");
    if (entries.some((e) => !e.repId)) return toast.error("Há arquivos sem representante definido.");
    setBusy(true);
    let ok = 0;
    let fail = 0;
    for (const entry of entries) {
      if (entry.status === "ok") continue;
      patch(entry.id, { status: "processando", message: undefined });
      try {
        const n = await processEntry(entry);
        patch(entry.id, { status: "ok", message: `${n} cliente(s) importado(s)` });
        ok++;
      } catch (e: any) {
        patch(entry.id, { status: "erro", message: String(e?.message ?? e) });
        fail++;
      }
    }
    setBusy(false);
    if (ok) toast.success(`${ok} arquivo(s) importado(s) com sucesso.`);
    if (fail) toast.error(`${fail} arquivo(s) com erro. Veja os detalhes na lista.`);
    if (ok) onDone?.();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => (!busy ? onOpenChange(v) : null)}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Envio em massa de performance</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="mb-1 block">Período de referência (aplicado a todos os arquivos)</Label>
            <PeriodoPicker value={periodo} onChange={setPeriodo} required />
          </div>

          <div>
            <Label>Arquivos (.xlsx, .xls, .pdf ou .zip)</Label>
            <Input
              ref={inputRef}
              type="file"
              multiple
              accept=".xlsx,.xls,.pdf,.zip"
              onChange={(e) => onPick(e.target.files)}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Carregue os resultados de vários representantes de uma só vez. Arquivos .zip são
              expandidos automaticamente. O representante é identificado pelo nome do arquivo e pode
              ser ajustado abaixo.
            </p>
          </div>

          {entries.length > 0 && (
            <div className="rounded-xl border border-border divide-y divide-border max-h-80 overflow-y-auto">
              {entries.map((e) => (
                <div key={e.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 p-3 sm:flex sm:justify-between">
                  <div className="flex min-w-0 items-center gap-2">
                    {e.kind === "pdf" ? (
                      <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                    ) : (
                      <FileSpreadsheet className="h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-sm">{e.name}</p>
                      {e.message && (
                        <p
                          className={cn(
                            "text-xs truncate",
                            e.status === "erro" ? "text-destructive" : "text-muted-foreground",
                          )}
                        >
                          {e.message}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Select value={e.repId} onValueChange={(v) => patch(e.id, { repId: v })}>
                      <SelectTrigger className="w-56">
                        <SelectValue placeholder="Representante" />
                      </SelectTrigger>
                      <SelectContent className="max-h-72">
                        {reps.map((r) => (
                          <SelectItem key={r.id} value={r.id}>
                            {r.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {e.status === "processando" && <Loader2 className="h-4 w-4 animate-spin" />}
                    {e.status === "ok" && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                    {e.status === "erro" && <AlertCircle className="h-4 w-4 text-destructive" />}
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={busy}
                      onClick={() => setEntries((prev) => prev.filter((x) => x.id !== e.id))}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            Fechar
          </Button>
          <Button onClick={runAll} disabled={busy || !entries.length}>
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 mr-1 animate-spin" /> Importando…
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-1" /> Importar {entries.length || ""} arquivo(s)
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
