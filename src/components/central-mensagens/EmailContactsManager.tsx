import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { UserPlus, Users, Trash2, Edit } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { ContactDialog } from "./ContactDialog";
import { GroupManagerDialog } from "./GroupManagerDialog";

export function EmailContactsManager() {
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isContactDialogOpen, setIsContactDialogOpen] = useState(false);
  const [isGroupDialogOpen, setIsGroupDialogOpen] = useState(false);
  const [selectedContact, setSelectedContact] = useState<any>(null);

  useEffect(() => {
    fetchContacts();
  }, []);

  async function fetchContacts() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("app_email_contacts")
        .select("*")
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

  async function handleDeleteContact(id: string) {
    if (!confirm("Tem certeza que deseja excluir este contato?")) return;
    
    try {
      const { error } = await supabase
        .from("app_email_contacts")
        .delete()
        .eq("id", id);
      
      if (error) throw error;
      
      toast.success("Contato excluído com sucesso");
      fetchContacts();
    } catch (error: any) {
      console.error("Error deleting contact:", error);
      toast.error("Erro ao excluir contato");
    }
  }

  function handleEditContact(contact: any) {
    setSelectedContact(contact);
    setIsContactDialogOpen(true);
  }

  function handleCreateContact() {
    setSelectedContact(null);
    setIsContactDialogOpen(true);
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Lista de Contatos</h3>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setIsGroupDialogOpen(true)}>
            <Users className="h-4 w-4 mr-2" />
            Grupos
          </Button>
          <Button size="sm" onClick={handleCreateContact}>
            <UserPlus className="h-4 w-4 mr-2" />
            Novo Contato
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Tags</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Carregando contatos...
                  </TableCell>
                </TableRow>
              ) : contacts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Nenhum contato encontrado.
                  </TableCell>
                </TableRow>
              ) : (
                contacts.map((contact) => (
                  <TableRow key={contact.id}>
                    <TableCell className="font-medium">{contact.name}</TableCell>
                    <TableCell>{contact.email}</TableCell>
                    <TableCell>{contact.phone || "-"}</TableCell>
                    <TableCell>
                      <Badge variant={contact.active ? "default" : "secondary"} className="text-[10px]">
                        {contact.active ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {contact.tags?.map((tag: string) => (
                          <Badge key={tag} variant="secondary" className="text-[10px] py-0">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8"
                          onClick={() => handleEditContact(contact)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-destructive"
                          onClick={() => handleDeleteContact(contact.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <ContactDialog 
        open={isContactDialogOpen}
        onOpenChange={setIsContactDialogOpen}
        contact={selectedContact}
        onSuccess={fetchContacts}
      />

      <GroupManagerDialog 
        open={isGroupDialogOpen}
        onOpenChange={setIsGroupDialogOpen}
      />
    </div>
  );
}

