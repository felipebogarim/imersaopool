// Aplicar metas mínimas em massa (gestão): grava o mínimo da tabela "Metas Mínimas" como META DO
// GESTOR nos portfólios sem meta revisada, por categoria cadastrada, vigente desde o mês atual.
// Nunca sobrescreve meta revisada (clientes revisados ficam intactos). As metas entram em todos os cálculos e aparecem
// na carteira com "IA" azul até o gestor revisar e salvar o painel do cliente.

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  applyMetasMinimosMassa,
  type MinimosMassaResultado,
} from "@/lib/performance-metas.functions";
import { categoriaCadastrada } from "@/lib/performance-categoria";
import { useMetasMinimos } from "./use-metas-minimos";

type Cliente = {
  id: string;
  razao_social: string;
  categoria: string | null;
  revisadoCompleto: boolean;
};

const LOTE = 25;

export function MinimosMassaButton({
  todos,
  filtrados,
  disabled,
}: {
  todos: Cliente[];
  filtrados: Cliente[];
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Badge
        variant="outline"
        className={cn(
          "cursor-pointer gap-1 border-sky-300 px-2.5 py-1 text-[10px] font-bold uppercase tracking-tight text-sky-700 hover:bg-sky-500/10 dark:text-sky-300",
          disabled && "pointer-events-none opacity-50",
        )}
        onClick={() => setOpen(true)}
        title="Preencher a meta do gestor com as Metas Mínimas nos portfólios ainda sem meta"
      >
        <Sparkles className="inline h-3 w-3" />
        Aplicar mínimos em massa
      </Badge>
      {open && (
        <MinimosMassaDialog
          open={open}
          onOpenChange={setOpen}
          todos={todos}
          filtrados={filtrados}
        />
      )}
    </>
  );
}

function resumoPorCategoria(clientes: Cliente[]) {
  const r = { Silver: 0, Gold: 0, Black: 0, outras: 0, revisados: 0 };
  for (const c of clientes) {
    if (c.revisadoCompleto) {
      r.revisados += 1;
      continue;
    }
    const cat = categoriaCadastrada(c.categoria);
    if (cat) r[cat] += 1;
    else r.outras += 1;
  }
  return r;
}

function MinimosMassaDialog({
  open,
  onOpenChange,
  todos,
  filtrados,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  todos: Cliente[];
  filtrados: Cliente[];
}) {
  const [escopo, setEscopo] = useState<"todos" | "filtro">("todos");
  const [rodando, setRodando] = useState(false);
  const [feitos, setFeitos] = useState(0);
  const [resultado, setResultado] = useState<MinimosMassaResultado[] | null>(null);
  const applyFn = useServerFn(applyMetasMinimosMassa);
  const queryClient = useQueryClient();
  const { data: minimosRes, isLoading: carregandoMinimos } = useMetasMinimos(true);
  const temMinimos = !!(minimosRes?.available && minimosRes.itens.length);

  const alvo = escopo === "todos" ? todos : filtrados;
  // Clientes 7/7 revisados nem são enviados; os demais só recebem o que falta.
  const enviar = useMemo(
    () => alvo.filter((c) => !c.revisadoCompleto && categoriaCadastrada(c.categoria)),
    [alvo],
  );
  const resumo = useMemo(() => resumoPorCategoria(alvo), [alvo]);

  const executar = async () => {
    setRodando(true);
    setFeitos(0);
    const out: MinimosMassaResultado[] = [];
    try {
      for (let i = 0; i < enviar.length; i += LOTE) {
        const lote = enviar.slice(i, i + LOTE).map((c) => c.id);
        try {
          out.push(...(await applyFn({ data: { rowIds: lote } })));
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Falha ao aplicar.";
          out.push(...lote.map((rowId) => ({ rowId, aplicadas: 0, erro: msg })));
        }
        setFeitos(Math.min(i + LOTE, enviar.length));
      }
      setResultado(out);
      const clientes = out.filter((r) => r.aplicadas > 0).length;
      const portfolios = out.reduce((s, r) => s + r.aplicadas, 0);
      toast.success(
        `Metas mínimas aplicadas: ${portfolios} portfólio(s) em ${clientes} cliente(s).`,
      );
    } finally {
      setRodando(false);
      await queryClient.invalidateQueries({ queryKey: ["performance-metas"] });
    }
  };

  const nome = new Map(todos.map((c) => [c.id, c.razao_social]));
  const erros = resultado?.filter((r) => r.erro) ?? [];

  return (
    <Dialog open={open} onOpenChange={(v) => !rodando && onOpenChange(v)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-sky-600" /> Aplicar metas mínimas em massa
          </DialogTitle>
          <DialogDescription>
            Preenche a <strong>meta do gestor</strong> com o valor da tabela{" "}
            <strong>Metas Mínimas</strong> (categoria cadastrada × portfólio) em todos os portfólios
            <strong> sem meta revisada</strong>, inclusive os que hoje só exibem a meta padrão do
            upload, valendo <strong>a partir do mês atual</strong>. Metas revisadas pelo gestor não
            são alteradas e clientes revisados (7/7) ficam de fora. As metas entram em todos os
            cálculos e aparecem com{" "}
            <span className="rounded bg-sky-500/15 px-1 text-[10px] font-extrabold text-sky-600">
              IA
            </span>{" "}
            na carteira até você revisar e salvar o painel do cliente.
          </DialogDescription>
        </DialogHeader>

        {!resultado ? (
          <div className="space-y-3 text-sm">
            <div className="flex gap-2">
              {(
                [
                  ["todos", `Toda a carteira (${todos.length})`],
                  ["filtro", `Filtro atual (${filtrados.length})`],
                ] as const
              ).map(([v, label]) => (
                <Button
                  key={v}
                  size="sm"
                  variant={escopo === v ? "default" : "outline"}
                  onClick={() => setEscopo(v)}
                  disabled={rodando}
                >
                  {label}
                </Button>
              ))}
            </div>
            <ul className="grid grid-cols-2 gap-1.5 rounded-lg border border-border bg-muted/30 p-3 text-xs">
              <li>
                Silver a completar: <strong>{resumo.Silver}</strong>
              </li>
              <li>
                Gold a completar: <strong>{resumo.Gold}</strong>
              </li>
              <li>
                Black a completar: <strong>{resumo.Black}</strong>
              </li>
              <li className="text-muted-foreground">
                Já revisados (não mexe): <strong>{resumo.revisados}</strong>
              </li>
              {resumo.outras > 0 && (
                <li className="col-span-2 text-muted-foreground">
                  Sem categoria Silver/Gold/Black (ignorados): <strong>{resumo.outras}</strong>
                </li>
              )}
            </ul>
            {!carregandoMinimos && !temMinimos && (
              <p className="text-xs font-medium text-rose-600">
                Nenhuma meta mínima configurada. Preencha a tabela Metas Mínimas antes.
              </p>
            )}
            {rodando && (
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Aplicando… {feitos} de{" "}
                {enviar.length} cliente(s)
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-2 text-sm">
            <p>
              <strong>{resultado.filter((r) => r.aplicadas > 0).length}</strong> cliente(s)
              completado(s), <strong>{resultado.reduce((s, r) => s + r.aplicadas, 0)}</strong>{" "}
              portfólio(s) preenchido(s).{" "}
              {resultado.filter((r) => !r.erro && r.aplicadas === 0).length} cliente(s) já estavam
              completos.
            </p>
            {erros.length > 0 && (
              <div className="max-h-40 overflow-auto rounded border border-rose-300 bg-rose-500/5 p-2 text-xs">
                <p className="font-semibold text-rose-700">{erros.length} com erro:</p>
                {erros.map((r) => (
                  <p key={r.rowId}>
                    {nome.get(r.rowId) ?? r.rowId}: {r.erro}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {resultado ? (
            <Button onClick={() => onOpenChange(false)}>Fechar</Button>
          ) : (
            <>
              <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={rodando}>
                Cancelar
              </Button>
              <Button
                onClick={executar}
                disabled={rodando || !temMinimos || enviar.length === 0}
                className="bg-sky-600 hover:bg-sky-700"
              >
                {rodando ? (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="mr-1 h-4 w-4" />
                )}
                Aplicar em {enviar.length} cliente(s)
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
