import { useRef, useState } from "react";
import { FileUp, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  extractEditorialChapters,
  parseVisaoImersao2File,
  type V2Chapter,
} from "@/lib/visao-imersao-2-import";
import type { Immersion2Data } from "@/lib/visao-imersao-2-parser";

export type VisaoImersao2Import = {
  data: Immersion2Data;
  chapters: V2Chapter[];
  arquivo: string;
  markdown: string;
  id?: string;
};

export function VisaoImersao2Importer({
  onValidated,
  variant = "default",
  label = "Carregar relatório Visão Imersão 2",
}: {
  onValidated: (value: VisaoImersao2Import) => void;
  variant?: "default" | "outline";
  label?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);

  async function handleVisaoImersao2Upload(file: File) {
    setLoading(true);
    try {
      const markdown = await file.text();
      const data = parseVisaoImersao2File(markdown);
      onValidated({
        data,
        chapters: extractEditorialChapters(markdown),
        arquivo: file.name,
        markdown,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Arquivo incompatível com Visão Imersão 2.");
    } finally {
      setLoading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <>
      <Button variant={variant} onClick={() => inputRef.current?.click()} disabled={loading}>
        {loading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <FileUp className="mr-1 h-4 w-4" />}
        {label}
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept=".md,.markdown,text/markdown,text/plain"
        className="hidden"
        aria-label="Selecionar arquivo da Visão Imersão 2"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void handleVisaoImersao2Upload(file);
        }}
      />
    </>
  );
}