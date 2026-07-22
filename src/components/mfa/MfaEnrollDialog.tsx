import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Copy, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSuccess?: () => void;
  /** When true, dialog cannot be closed until enroll completes. */
  mandatory?: boolean;
};

export function MfaEnrollDialog({ open, onOpenChange, onSuccess, mandatory }: Props) {
  const qc = useQueryClient();
  const [step, setStep] = useState<"init" | "qr" | "verifying" | "done">("init");
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setStep("init");
      setFactorId(null);
      setQr(null);
      setSecret(null);
      setCode("");
      setError(null);
    }
  }, [open]);

  async function startEnroll() {
    setLoading(true);
    setError(null);
    try {
      // Cleanup: remove any unverified factor for the current user first (avoids "already enrolled").
      const list = await supabase.auth.mfa.listFactors();
      const unverified = list.data?.all?.filter((f) => f.status !== "verified") ?? [];
      for (const f of unverified) {
        await supabase.auth.mfa.unenroll({ factorId: f.id });
      }

      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: `TOTP ${new Date().toISOString().slice(0, 10)}`,
      });
      if (error) throw error;
      setFactorId(data.id);
      setQr(data.totp.qr_code);
      setSecret(data.totp.secret);
      setStep("qr");
      await supabase.rpc("log_mfa_event", { _event: "enroll_started" });
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  async function verifyCode() {
    if (!factorId) return;
    if (!/^\d{6}$/.test(code)) {
      setError("Digite o código de 6 dígitos do app autenticador.");
      return;
    }
    setStep("verifying");
    setError(null);
    try {
      const ch = await supabase.auth.mfa.challenge({ factorId });
      if (ch.error) throw ch.error;
      const v = await supabase.auth.mfa.verify({
        factorId,
        challengeId: ch.data.id,
        code,
      });
      if (v.error) {
        await supabase.rpc("log_mfa_event", { _event: "verify_failed" });
        throw v.error;
      }
      await supabase.rpc("log_mfa_event", { _event: "enroll_completed" });
      // Promover a sessão para aal2 imediatamente
      await supabase.auth.refreshSession().catch(() => {});
      setStep("done");
      toast.success("MFA configurado com sucesso.");
      qc.invalidateQueries();
      onSuccess?.();
      setTimeout(() => onOpenChange(false), 800);
    } catch (e: any) {
      setError(e?.message ?? "Código inválido.");
      setStep("qr");
    }
  }

  async function handleClose(next: boolean) {
    if (!next && mandatory && step !== "done") return;
    if (!next && step === "qr") {
      // marca como abandonado
      supabase.rpc("log_mfa_event", { _event: "enroll_abandoned" }).then(() => {}, () => {});
      if (factorId) await supabase.auth.mfa.unenroll({ factorId }).catch(() => {});
    }
    onOpenChange(next);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className="max-w-md"
        onEscapeKeyDown={(e) => mandatory && e.preventDefault()}
        onPointerDownOutside={(e) => mandatory && e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" /> Configurar autenticação em duas etapas
          </DialogTitle>
          <DialogDescription>
            Use um app autenticador (Google Authenticator, 1Password, Authy, etc).
          </DialogDescription>
        </DialogHeader>

        {step === "init" && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Ao continuar, geraremos um QR Code e uma chave secreta para você registrar no app.
              Nenhum desses valores é armazenado depois da configuração.
            </p>
            <Button className="w-full" onClick={startEnroll} disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Gerar QR Code
            </Button>
          </div>
        )}

        {step === "qr" && qr && secret && (
          <div className="space-y-4">
            <div className="rounded-lg bg-white p-3 flex justify-center">
              <img src={qr} alt="QR Code" className="h-48 w-48" />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider">Chave manual</Label>
              <div className="mt-1 flex gap-2">
                <Input readOnly value={secret} className="font-mono text-xs" />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    navigator.clipboard.writeText(secret);
                    toast.success("Chave copiada");
                  }}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div>
              <Label>Código de 6 dígitos do app</Label>
              <Input
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                placeholder="000000"
                className="text-center text-2xl tracking-widest font-mono"
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button className="w-full" onClick={verifyCode}>
              Verificar e ativar
            </Button>
          </div>
        )}

        {step === "verifying" && (
          <div className="flex items-center gap-2 py-6 justify-center text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Verificando código...
          </div>
        )}

        {step === "done" && (
          <div className="py-6 text-center space-y-2">
            <ShieldCheck className="h-10 w-10 text-primary mx-auto" />
            <p className="text-sm font-medium">MFA ativado com sucesso.</p>
          </div>
        )}

        {!mandatory && step !== "done" && (
          <DialogFooter>
            <Button variant="ghost" onClick={() => handleClose(false)}>
              Fechar
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
