import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Loader2, ShieldAlert } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title?: string;
  description?: string;
  onConfirmed: () => void | Promise<void>;
}

export function PasswordConfirmDialog({ open, onOpenChange, title = "Confirmar exclusão", description = "Esta ação é irreversível. Digite a senha do gestor master para confirmar.", onConfirmed }: Props) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!password) return toast.error("Informe a senha");
    setBusy(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const email = userData.user?.email;
      if (!email) throw new Error("Sessão inválida");

      // Verify role
      const { data: isMaster } = await supabase.rpc("is_admin_or_gestor", { _user_id: userData.user!.id });
      if (!isMaster) throw new Error("Apenas admin ou gestor pode excluir");

      // Verify password by re-signing in (does not disturb current session materially)
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw new Error("Senha incorreta");

      await onConfirmed();
      setPassword("");
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.message ?? "Falha ao confirmar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!busy) { onOpenChange(v); if (!v) setPassword(""); } }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><ShieldAlert className="h-5 w-5 text-destructive" /> {title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground">Senha do gestor master</label>
            <Input type="password" autoFocus value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancelar</Button>
            <Button type="submit" variant="destructive" disabled={busy}>
              {busy ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Verificando...</> : "Confirmar exclusão"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
