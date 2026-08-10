import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { VisaoImersao2Import } from "./VisaoImersao2Importer";

function formatDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value;
}

export function VisaoImersao2ImportPreview({
  value,
  saving,
  onCancel,
  onConfirm,
}: {
  value: VisaoImersao2Import | null;
  saving: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={Boolean(value)} onOpenChange={(open) => { if (!open && !saving) onCancel(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>ARQUIVO VISÃO IMERSÃO 2 VALIDADO</DialogTitle>
        </DialogHeader>
        {value ? (
          <div className="space-y-4 text-sm">
            <Badge>IMPORTADOR VISÃO IMERSÃO 2 ATIVO</Badge>
            <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2">
              <dt className="text-muted-foreground">Schema</dt><dd className="font-medium">{value.data.schema}</dd>
              <dt className="text-muted-foreground">Cliente</dt><dd>{value.data.client.name}</dd>
              <dt className="text-muted-foreground">Data</dt><dd>{formatDate(value.data.client.visit_date)}</dd>
              <dt className="text-muted-foreground">Local</dt><dd>{value.data.client.location}</dd>
              <dt className="text-muted-foreground">Representante</dt><dd>{value.data.client.representative ?? "—"}</dd>
              <dt className="text-muted-foreground">Consultor</dt><dd>{value.data.client.consultant ?? "—"}</dd>
              <dt className="text-muted-foreground">Sinais estratégicos</dt><dd>{value.data.signals.length}</dd>
              <dt className="text-muted-foreground">Perspectivas</dt><dd>{value.data.perspectives.length}</dd>
              <dt className="text-muted-foreground">Citações</dt><dd>{value.data.quotes.length}</dd>
              <dt className="text-muted-foreground">Marcas observadas</dt><dd>{value.data.brands_observed.length}</dd>
              <dt className="text-muted-foreground">Famílias</dt><dd>{value.data.families_analyzed.length}</dd>
            </dl>
          </div>
        ) : null}
        <DialogFooter>
          <Button variant="ghost" onClick={onCancel} disabled={saving}>Cancelar</Button>
          <Button onClick={onConfirm} disabled={saving}>{saving ? "Persistindo…" : "Confirmar importação"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}