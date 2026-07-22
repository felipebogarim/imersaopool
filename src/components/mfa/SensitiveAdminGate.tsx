import { useEffect, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { useAdminMfaStatus, useAalLevels } from "@/hooks/use-admin-mfa";
import { MfaChallengeDialog } from "@/components/mfa/MfaChallengeDialog";

/**
 * Rotas administrativas sensíveis que exigem sessão AAL2 no frontend
 * (defesa em profundidade — o backend também recusa via require_admin_aal2()).
 */
const SENSITIVE_PREFIXES = [
  "/admin/lgpd",
  "/admin/mfa-politica",
  "/admin/mfa-recuperacao",
  "/admin/conformidade",
];

function isSensitive(pathname: string) {
  return SENSITIVE_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

/**
 * Quando o admin possui fator TOTP verificado mas está em sessão AAL1 e navega
 * para uma área sensível, abre challenge obrigatório antes de liberar o conteúdo.
 */
export function SensitiveAdminGate() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { data: mfa } = useAdminMfaStatus();
  const { currentLevel, nextLevel, loading, refresh } = useAalLevels();
  const [open, setOpen] = useState(false);

  const needsChallenge =
    !!mfa?.is_admin &&
    !!mfa?.has_verified_factor &&
    !loading &&
    currentLevel === "aal1" &&
    nextLevel === "aal2" &&
    isSensitive(pathname);

  useEffect(() => {
    setOpen(needsChallenge);
  }, [needsChallenge]);

  if (!needsChallenge) return null;

  return (
    <>
      {/* Cobertura visual bloqueando interação até verificar */}
      <div className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm" aria-hidden />
      <MfaChallengeDialog
        open={open}
        onOpenChange={() => {
          /* mandatório */
        }}
        onVerified={async () => {
          await refresh();
          setOpen(false);
        }}
      />
    </>
  );
}
