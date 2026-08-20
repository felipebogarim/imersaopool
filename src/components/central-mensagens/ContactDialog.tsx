import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const formSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  email: z.string().email("E-mail inválido"),
  phone: z.string().optional(),
  tags: z.string().optional(),
  notes: z.string().optional(),
  active: z.boolean(),
});

type FormValues = z.infer<typeof formSchema>;

interface ContactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact?: any;
  onSuccess: () => void;
}

export function ContactDialog({ open, onOpenChange, contact, onSuccess }: ContactDialogProps) {
  const [loading, setLoading] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      tags: "",
      notes: "",
      active: true,
    },
  });

  useEffect(() => {
    if (contact) {
      form.reset({
        name: contact.name || "",
        email: contact.email || "",
        phone: contact.phone || "",
        tags: contact.tags ? contact.tags.join(", ") : "",
        notes: contact.notes || "",
        active: contact.active ?? true,
      });
    } else {
      form.reset({
        name: "",
        email: "",
        phone: "",
        tags: "",
        notes: "",
        active: true,
      });
    }
  }, [contact, form, open]);

  async function onSubmit(values: FormValues) {
    try {
      setLoading(true);
      
      const tagList = values.tags 
        ? values.tags.split(",").map(t => t.trim()).filter(t => t !== "") 
        : [];

      const payload = {
        name: values.name,
        email: values.email,
        phone: values.phone,
        tags: tagList,
        notes: values.notes,
        active: values.active,
      };

      if (contact?.id) {
        const { error } = await supabase
          .from("app_email_contacts")
          .update(payload)
          .eq("id", contact.id);
        
        if (error) throw error;
        toast.success("Contato atualizado com sucesso");
      } else {
        const { error } = await supabase
          .from("app_email_contacts")
          .insert([payload]);
        
        if (error) throw error;
        toast.success("Contato criado com sucesso");
      }

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error saving contact:", error);
      toast.error("Erro ao salvar contato: " + error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{contact ? "Editar Contato" : "Novo Contato"}</DialogTitle>
          <DialogDescription>
            Informações do destinatário para envios de mensagens.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome Completo</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: João Silva" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>E-mail</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="joao@exemplo.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Telefone (WhatsApp)</FormLabel>
                    <FormControl>
                      <Input placeholder="+55 11 99999-9999" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="tags"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tags</FormLabel>
                  <FormControl>
                    <Input placeholder="Vendedor, Cliente, VIP (separados por vírgula)" {...field} />
                  </FormControl>
                  <FormDescription>
                    Use tags para organizar e filtrar contatos.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Observações</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Informações adicionais..." 
                      className="min-h-[80px]"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="active"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                  <div className="space-y-0.5">
                    <FormLabel>Contato Ativo</FormLabel>
                    <FormDescription>
                      Desative para pausar envios para este contato.
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {contact ? "Atualizar" : "Criar Contato"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}