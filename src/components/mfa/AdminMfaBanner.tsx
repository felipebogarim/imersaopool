import { Link } from "@tanstack/react-router";
import { AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAdminMfaStatus, useBannerDismiss } from "@/hooks/use-admin-mfa";

export function AdminMfaBanner() {
  const { data } = useAdminMfaStatus();
  const { dismissed, dismiss } = useBannerDismiss();

  if (!data?.is_admin) return null;
  if (data.has_verified_factor) return null;
  if (!data.grace_active) return null;
  if (dismissed) return null;

  const days = data.days_left ?? 0;
  const urgent = days <= 2;

  return (
    <div
      className={`sticky top-0 z-30 flex items-center gap-3 border-b px-4 py-2 text-sm ${
        urgent
          ? "bg-destructive/15 border-destructive/40 text-destructive"
          : "bg-amber-500/10 border-amber-500/40 text-amber-600 dark:text-amber-400"
      }`}
    >
      <AlertTriangle className="h-4 w-4 shrink-0" />
      <div className="flex-1 min-w-0">
        <strong>MFA obrigatório para administradores.</strong>{" "}
        {days > 0
          ? `Faltam ${days} dia${days === 1 ? "" : "s"} para bloqueio automático de ações sensíveis.`
          : "Prazo encerrado — configure agora para não perder o acesso."}
      </div>
      <Button asChild size="sm" variant={urgent ? "destructive" : "default"}>
        <Link to="/admin/mfa">Configurar agora</Link>
      </Button>
      <button
        type="button"
        aria-label="Dispensar aviso"
        onClick={dismiss}
        className="opacity-60 hover:opacity-100"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
