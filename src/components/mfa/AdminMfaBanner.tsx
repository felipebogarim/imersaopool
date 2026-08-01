import { Link, useRouterState } from "@tanstack/react-router";
import { AlertTriangle, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useAdminMfaStatus, useBannerDismiss } from "@/hooks/use-admin-mfa";

/** Formata "5d 3h", "23h 12m", "45m 10s" a partir de um deadline persistido no backend. */
function formatCountdown(deadlineISO: string): { text: string; expired: boolean } {
  const now = Date.now();
  const end = new Date(deadlineISO).getTime();
  const ms = end - now;
  if (ms <= 0) return { text: "prazo encerrado", expired: true };
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return { text: `${d}d ${h}h restantes`, expired: false };
  if (h > 0) return { text: `${h}h ${m}m restantes`, expired: false };
  if (m > 0) return { text: `${m}m ${sec}s restantes`, expired: false };
  return { text: `${sec}s restantes`, expired: false };
}

export function AdminMfaBanner() {
  const { data } = useAdminMfaStatus();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { dismissed, dismiss } = useBannerDismiss();
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!data?.deadline) return;
    const id = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, [data?.deadline]);

  // Em telas de bloqueio (aceites, empresa, própria config de MFA) o botão levaria
  // o usuário de volta para a mesma tela — não faz sentido exibir o aviso ali.
  const GATE_PATHS = ["/nda", "/aceite-termos", "/termos-de-uso", "/empresas", "/admin/mfa"];
  if (GATE_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) return null;

  if (!data?.is_admin) return null;
  if (data.has_verified_factor) return null;
  // Sem enforcement iniciado, nada a mostrar
  if (!data.enforcement_started_at) return null;

  const countdown = data.deadline ? formatCountdown(data.deadline) : { text: "prazo indefinido", expired: false };
  const urgent = countdown.expired || (data.days_left != null && data.days_left <= 2);
  const canDismiss = !countdown.expired;
  if (dismissed && canDismiss) return null;

  const deadlineLabel = data.deadline
    ? new Date(data.deadline).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })
    : "—";

  return (
    <div
      className={`sticky top-0 z-30 flex flex-wrap items-center gap-3 border-b px-4 py-2 text-sm ${
        urgent
          ? "bg-destructive/15 border-destructive/40 text-destructive"
          : "bg-amber-500/10 border-amber-500/40 text-amber-600 dark:text-amber-400"
      }`}
    >
      <AlertTriangle className="h-4 w-4 shrink-0" />
      <div className="flex-1 min-w-[16rem]">
        <strong>Proteção adicional obrigatória.</strong>{" "}
        Todas as contas administrativas devem usar autenticação em duas etapas.{" "}
        Configure seu app autenticador até <strong>{deadlineLabel}</strong>. Após esse prazo o acesso às áreas
        administrativas será bloqueado até a conclusão da configuração.{" "}
        <span className="font-medium">({countdown.text})</span>
      </div>
      <Button asChild size="sm" variant={urgent ? "destructive" : "default"}>
        <Link to="/admin/mfa">Configurar agora</Link>
      </Button>
      {canDismiss && (
        <button
          type="button"
          aria-label="Lembrar no próximo login"
          title="Lembrar no próximo login"
          onClick={dismiss}
          className="opacity-70 hover:opacity-100 text-xs underline"
        >
          Lembrar no próximo login
        </button>
      )}
      {canDismiss && (
        <button type="button" aria-label="Dispensar" onClick={dismiss} className="opacity-60 hover:opacity-100">
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
