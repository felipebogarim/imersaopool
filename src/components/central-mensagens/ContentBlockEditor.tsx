import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { 
  ImageIcon, 
  Film, 
  Bold, 
  Italic, 
  Type,
  Trash2,
  Upload,
  Loader2,
  Link as LinkIcon,
  List,
  AlignLeft
} from "lucide-react";
import { toast } from "sonner";

interface ContentBlock {
  id: string;
  media_url?: string;
  media_type?: 'image' | 'video';
  video_url?: string;
  description: string;
}

interface ContentBlockEditorProps {
  block: ContentBlock;
  index: number;
  onUpdate: (updates: Partial<ContentBlock>) => void;
  onRemove: () => void;
}

export function ContentBlockEditor({ block, index, onUpdate, onRemove }: ContentBlockEditorProps) {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handlePaste = async (event: ClipboardEvent) => {
      const items = event.clipboardData?.items;
      if (!items) return;

      for (const item of items) {
        if (item.type.indexOf("image") !== -1) {
          const file = item.getAsFile();
          if (file) {
            await uploadFile(file);
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, []);

  const uploadFile = async (file: File) => {
    try {
      setUploading(true);
      const fileExt = file.name.split('.').pop() || 'png';
      const fileName = `${crypto.randomUUID()}.${fileExt}`;
      const filePath = `templates/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('app_update_assets')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('app_update_assets')
        .getPublicUrl(filePath);

      onUpdate({ 
        media_url: publicUrl, 
        media_type: file.type.startsWith('video/') ? 'video' : 'image' 
      });
      toast.success("Arquivo enviado com sucesso");
    } catch (error: any) {
      console.error("Error uploading file:", error);
      toast.error("Erro ao enviar arquivo: " + error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) uploadFile(file);
  };

  const applyFormat = (format: string) => {
    // Basic formatting logic could go here if using a textarea
    // For now, we'll just focus on the visual representation as requested
    toast.info(`Formatação ${format} selecionada (demonstrativo)`);
  };

  return (
    <Card className="bg-white border-slate-200">
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-700 font-mono">Bloco {index + 1}</h3>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-500" onClick={onRemove}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs text-slate-500">Imagem ou vídeo</label>
            <div 
              className="border-2 border-dashed border-slate-200 rounded-lg p-8 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-slate-300 transition-colors bg-slate-50/50"
              onClick={() => fileInputRef.current?.click()}
            >
              {uploading ? (
                <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
              ) : block.media_url ? (
                <div className="relative group">
                  {block.media_type === 'video' ? (
                    <video src={block.media_url} className="max-h-40 rounded shadow-sm" controls />
                  ) : (
                    <img src={block.media_url} alt="Media" className="max-h-40 rounded shadow-sm" />
                  )}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity rounded">
                    <span className="text-white text-xs font-medium">Trocar mídia</span>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex gap-2">
                    <ImageIcon className="h-6 w-6 text-slate-400" />
                    <Film className="h-6 w-6 text-slate-400" />
                  </div>
                  <p className="text-xs text-slate-400 text-center">
                    Clique para enviar imagem ou vídeo · ou cole (Ctrl+V) um print
                  </p>
                </>
              )}
            </div>
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="image/*,video/*"
              onChange={handleFileUpload}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <LinkIcon className="h-3 w-3" />
              <span>Ou cole link do vídeo (YouTube, Vimeo, MP4...)</span>
            </div>
            <Input 
              value={block.video_url || ""}
              onChange={(e) => onUpdate({ video_url: e.target.value })}
              placeholder="https://..."
              className="h-9"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs text-slate-500">Texto descritivo</label>
            <div className="border rounded-md overflow-hidden border-slate-200">
              <div className="flex items-center gap-1 p-1 bg-slate-50 border-b border-slate-200">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => applyFormat('bold')}>
                  <Bold className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => applyFormat('italic')}>
                  <Italic className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => applyFormat('list')}>
                  <List className="h-3.5 w-3.5" />
                </Button>
                <div className="h-4 w-[1px] bg-slate-200 mx-1" />
                <Button variant="ghost" size="sm" className="h-7 px-2 text-[10px]" onClick={() => applyFormat('size')}>
                  Tamanho
                  <Type className="h-3 w-3 ml-1" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => applyFormat('align')}>
                  <AlignLeft className="h-3.5 w-3.5" />
                </Button>
              </div>
              <Textarea 
                value={block.description}
                onChange={(e) => onUpdate({ description: e.target.value })}
                placeholder="Descreva esta novidade..."
                className="border-0 focus-visible:ring-0 min-h-[100px] resize-none"
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
