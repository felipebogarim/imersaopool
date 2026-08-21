import { Card, CardContent } from "@/components/ui/card";

interface ContentBlock {
  id: string;
  media_url?: string;
  media_type?: 'image' | 'video';
  video_url?: string;
  description: string;
}

interface TemplatePreviewProps {
  name: string;
  intro: string;
  blocks: ContentBlock[];
  farewell: string;
}

export function TemplatePreview({ name, intro, blocks, farewell }: TemplatePreviewProps) {
  return (
    <div className="w-full bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
      <div className="bg-[#003087] p-6">
        <h2 className="text-white text-xl font-bold">{name || "Nome da novidade"}</h2>
      </div>
      
      <div className="p-6 space-y-6">
        <div className="text-slate-600 whitespace-pre-line leading-relaxed">
          {intro || "Olá! Temos novidades no sistema para você."}
        </div>

        <div className="space-y-8">
          {blocks.map((block, index) => (
            <div key={block.id} className="space-y-4 pt-4 border-t border-slate-100 first:border-0 first:pt-0">
              {block.media_url ? (
                <div className="rounded-lg overflow-hidden border border-slate-100 shadow-sm bg-slate-50">
                  {block.media_type === 'video' ? (
                    <video src={block.media_url} controls className="w-full max-h-[400px] object-contain" />
                  ) : (
                    <img src={block.media_url} alt={`Block ${index + 1}`} className="w-full max-h-[400px] object-contain" />
                  )}
                </div>
              ) : block.video_url ? (
                <div className="aspect-video rounded-lg overflow-hidden border border-slate-100 shadow-sm bg-slate-50">
                  <div className="w-full h-full flex items-center justify-center text-slate-400 text-sm">
                    {/* Simplified video embed preview */}
                    Video: {block.video_url}
                  </div>
                </div>
              ) : null}

              {block.description && (
                <div className="text-slate-700 whitespace-pre-line leading-relaxed">
                  {block.description}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="pt-6 border-t border-slate-100">
          <div className="text-slate-500 italic text-sm">
            {farewell || "Equipe Delis Iluminação"}
          </div>
        </div>
      </div>
    </div>
  );
}
