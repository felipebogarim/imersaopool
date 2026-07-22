import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ShieldCheck } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onVerified?: () => void;
};

export function MfaChallengeDialog({ open, onOpenChange, onVerified }: Props) {
  const qc = useQueryClient();
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setCode("");
      setError(null);
      return;
    }
    (async () => {
      const list = await supabase.auth.mfa.listFactors();
      const totp = list.data?.totp?.find((f) => f.status === "verified");
      setFactorId(totp?.id ?? null);
    })();
  }, [open]);

  async function submit() {
    if (!factorId) {
      setError("Nenhum fator TOTP verificado encontrado.");
      return;
    }
    if (!/^\d{6}$/.test(code)) {
      setError("Digite o código de 6 dígitos.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const ch = await supabase.auth.mfa.challenge({ factorId });
      if (ch.error) throw ch.error;
      const v = await supabase.auth.mfa.verify({ factorId, challengeId: ch.data.id, code });
      if (v.error) {
        await supabase.rpc("log_mfa_event", { _event: "verify_failed" });
        throw v.error;
      }
      await supabase.rpc("log_mfa_event", { _event: "challenge_completed" });
      qc.invalidateQueries();
      onVerified?.();
      onOpenChange(false);
    } catch (e: any) {
      setError(e?.message ?? "Código inválido.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={() => { /* mandatory */ }}>
      <DialogContent
        className="max-w-sm"
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" /> Verificação em duas etapas
          </DialogTitle>
          <DialogDescription>
            Digite o código atual do seu app autenticador para continuar.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Código</Label>
            <Input
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder="000000"
              className="text-center text-2xl tracking-widest font-mono"
              autoFocus
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button className="w-full" onClick={submit} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Verificar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
