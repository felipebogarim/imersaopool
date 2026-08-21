import { useState, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Plus, Edit, Trash2, Mail, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { SendEmailDialog } from "./SendEmailDialog";

export function TemplateManager() {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSendDialogOpen, setIsSendDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);

  useEffect(() => {
    fetchTemplates();
  }, []);

  async function fetchTemplates() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("app_update_templates")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      setTemplates(data || []);
    } catch (error: any) {
      console.error("Error fetching templates:", error);
      toast.error("Falha ao carregar templates");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Tem certeza que deseja excluir este template?")) return;
    
    try {
      const { error } = await supabase
        .from("app_update_templates")
        .delete()
        .eq("id", id);
      
      if (error) throw error;
      
      toast.success("Template excluído com sucesso");
      fetchTemplates();
    } catch (error: any) {
      console.error("Error deleting template:", error);
      toast.error("Erro ao excluir template");
    }
  }

  function handleEdit(template: any) {
    navigate({ 
      to: "/admin/central-mensagens/template/$id",
      params: { id: template.id }
    });
  }

  function handleCreate() {
    navigate({ 
      to: "/admin/central-mensagens/template/$id",
      params: { id: "new" }
    });
  }

  function handleSendSimulation(type: "email" | "whatsapp", template: any) {
    if (type === "email") {
      setSelectedTemplate(template);
      setIsSendDialogOpen(true);
    } else {
      toast.info(`Simulação de envio (${type}): ${template.name}`);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Templates de Mensagens</h3>
          <p className="text-sm text-muted-foreground">Crie e gerencie templates para e-mail e WhatsApp</p>
        </div>
        <Button size="sm" onClick={handleCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Template
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          <div className="col-span-full text-center py-8 text-muted-foreground">
            Carregando templates...
          </div>
        ) : templates.length === 0 ? (
          <Card className="col-span-full flex flex-col items-center justify-center p-12 text-center border-dashed">
            <Mail className="h-12 w-12 text-muted-foreground/20 mb-4" />
            <CardTitle>Nenhum template criado</CardTitle>
            <CardDescription>Comece criando seu primeiro template de atualização.</CardDescription>
            <Button className="mt-4" variant="outline" onClick={handleCreate}>
              <Plus className="h-4 w-4 mr-2" /> Criar Template
            </Button>
          </Card>
        ) : (
          templates.map((template) => (
            <Card key={template.id} className="flex flex-col">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <Badge variant={template.status === "published" ? "default" : "secondary"}>
                    {template.status === "published" ? "Publicado" : "Rascunho"}
                  </Badge>
                  <div className="flex gap-1">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8"
                      onClick={() => handleEdit(template)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 text-destructive"
                      onClick={() => handleDelete(template.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <CardTitle className="mt-2 text-base">{template.name}</CardTitle>
                <CardDescription className="line-clamp-2">{template.subject}</CardDescription>
              </CardHeader>
              <CardContent className="mt-auto pt-0">
                <div className="flex gap-2 w-full mt-4">
                  <Button 
                    variant="outline" 
                    className="flex-1 text-xs gap-1 h-8"
                    onClick={() => handleSendSimulation("email", template)}
                  >
                    <Mail className="h-3 w-3" /> E-mail
                  </Button>
                  <Button 
                    variant="outline" 
                    className="flex-1 text-xs gap-1 h-8 text-emerald-600 border-emerald-200 bg-emerald-50 hover:bg-emerald-100"
                    onClick={() => handleSendSimulation("whatsapp", template)}
                  >
                    <MessageSquare className="h-3 w-3" /> WhatsApp
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>


      <SendEmailDialog 
        open={isSendDialogOpen}
        onOpenChange={setIsSendDialogOpen}
        template={selectedTemplate}
      />
    </div>
  );
}

