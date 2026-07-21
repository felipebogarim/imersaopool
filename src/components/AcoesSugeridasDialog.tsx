import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Plus, Upload, MoreVertical, CheckCircle2, Trash2, FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

type Acao = {
  id: string;
  title: string;
  description: string | null;
  source: "manual" | "upload_xlsx" | "upload_pdf";
  status: "pendente" | "validada" | "excluida";
  linked_card_id: string | null;
  linked_board_id: string | null;
  created_at: string;
};

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  repId: string;
  uploadId: string | null;
  repName?: string;
};

const SOURCE_LABEL: Record<Acao["source"], string> = {
  manual: "Manual",
  upload_xlsx: "Planilha",
  upload_pdf: "PDF",
};

async function extractPdfText(file: File): Promise<string> {
  const pdfjs: any = await import("pdfjs-dist");
  // Use bundled worker via URL
  try {
    const workerUrl = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).href;
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  } catch {
    /* fallback: pdfjs will run without worker (slower) */
  }
  const buf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buf }).promise;
  const parts: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const text = content.items.map((it: any) => it.str).join(" ");
    parts.push(text);
  }
  return parts.join("\n");
}

function extractXlsxActions(file: File): Promise<Array<{ title: string; description: string | null }>> {
  return file.arrayBuffer().then((buf) => {
    const wb = XLSX.read(buf, { type: "array" });
    const acoes: Array<{ title: string; description: string | null }> = [];
    for (const sn of wb.SheetNames) {
      const ws = wb.Sheets[sn];
      const rows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: "" });
      let headerIdx = -1;
      for (let i = 0; i < Math.min(rows.length, 5); i++) {
        const joined = (rows[i] ?? []).map((c) => String(c).toLowerCase()).join("|");
        if (/(a[çc][aã]o|titulo|título|acao)/.test(joined)) { headerIdx = i; break; }
      }
      const start = headerIdx >= 0 ? headerIdx + 1 : 0;
      for (let i = start; i < rows.length; i++) {
        const r = rows[i] ?? [];
        const title = String(r[0] ?? "").trim();
        const desc = String(r[1] ?? "").trim();
        if (!title) continue;
        acoes.push({ title, description: desc || null });
      }
    }
    return acoes;
  });
}

function splitPdfLines(text: string): Array<{ title: string; description: string | null }> {
  const lines = text
    .split(/\n|(?<=[.!?])\s{2,}|\u2022|\-\s+|\d+[.)]\s+/g)
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter((l) => l.length >= 8 && l.length <= 400);
  const seen = new Set<string>();
  const out: Array<{ title: string; description: string | null }> = [];
  for (const l of lines) {
    const key = l.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ title: l, description: null });
  }
  return out;
}

export function AcoesSugeridasDialog({ open, onOpenChange, repId, uploadId, repName }: Props) {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [validating, setValidating] = useState<Acao | null>(null);

  const { data: acoes = [], isLoading } = useQuery({
    queryKey: ["perf-acoes", repId],
    enabled: open && !!repId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("perf_acoes_sugeridas")
        .select("*")
        .eq("representative_id", repId)
        .neq("status", "excluida")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Acao[];
    },
  });

  const pendentes = useMemo(() => acoes.filter((a) => a.status === "pendente"), [acoes]);
  const validadas = useMemo(() => acoes.filter((a) => a.status === "validada"), [acoes]);

  async function addManual() {
    if (!title.trim()) return toast.error("Informe um título para a ação.");
    setBusy(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await (supabase as any).from("perf_acoes_sugeridas").insert({
        representative_id: repId,
        upload_id: uploadId,
        title: title.trim(),
        description: description.trim() || null,
        source: "manual",
        status: "pendente",
        created_by: u.user!.id,
      });
      if (error) throw error;
      toast.success("Ação criada.");
      setTitle(""); setDescription("");
      qc.invalidateQueries({ queryKey: ["perf-acoes", repId] });
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao criar ação.");
    } finally {
      setBusy(false);
    }
  }

  async function handleFile(file: File) {
    setBusy(true);
    try {
      const ext = file.name.toLowerCase().split(".").pop();
      let items: Array<{ title: string; description: string | null }> = [];
      let source: Acao["source"] = "upload_xlsx";
      if (ext === "xlsx" || ext === "xls" || ext === "csv") {
        items = await extractXlsxActions(file);
        source = "upload_xlsx";
      } else if (ext === "pdf") {
        const text = await extractPdfText(file);
        items = splitPdfLines(text);
        source = "upload_pdf";
      } else {
        throw new Error("Formato não suportado. Envie .xlsx, .csv ou .pdf.");
      }
      if (items.length === 0) throw new Error("Nenhuma ação encontrada no arquivo.");
      const { data: u } = await supabase.auth.getUser();
      const payload = items.map((it) => ({
        representative_id: repId,
        upload_id: uploadId,
        title: it.title.slice(0, 500),
        description: it.description,
        source,
        status: "pendente" as const,
        created_by: u.user!.id,
      }));
      const { error } = await (supabase as any).from("perf_acoes_sugeridas").insert(payload);
      if (error) throw error;
      toast.success(`${items.length} ações carregadas.`);
      qc.invalidateQueries({ queryKey: ["perf-acoes", repId] });
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao ler arquivo.");
    } finally {
      setBusy(false);
    }
  }

  async function excluir(a: Acao) {
    const { error } = await (supabase as any)
      .from("perf_acoes_sugeridas")
      .update({ status: "excluida" })
      .eq("id", a.id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["perf-acoes", repId] });
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Ações Sugeridas{repName ? ` — ${repName}` : ""}</DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Criar ação manualmente */}
            <section className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Plus className="h-4 w-4" /> Nova ação
              </div>
              <div className="space-y-2">
                <div>
                  <Label className="text-xs">Título</Label>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Revisar mix da família Sistemas" />
                </div>
                <div>
                  <Label className="text-xs">Descrição (opcional)</Label>
                  <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
                </div>
                <Button size="sm" onClick={addManual} disabled={busy || !title.trim()}>
                  <Plus className="h-4 w-4 mr-1" /> Adicionar
                </Button>
              </div>
            </section>

            {/* Upload arquivo */}
            <section className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Upload className="h-4 w-4" /> Carregar planilha ou PDF
              </div>
              <p className="text-xs text-muted-foreground">
                Envie um arquivo .xlsx (1ª coluna: título, 2ª coluna: descrição) ou um PDF — cada linha/parágrafo relevante vira uma ação pendente.
              </p>
              <label className="inline-flex">
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv,.pdf"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFile(f);
                    e.target.value = "";
                  }}
                />
                <Button asChild variant="outline" size="sm" disabled={busy}>
                  <span>{busy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />} Selecionar arquivo</span>
                </Button>
              </label>
            </section>

            {/* Lista pendentes */}
            <section>
              <h3 className="text-sm font-medium mb-2">Pendentes ({pendentes.length})</h3>
              {isLoading ? (
                <div className="text-sm text-muted-foreground">Carregando…</div>
              ) : pendentes.length === 0 ? (
                <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                  Nenhuma ação pendente. Crie uma acima ou carregue um arquivo.
                </div>
              ) : (
                <ul className="space-y-2">
                  {pendentes.map((a) => (
                    <li key={a.id} className="flex items-start justify-between gap-3 rounded-lg border p-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <div className="font-medium text-sm">{a.title}</div>
                          <Badge variant="outline" className="text-[10px] gap-1">
                            {a.source === "upload_pdf" ? <FileText className="h-3 w-3" /> :
                             a.source === "upload_xlsx" ? <FileSpreadsheet className="h-3 w-3" /> : null}
                            {SOURCE_LABEL[a.source]}
                          </Badge>
                        </div>
                        {a.description && <p className="text-xs text-muted-foreground mt-1">{a.description}</p>}
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setValidating(a)}>
                            <CheckCircle2 className="h-4 w-4 mr-2" /> Validar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => excluir(a)} className="text-destructive">
                            <Trash2 className="h-4 w-4 mr-2" /> Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Validadas */}
            {validadas.length > 0 && (
              <section>
                <h3 className="text-sm font-medium mb-2">Validadas ({validadas.length})</h3>
                <ul className="space-y-2">
                  {validadas.map((a) => (
                    <li key={a.id} className="flex items-start justify-between gap-3 rounded-lg border p-3 bg-muted/30">
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-sm line-through opacity-70">{a.title}</div>
                        <p className="text-xs text-muted-foreground mt-1">Convertida em card no Kanban.</p>
                      </div>
                      <Badge variant="outline" className="gap-1"><CheckCircle2 className="h-3 w-3" /> Validada</Badge>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {validating && (
        <ValidateDialog
          acao={validating}
          onClose={() => setValidating(null)}
          onDone={() => {
            setValidating(null);
            qc.invalidateQueries({ queryKey: ["perf-acoes", repId] });
          }}
        />
      )}
    </>
  );
}

function ValidateDialog({ acao, onClose, onDone }: { acao: Acao; onClose: () => void; onDone: () => void }) {
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [boardId, setBoardId] = useState<string>("");
  const [newWs, setNewWs] = useState<string>("");
  const [newBoardName, setNewBoardName] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const { data: workspaces = [] } = useQuery({
    queryKey: ["kanban-workspaces-min"],
    queryFn: async () => (await supabase.from("kanban_workspaces").select("id,name").is("archived_at", null).order("created_at")).data ?? [],
  });

  const { data: boards = [] } = useQuery({
    queryKey: ["kanban-boards-min"],
    queryFn: async () => (await supabase.from("kanban_boards").select("id,name,workspace_id").is("archived_at", null).order("position")).data ?? [],
  });

  async function confirm() {
    setSaving(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user!.id;
      let targetBoardId = boardId;

      if (mode === "new") {
        if (!newWs) throw new Error("Escolha o workspace do novo board.");
        if (!newBoardName.trim()) throw new Error("Dê um nome ao novo board.");
        const { data: b, error: bErr } = await supabase
          .from("kanban_boards")
          .insert({ workspace_id: newWs, name: newBoardName.trim(), created_by: uid, color: "#3B82F6" } as any)
          .select("id")
          .single();
        if (bErr || !b) throw bErr ?? new Error("Falha ao criar board");
        targetBoardId = b.id;
        // Cria listas padrão
        await supabase.from("kanban_lists").insert([
          { board_id: targetBoardId, name: "A fazer", position: 1000 },
          { board_id: targetBoardId, name: "Em andamento", position: 2000 },
          { board_id: targetBoardId, name: "Concluído", position: 3000 },
        ] as any);
      } else {
        if (!targetBoardId) throw new Error("Escolha um board.");
      }

      // Pega primeira lista do board (ou cria uma)
      let { data: lists } = await supabase
        .from("kanban_lists")
        .select("id,position")
        .eq("board_id", targetBoardId)
        .is("archived_at", null)
        .order("position")
        .limit(1);
      if (!lists || lists.length === 0) {
        const { data: nl } = await supabase
          .from("kanban_lists")
          .insert({ board_id: targetBoardId, name: "A fazer", position: 1000 } as any)
          .select("id,position");
        lists = nl ?? [];
      }
      const listId = lists![0].id;

      // Cria card
      const { data: card, error: cErr } = await supabase
        .from("kanban_cards")
        .insert({
          list_id: listId,
          board_id: targetBoardId,
          title: acao.title,
          description: acao.description,
          position: 1000,
          priority: "media",
          created_by: uid,
        } as any)
        .select("id")
        .single();
      if (cErr || !card) throw cErr ?? new Error("Falha ao criar card");

      // Atualiza ação
      const { error: uErr } = await (supabase as any)
        .from("perf_acoes_sugeridas")
        .update({
          status: "validada",
          linked_card_id: card.id,
          linked_board_id: targetBoardId,
        })
        .eq("id", acao.id);
      if (uErr) throw uErr;

      toast.success("Ação validada e adicionada ao Kanban.");
      onDone();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao validar ação.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Validar ação → Kanban</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-md bg-muted/40 p-3">
            <div className="text-sm font-medium">{acao.title}</div>
            {acao.description && <div className="text-xs text-muted-foreground mt-1">{acao.description}</div>}
          </div>

          <div className="flex gap-2">
            <Button size="sm" variant={mode === "existing" ? "default" : "outline"} onClick={() => setMode("existing")}>
              Board existente
            </Button>
            <Button size="sm" variant={mode === "new" ? "default" : "outline"} onClick={() => setMode("new")}>
              Criar novo board
            </Button>
          </div>

          {mode === "existing" ? (
            <div>
              <Label className="text-xs">Board</Label>
              <Select value={boardId} onValueChange={setBoardId}>
                <SelectTrigger><SelectValue placeholder="Selecione um board" /></SelectTrigger>
                <SelectContent>
                  {boards.length === 0 ? (
                    <SelectItem value="__empty" disabled>Nenhum board disponível</SelectItem>
                  ) : boards.map((b: any) => {
                    const ws = workspaces.find((w: any) => w.id === b.workspace_id);
                    return (
                      <SelectItem key={b.id} value={b.id}>
                        {ws?.name ? `${ws.name} / ` : ""}{b.name}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Workspace</Label>
                <Select value={newWs} onValueChange={setNewWs}>
                  <SelectTrigger><SelectValue placeholder="Selecione o workspace" /></SelectTrigger>
                  <SelectContent>
                    {workspaces.map((w: any) => (
                      <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Nome do novo board</Label>
                <Input value={newBoardName} onChange={(e) => setNewBoardName(e.target.value)} placeholder="Ex: Ações Salton — 2º Semestre" />
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={confirm} disabled={saving}>{saving ? "Salvando…" : "Validar e criar card"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
