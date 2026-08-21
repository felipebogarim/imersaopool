import { useState, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { 
  ChevronLeft, 
  Plus, 
  Save, 
  Send, 
  Image as ImageIcon, 
  Film, 
  Bold, 
  Italic, 
  Type,
  Trash2,
  Loader2,
  Upload
} from "lucide-react";
import { toast } from "sonner";
import { ContentBlockEditor } from "./ContentBlockEditor";
import { TemplatePreview } from "./TemplatePreview";

interface ContentBlock {
  id: string;
  media_url?: string;
  media_type?: 'image' | 'video';
  video_url?: string;
  description: string;
}

interface TemplateEditorProps {
  templateId?: string;
}

export function TemplateEditor({ templateId }: TemplateEditorProps) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [intro, setIntro] = useState("Olá! Temos novidades no sistema para você.");
  const [farewell, setFarewell] = useState("Equipe Delis Iluminação");
  const [blocks, setBlocks] = useState<ContentBlock[]>([]);
  const [status, setStatus] = useState<"draft" | "published">("draft");

  useEffect(() => {
    if (templateId) {
      fetchTemplate();
    }
  }, [templateId]);

  async function fetchTemplate() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("app_update_templates")
        .select("*")
        .eq("id", templateId!)
        .single();
      
      if (error) throw error;
      
      setName(data.name || "");
      setSubject(data.subject || "");
      setIntro(data.intro || "");
      setFarewell(data.farewell || "");
      setBlocks((data.blocks as any[]) || []);
      setStatus((data.status as any) || "draft");
    } catch (error: any) {
      console.error("Error fetching template:", error);
      toast.error("Erro ao carregar template");
    } finally {
      setLoading(false);
    }
  }

  const addBlock = () => {
    const newBlock: ContentBlock = {
      id: crypto.randomUUID(),
      description: "",
    };
    setBlocks([...blocks, newBlock]);
  };

  const removeBlock = (id: string) => {
    setBlocks(blocks.filter(b => b.id !== id));
  };

  const updateBlock = (id: string, updates: Partial<ContentBlock>) => {
    setBlocks(blocks.map(b => b.id === id ? { ...b, ...updates } : b));
  };

  async function handleSave(newStatus?: "draft" | "published") {
    try {
      setSaving(true);
      const currentStatus = newStatus || status;
      
      const payload = {
        name,
        subject: subject || name,
        intro,
        farewell,
        blocks: blocks as any,
        status: currentStatus,
        updated_at: new Date().toISOString(),
      };

      if (templateId) {
        const { error } = await supabase
          .from("app_update_templates")
          .update(payload)
          .eq("id", templateId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("app_update_templates")
          .insert([payload]);
        if (error) throw error;
      }

      toast.success(currentStatus === "published" ? "Template publicado com sucesso" : "Rascunho salvo com sucesso");
      navigate({ to: "/admin/central-mensagens" });
    } catch (error: any) {
      console.error("Error saving template:", error);
      toast.error("Erro ao salvar template");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-50/50">
      <header className="flex items-center justify-between p-4 border-b bg-white">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/admin/central-mensagens" })}>
            <ChevronLeft className="h-4 w-4 mr-1" />
            Voltar
          </Button>
          <h1 className="text-xl font-bold text-slate-900">Emails de Atualizações</h1>
        </div>
      </header>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-[1200px] mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Editor Column */}
          <div className="space-y-6">
            <section className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Mensagem de introdução</label>
              <Textarea 
                value={intro}
                onChange={(e) => setIntro(e.target.value)}
                placeholder="Olá! Temos novidades no sistema para você."
                className="bg-white min-h-[100px]"
              />
            </section>

            <section className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Nome da novidade</label>
              <Input 
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Novo módulo de Backup"
                className="bg-white"
              />
            </section>

            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-700">Blocos de conteúdo</h2>
                <Button variant="outline" size="sm" onClick={addBlock}>
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar bloco
                </Button>
              </div>

              {blocks.map((block, index) => (
                <ContentBlockEditor 
                  key={block.id}
                  block={block}
                  index={index}
                  onUpdate={(updates: Partial<ContentBlock>) => updateBlock(block.id, updates)}
                  onRemove={() => removeBlock(block.id)}
                />
              ))}
            </section>

            <section className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Mensagem de despedida</label>
              <Textarea 
                value={farewell}
                onChange={(e) => setFarewell(e.target.value)}
                placeholder="Equipe Delis Iluminação"
                className="bg-white min-h-[100px]"
              />
            </section>

            <div className="flex gap-4 pt-4">
              <Button 
                variant="outline" 
                className="flex-1"
                onClick={() => handleSave("draft")}
                disabled={saving}
              >
                <Save className="h-4 w-4 mr-2" />
                Salvar rascunho
              </Button>
              <Button 
                className="flex-1 bg-slate-900"
                onClick={() => handleSave("published")}
                disabled={saving}
              >
                <Send className="h-4 w-4 mr-2" />
                Publicar
              </Button>
            </div>
          </div>

          {/* Preview Column */}
          <div className="sticky top-0">
            <div className="flex items-center gap-2 mb-2 text-slate-500 text-sm">
              <ImageIcon className="h-4 w-4" />
              <span>Pré-visualização</span>
            </div>
            <TemplatePreview 
              name={name}
              intro={intro}
              blocks={blocks}
              farewell={farewell}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
