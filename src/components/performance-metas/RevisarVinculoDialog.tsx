// Interface preparatória de "Revisar vínculo": mostra como a linha de Performance
// está casada com o cadastro de clientes. Somente leitura — não altera cadastros.

import { useQuery } from "@tanstack/react-query";
import { Link2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { matchPerformanceRow } from "@/lib/client-commercial-resolver";

export function RevisarVinculoDialog({
  open,
  onOpenChange,
  razaoSocial,
  categoria,
  repId,
  repName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  razaoSocial: string;
  categoria: string | null;
  repId: string | null;
  repName: string;
}) {
  const { data: candidatos = [], isLoading } = useQuery({
    queryKey: ["performance-metas", "vinculo", repId, razaoSocial],
    enabled: open && !!repId,
    queryFn: async () => {
      const { data } = await supabase
        .from("clients")
        .select("id, razao_social, nome_fantasia, categoria")
        .eq("representative_id", repId as string)
        .limit(1000);
      return (data ?? []).filter((c) => matchPerformanceRow(razaoSocial, c));
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-4 w-4" /> Revisar vínculo
          </DialogTitle>
          <DialogDescription>
            Interface preparatória. Hoje a linha de Performance é ligada ao cadastro pelo nome
            (razão social), sem chave fixa. Nenhum cadastro é alterado nesta etapa.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <div className="rounded-lg border border-border p-3 space-y-1">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Linha de Performance
            </p>
            <p className="font-medium">{razaoSocial}</p>
            <p className="text-xs text-muted-foreground">
              Representante: {repName} · Categoria: {categoria ?? "—"}
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Cadastros compatíveis pelo nome
            </p>
            {!repId ? (
              <p className="text-xs text-muted-foreground">Representante não identificado.</p>
            ) : isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
            ) : candidatos.length === 0 ? (
              <p className="text-xs text-amber-700 dark:text-amber-400">
                Nenhum cadastro compatível encontrado na carteira deste representante.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {candidatos.map((c) => (
                  <li
                    key={c.id}
                    className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2"
                  >
                    <span className="truncate">
                      {c.razao_social}
                      {c.nome_fantasia ? (
                        <span className="text-muted-foreground"> · {c.nome_fantasia}</span>
                      ) : null}
                    </span>
                    <Badge
                      variant="outline"
                      className={
                        categoria && c.categoria && c.categoria !== categoria
                          ? "border-amber-500/40 text-amber-700 dark:text-amber-400"
                          : ""
                      }
                    >
                      {c.categoria ?? "—"}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
            {candidatos.length > 1 && (
              <p className="text-xs text-amber-700 dark:text-amber-400">
                Mais de um cadastro compatível: o vínculo por nome é ambíguo.
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          <Button disabled title="Disponível na etapa de persistência">
            Confirmar vínculo (próxima etapa)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
