// Convite ao representante para revisar as metas do cliente: envia e-mail real com o link
// das metas no portal; no primeiro acesso, cria o usuário e inclui o link para cadastrar a senha.

import { useState } from "react";
import { Loader2, Mail } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { inviteRepToMetas } from "@/lib/performance-metas.functions";

export function ConviteRepresentanteDialog({
  open,
  onOpenChange,
  rowId,
  enabled,
  repName,
  clienteNome,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rowId: string;
  enabled: boolean;
  repName: string;
  clienteNome: string;
}) {
  const [mensagem, setMensagem] = useState(
    `Olá, ${repName}! Gostaríamos da sua colaboração na revisão das metas mensais do cliente ${clienteNome}. ` +
      "Registre sua sugestão por portfólio e deixe sua justificativa.",
  );
  const [enviando, setEnviando] = useState(false);

  async function enviar() {
    setEnviando(true);
    try {
      const r = await inviteRepToMetas({ data: { rowId, mensagem } });
      toast.success(`Convite enviado para ${r.email}.`, {
        description: r.incluiLinkSenha
          ? "O e-mail inclui um link pessoal para cadastrar ou redefinir a senha."
          : "Convite enviado.",
      });
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível enviar o convite.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-4 w-4" /> Convidar representante
          </DialogTitle>
          <DialogDescription>
            O representante recebe por e-mail um link pessoal para cadastrar ou redefinir a senha e,
            em seguida, abrir as metas deste cliente no portal.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 text-sm">
          <p className="text-xs text-muted-foreground">
            Para: <span className="font-medium text-foreground">{repName}</span>
          </p>
          <Textarea
            value={mensagem}
            onChange={(e) => setMensagem(e.target.value)}
            maxLength={2000}
            className="min-h-[120px] text-sm"
          />
          <p className="text-[11px] text-muted-foreground">
            O representante verá apenas a meta oficial, o atingimento e as próprias sugestões —
            nunca a meta padrão, comentários do gestor ou sugestões da IA.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={enviando}>
            Cancelar
          </Button>
          <Button onClick={enviar} disabled={!enabled || enviando || !mensagem.trim()}>
            {enviando && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            Enviar convite
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
