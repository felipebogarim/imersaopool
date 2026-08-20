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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Users } from "lucide-react";

interface GroupManagerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GroupManagerDialog({ open, onOpenChange }: GroupManagerDialogProps) {
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newGroupName, setNewGroupName] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (open) {
      fetchGroups();
    }
  }, [open]);

  async function fetchGroups() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("app_email_contact_groups")
        .select("*")
        .order("name", { ascending: true });
      
      if (error) throw error;
      setGroups(data || []);
    } catch (error: any) {
      console.error("Error fetching groups:", error);
      toast.error("Erro ao carregar grupos");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateGroup() {
    if (!newGroupName.trim()) return;
    
    try {
      setCreating(true);
      const { error } = await supabase
        .from("app_email_contact_groups")
        .insert([{ name: newGroupName.trim() }]);
      
      if (error) throw error;
      
      toast.success("Grupo criado com sucesso");
      setNewGroupName("");
      fetchGroups();
    } catch (error: any) {
      console.error("Error creating group:", error);
      toast.error("Erro ao criar grupo");
    } finally {
      setCreating(false);
    }
  }

  async function handleDeleteGroup(id: string) {
    if (!confirm("Tem certeza que deseja excluir este grupo?")) return;
    
    try {
      const { error } = await supabase
        .from("app_email_contact_groups")
        .delete()
        .eq("id", id);
      
      if (error) throw error;
      
      toast.success("Grupo excluído com sucesso");
      fetchGroups();
    } catch (error: any) {
      console.error("Error deleting group:", error);
      toast.error("Erro ao excluir grupo");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Gerenciar Grupos
          </DialogTitle>
          <DialogDescription>
            Crie grupos para organizar seus contatos.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="flex gap-2 items-end">
            <div className="flex-1 space-y-2">
              <Label htmlFor="new-group">Novo Grupo</Label>
              <Input 
                id="new-group"
                placeholder="Nome do grupo..." 
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreateGroup()}
              />
            </div>
            <Button onClick={handleCreateGroup} disabled={creating || !newGroupName.trim()}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            </Button>
          </div>

          <div className="border rounded-md overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome do Grupo</TableHead>
                  <TableHead className="text-right w-[100px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={2} className="text-center py-4 text-muted-foreground">
                      Carregando...
                    </TableCell>
                  </TableRow>
                ) : groups.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={2} className="text-center py-4 text-muted-foreground">
                      Nenhum grupo criado.
                    </TableCell>
                  </TableRow>
                ) : (
                  groups.map((group) => (
                    <TableRow key={group.id}>
                      <TableCell className="font-medium">{group.name}</TableCell>
                      <TableCell className="text-right">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-destructive"
                          onClick={() => handleDeleteGroup(group.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}