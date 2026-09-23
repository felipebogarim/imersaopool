import { AlertTriangle } from "lucide-react";
import type { SectorPersonForRecipients } from "@/lib/internal-tickets/recipients";

export const NO_PRINCIPAL_MESSAGE =
  "Este setor não possui um destinatário principal configurado para receber novos tickets. Configure um responsável antes de enviar a solicitação.";

/**
 * Só mostra a configuração já existente do setor — nunca deixa o usuário
 * escolher pessoas manualmente aqui.
 */
export function RecipientsPreview({
  principal,
  cc,
}: {
  principal: SectorPersonForRecipients | null;
  cc: SectorPersonForRecipients[];
}) {
  return (
    <div className="space-y-2 rounded-lg border p-3 text-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Destinatários
      </p>

      {principal ? (
        <div>
          <p className="text-xs text-muted-foreground">Destinatário principal</p>
          <p className="font-medium">{principal.name}</p>
          {principal.role_title && (
            <p className="text-xs text-muted-foreground">{principal.role_title}</p>
          )}
          <p className="text-xs text-muted-foreground">{principal.email}</p>
        </div>
      ) : (
        <p className="flex items-start gap-2 text-xs text-destructive">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {NO_PRINCIPAL_MESSAGE}
        </p>
      )}

      {cc.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground">Em cópia</p>
          <ul className="space-y-0.5">
            {cc.map((p) => (
              <li key={p.id} className="text-xs">
                {p.name} — {p.email}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
