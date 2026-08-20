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
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Search, Mail, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface SendEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: any;
}

export function SendEmailDialog({ open, onOpenChange, template }: SendEmailDialogProps) {
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useEffect(() => {
    if (open) {
      fetchContacts();
    }
  }, [open]);

  async function fetchContacts() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("app_email_contacts")
        .select("*")
        .eq("active", true)
        .order("name", { ascending: true });
      
      if (error) throw error;
      setContacts(data || []);
    } catch (error: any) {
      console.error("Error fetching contacts:", error);
      toast.error("Falha ao carregar contatos");
    } finally {
      setLoading(false);
    }
  }

  const filteredContacts = contacts.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) || 
    c.email.toLowerCase().includes(search.toLowerCase())
  );

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    if (selectedIds.length === filteredContacts.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredContacts.map(c => c.id));
    }
  };

  async function handleSend() {
    if (selectedIds.length === 0) {
      toast.error("Selecione pelo menos um destinatário");
      return;
    }

    try {
      setSending(true);
      // Simulação de envio
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      toast.success(`E-mail enviado com sucesso para ${selectedIds.length} destinatários`);
      onOpenChange(false);
      setSelectedIds([]);
    } catch (error) {
      toast.error("Erro ao enviar e-mail");
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] flex flex-col max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Visualizar e Enviar E-mail</DialogTitle>
          <DialogDescription>
            Escolha os destinatários para o template: <span className="font-semibold text-foreground">{template?.name}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="bg-muted/30 border rounded-md p-4 mb-4 text-sm">
          <div className="font-semibold mb-1">Assunto: {template?.subject}</div>
          <div className="text-muted-foreground whitespace-pre-line line-clamp-4">
            {template?.intro}
            {"\n\n"}
            {template?.farewell}
          </div>
        </div>

        <div className="space-y-3 flex-1 overflow-hidden flex flex-col">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar contatos..."
                className="pl-8 h-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Button variant="outline" size="sm" onClick={selectAll}>
              {selectedIds.length === filteredContacts.length && filteredContacts.length > 0 ? "Desmarcar Todos" : "Selecionar Todos"}
            </Button>
          </div>

          <ScrollArea className="flex-1 border rounded-md">
            <div className="p-2 space-y-1">
              {loading ? (
                <div className="py-8 text-center text-muted-foreground text-sm">
                  Carregando destinatários...
                </div>
              ) : filteredContacts.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground text-sm">
                  Nenhum contato encontrado.
                </div>
              ) : (
                filteredContacts.map(contact => (
                  <div 
                    key={contact.id} 
                    className="flex items-center space-x-3 p-2 hover:bg-muted/50 rounded-sm cursor-pointer"
                    onClick={() => toggleSelect(contact.id)}
                  >
                    <Checkbox 
                      checked={selectedIds.includes(contact.id)}
                      onCheckedChange={() => toggleSelect(contact.id)}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium leading-none truncate">{contact.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{contact.email}</p>
                    </div>
                    {contact.tags && contact.tags.length > 0 && (
                      <Badge variant="secondary" className="text-[10px] py-0 px-1">
                        {contact.tags[0]}
                      </Badge>
                    )}
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </div>

        <DialogFooter className="mt-4 shrink-0">
          <div className="flex items-center justify-between w-full">
            <span className="text-xs text-muted-foreground">
              {selectedIds.length} selecionado(s)
            </span>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
                Cancelar
              </Button>
              <Button onClick={handleSend} disabled={sending || selectedIds.length === 0}>
                {sending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Mail className="mr-2 h-4 w-4" />
                )}
                Enviar E-mail
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
