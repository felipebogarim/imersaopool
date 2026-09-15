import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageSquare, Copy } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: any;
}

function buildMessage(template: any) {
  const parts: string[] = [];
  if (template?.name) parts.push(`*${template.name}*`);
  if (template?.intro) parts.push(String(template.intro));
  const blocks = Array.isArray(template?.blocks) ? template.blocks : [];
  for (const b of blocks) {
    if (b?.description) parts.push(String(b.description));
    if (b?.media_url) parts.push(String(b.media_url));
    else if (b?.video_url) parts.push(String(b.video_url));
  }
  if (template?.farewell) parts.push(String(template.farewell));
  return parts.join("\n\n");
}

export function SendWhatsappDialog({ open, onOpenChange, template }: Props) {
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const message = buildMessage(template);

  useEffect(() => {
    if (!open) return;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("app_email_contacts")
        .select("*")
        .eq("active", true)
        .order("name", { ascending: true });
      if (error) toast.error("Falha ao carregar contatos");
      setContacts((data || []).filter((c: any) => c.phone));
      setLoading(false);
    })();
  }, [open]);

  function openChat(phone: string) {
    const digits = String(phone).replace(/\D/g, "");
    const full = digits.length <= 11 ? `55${digits}` : digits;
    window.open(`https://wa.me/${full}?text=${encodeURIComponent(message)}`, "_blank", "noopener");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] flex flex-col max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Enviar por WhatsApp</DialogTitle>
          <DialogDescription>
            Abra a conversa com a mensagem já preenchida:{" "}
            <span className="font-semibold text-foreground">{template?.name}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="bg-muted/30 border rounded-md p-3 text-sm whitespace-pre-line max-h-40 overflow-auto">
          {message || "Mensagem vazia"}
        </div>

        <ScrollArea className="flex-1 border rounded-md min-h-[120px]">
          <div className="p-2 space-y-1">
            {loading ? (
              <div className="py-8 text-center text-muted-foreground text-sm">Carregando contatos...</div>
            ) : contacts.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground text-sm">
                Nenhum contato com telefone cadastrado.
              </div>
            ) : (
              contacts.map((c) => (
                <div key={c.id} className="flex items-center gap-3 p-2 hover:bg-muted/50 rounded-sm">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium leading-none truncate">{c.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{c.phone}</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => openChat(c.phone)}>
                    <MessageSquare className="h-3 w-3 mr-1" /> Abrir
                  </Button>
                </div>
              ))
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="mt-2">
          <Button
            variant="outline"
            onClick={() => {
              navigator.clipboard.writeText(message);
              toast.success("Mensagem copiada");
            }}
          >
            <Copy className="h-4 w-4 mr-2" /> Copiar mensagem
          </Button>
          <Button onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
