// Validação de Comparáveis › confere a equivalência oficial do par (base × concorrente) selecionado.
// Existente: OK/validar ou atualizar. Inexistente: salvar. Origem gravada: "Validação de Comparáveis".
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { LoadedProduct } from "@/lib/price-comparativos-data";
import {
  ORIGIN_LABEL,
  RELATION_STATUS_CLASS,
  RELATION_STATUS_LABEL,
  fetchRelationsForBase,
  productCodeOf,
  saveOfficialEquivalence,
  setRelationStatus,
} from "@/lib/price-equivalences-official";
import { cn } from "@/lib/utils";

export function OfficialEquivalenceCheck({
  base,
  competitor,
  canManage,
}: {
  base: LoadedProduct | null;
  competitor: LoadedProduct | null;
  canManage: boolean;
}) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const key = ["price-official-equivalence", base?.id];
  const relations = useQuery({
    queryKey: key,
    enabled: !!base,
    queryFn: () => fetchRelationsForBase(base!.id),
  });

  if (!base) return null;

  const sameBrand = (relations.data ?? []).filter(
    (r) =>
      r.equivalence.relation_status !== "rejeitada" &&
      (!competitor || r.competitor.marca.toLowerCase() === competitor.marca.toLowerCase()),
  );
  const existing = sameBrand[0] ?? null;
  const samePair = existing && competitor && existing.competitor.id === competitor.id;

  async function run(fn: () => Promise<unknown>, ok: string) {
    setBusy(true);
    try {
      await fn();
      toast.success(ok);
      await qc.invalidateQueries({ queryKey: key });
      await qc.invalidateQueries({ queryKey: ["price-equivalences-overview"] });
    } catch (e) {
      console.error(e);
      toast.error("Não foi possível atualizar a equivalência (apenas administradores).");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-dashed p-3 space-y-2 text-sm">
      <p className="font-medium">Equivalência oficial</p>
      {existing ? (
        <div className="flex flex-wrap items-center gap-2">
          <span>
            Já existe: {existing.competitor.marca}{" "}
            <span className="font-mono">{productCodeOf(existing.competitor)}</span>
          </span>
          <Badge
            variant="outline"
            className={cn(RELATION_STATUS_CLASS[existing.equivalence.relation_status])}
          >
            {RELATION_STATUS_LABEL[existing.equivalence.relation_status]}
          </Badge>
          <span className="text-xs text-muted-foreground">
            Origem: {ORIGIN_LABEL[existing.equivalence.origin]}
          </span>
        </div>
      ) : (
        <p className="text-muted-foreground">
          {competitor
            ? "Nenhuma equivalência oficial definida para esta marca."
            : "Nenhuma equivalência oficial definida para este produto."}
        </p>
      )}
      {canManage && competitor && (
        <div className="flex flex-wrap gap-2">
          {samePair && existing.equivalence.relation_status !== "validada" && (
            <Button
              size="sm"
              disabled={busy}
              onClick={() =>
                run(
                  () => setRelationStatus(existing.equivalence.id, "validada"),
                  "Equivalência validada.",
                )
              }
            >
              OK — validar
            </Button>
          )}
          {samePair && existing.equivalence.relation_status === "validada" && (
            <span className="text-xs text-emerald-700">✓ Par já é a equivalência oficial.</span>
          )}
          {existing && !samePair && (
            <Button
              size="sm"
              disabled={busy}
              onClick={() =>
                run(
                  () =>
                    saveOfficialEquivalence({
                      baseProductId: base.id,
                      comparedProductId: competitor.id,
                      origin: "comparables_validation",
                      replaceId: existing.equivalence.id,
                    }),
                  "Equivalência atualizada.",
                )
              }
            >
              Atualizar equivalência
            </Button>
          )}
          {!existing && (
            <Button
              size="sm"
              disabled={busy}
              onClick={() =>
                run(
                  () =>
                    saveOfficialEquivalence({
                      baseProductId: base.id,
                      comparedProductId: competitor.id,
                      origin: "comparables_validation",
                    }),
                  "Equivalência salva.",
                )
              }
            >
              Salvar equivalência
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
