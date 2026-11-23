// Convite ao representante para colaborar com a revisão de metas.
// Nesta etapa é só uma prévia: nenhum e-mail é enviado.

import { useState } from "react";
import { Mail } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";

export function ConviteRepresentanteDialog({
  open,
  onOpenChange,
  repName,
  clienteNome,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  repName: string;
  clienteNome: string;
}) {
  const [mensagem, setMensagem] = useState(
    `Olá, ${repName}! Gostaríamos da sua colaboração na revisão das metas mensais do cliente ${clienteNome}. ` +
      "Acesse o painel, registre sua sugestão por portfólio e deixe seus comentários.",
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-4 w-4" /> Convidar representante
            <Badge variant="secondary" className="text-[9px] uppercase">
              Simulação
            </Badge>
          </DialogTitle>
          <DialogDescription>
            Prévia do convite para revisão colaborativa de metas. Nesta etapa nenhum e-mail é
            enviado e nenhum acesso é criado.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 text-sm">
          <p className="text-xs text-muted-foreground">
            Para: <span className="font-medium text-foreground">{repName}</span>
          </p>
          <Textarea
            value={mensagem}
            onChange={(e) => setMensagem(e.target.value)}
            className="min-h-[120px] text-sm"
          />
          <p className="text-[11px] text-muted-foreground">
            O representante verá apenas a meta oficial, as próprias sugestões e os próprios
            comentários.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => {
              toast.info("Simulação: nenhum convite foi enviado.");
              onOpenChange(false);
            }}
          >
            Enviar convite (simulação)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
