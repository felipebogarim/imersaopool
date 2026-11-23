// Ciclo de vigência das metas (gestão): mostra o período e permite renovar ou estender.

import { useState } from "react";
import { toast } from "sonner";
import { CalendarRange, ChevronDown, FlaskConical, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  competenciasDoCiclo,
  cycleInfo,
  monthLabel,
  type GoalsState,
  type MetasLoadResult,
} from "@/lib/performance-metas-persistence";
import { extendMetasCycle, renewMetasCycle } from "@/lib/performance-metas.functions";

export function MetasCicloControl({
  rowId,
  cycle,
  proximo = null,
  enabled,
  canManage,
  onChange,
}: {
  rowId: string;
  cycle: GoalsState["cycle"];
  proximo?: GoalsState["cycle"];
  /** Banco habilitado (migration aplicada). */
  enabled: boolean;
  canManage: boolean;
  onChange: (state: GoalsState) => void;
}) {
  const [busy, setBusy] = useState(false);

  if (!enabled) {
    return (
      <span className="hidden items-center gap-1 text-[11px] text-amber-700 dark:text-amber-400 sm:flex">
        <FlaskConical className="h-3.5 w-3.5" /> Simulação local · banco ainda não habilitado
      </span>
    );
  }

  const info = cycle ? cycleInfo(cycle) : null;
  const prox = proximo ? cycleInfo(proximo) : null;
  const label = info
    ? `Ciclo ${info.label} · ${info.meses} meses${info.vencido && !prox ? " · vencido" : ""}${
        prox ? ` · próximo ${prox.label}` : ""
      }`
    : "Ciclo de 6 meses inicia ao salvar";

  async function run(fn: () => Promise<MetasLoadResult>, ok: string) {
    setBusy(true);
    try {
      const res = await fn();
      if (res.available) onChange(res.state);
      toast.success(ok);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível alterar o ciclo.");
    } finally {
      setBusy(false);
    }
  }

  const text = (
    <span
      className={cn(
        "flex items-center gap-1",
        info?.vencido && "text-amber-700 dark:text-amber-400",
      )}
    >
      {busy ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <CalendarRange className="h-3.5 w-3.5" />
      )}
      {label}
    </span>
  );

  if (!canManage || !cycle)
    return <span className="text-[11px] text-muted-foreground">{text}</span>;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 px-2 text-[11px]" disabled={busy}>
          {text}
          <ChevronDown className="ml-1 h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
          {prox
            ? `Próximo ciclo já programado (${prox.label}). Para revisar metas, use "Vale a partir de".`
            : "A renovação programa o próximo ciclo logo após o fim do atual, copiando as metas vigentes. O ciclo atual segue até o fim previsto."}
        </DropdownMenuLabel>
        {!prox && <DropdownMenuSeparator />}
        {!prox && info?.podeEstender && (
          <DropdownMenuItem
            onClick={() =>
              run(() => extendMetasCycle({ data: { rowId } }), "Ciclo estendido para 12 meses.")
            }
          >
            Estender este ciclo para 12 meses
          </DropdownMenuItem>
        )}
        {!prox && (
          <>
            <DropdownMenuItem
              onClick={() =>
                run(
                  () => renewMetasCycle({ data: { rowId, meses: 6 } }),
                  "Novo ciclo de 6 meses criado.",
                )
              }
            >
              Renovar: novo ciclo de 6 meses
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() =>
                run(
                  () => renewMetasCycle({ data: { rowId, meses: 12 } }),
                  "Novo ciclo de 12 meses criado.",
                )
              }
            >
              Renovar: novo ciclo de 12 meses
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Competência a partir da qual as metas salvas passam a valer (dentro do ciclo). */
export function CompetenciaSelect({
  cycle,
  proximo = null,
  value,
  onChange,
}: {
  cycle: GoalsState["cycle"];
  proximo?: GoalsState["cycle"];
  value: string;
  onChange: (v: string) => void;
}) {
  const { meses } = competenciasDoCiclo(cycle, proximo);
  return (
    <label
      className="flex items-center gap-1.5 text-[11px] text-muted-foreground"
      title="As versões anteriores da meta são preservadas no histórico"
    >
      Vale a partir de
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-7 rounded-md border border-input bg-background px-1.5 text-[11px] text-foreground"
      >
        {meses.map((m) => (
          <option key={m} value={m}>
            {monthLabel(m)}
          </option>
        ))}
      </select>
    </label>
  );
}
