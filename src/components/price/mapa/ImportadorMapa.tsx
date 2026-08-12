import { useState, useRef } from "react";
import { Upload, X, FileSpreadsheet, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { processRawMapaRows, RawMapaRow } from "@/lib/price-mapa/parser/import-logic";

interface ImportadorMapaProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  familia: string;
  onImported: (anchors: any[], competitors: any[]) => void;
}

export function ImportadorMapa({ open, onOpenChange, familia, onImported }: ImportadorMapaProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.name.endsWith(".xlsx") || selectedFile.name.endsWith(".xls")) {
        setFile(selectedFile);
      } else {
        toast.error("Por favor, selecione um arquivo Excel (.xlsx ou .xls)");
      }
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setIsProcessing(true);
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      
      const sheetName = workbook.SheetNames.find(n => 
        n.toUpperCase().includes("MAPA_PRECOS") || 
        n.toUpperCase().includes("MAPA_PRECOS_PERFIS") ||
        n.toUpperCase().includes("CONCORRENTES")
      ) || workbook.SheetNames[0];

      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      const rawRows: RawMapaRow[] = jsonData.map((row: any) => {
        return {
          familia: row["Família"] || row["familia"] || familia,
          base_produto: row["Produto Base Newline"] || row["base_produto"] || row["PRODUTO_BASE"] || row["Produto"],
          base_codigo: String(row["Código Newline"] || row["base_codigo"] || row["CÓDIGO"] || row["SKU_NEWLINE"] || ""),
          base_preco: Number(row["Preço Newline"] || row["base_preco"] || row["PREÇO"] || row["VALOR_NEWLINE"] || 0),
          concorrente_marca: row["Marca Concorrente"] || row["concorrente_marca"] || row["MARCA"] || row["CONCORRENTE"],
          concorrente_modelo: row["Modelo Concorrente"] || row["concorrente_modelo"] || row["MODELO"] || row["ITEM"],
          concorrente_codigo: row["Código Concorrente"] || row["concorrente_codigo"] || row["CÓDIGO_CONCORRENTE"],
          concorrente_preco: Number(row["Preço Concorrente"] || row["concorrente_preco"] || row["PREÇO_CONCORRENTE"] || row["VALOR"] || 0),
          classificacao: row["Classificação"] || row["classificacao"] || row["EQUIVALÊNCIA"] || "",
          nicho: row["Nicho"] || row["nicho"],
          largura: row["Largura"] || row["largura"],
          altura: row["Altura"] || row["altura"],
          notas: row["Notas"] || row["notas"],
        };
      });


      const { anchors, competitors } = processRawMapaRows(rawRows);

      if (competitors.length === 0) {
        toast.error("Nenhum registro válido encontrado na planilha.");
        return;
      }

      onImported(anchors, competitors);
      toast.success(`${competitors.length} comparações da família ${familia} importadas com sucesso!`);
      onOpenChange(false);
      setFile(null);
    } catch (error) {
      console.error("Erro ao processar arquivo:", error);
      toast.error("Falha ao processar o arquivo. Verifique o formato.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] bg-[#0A0A0A] border-white/10 text-white">
        <DialogHeader>
          <DialogTitle className="text-xl font-light flex items-center gap-2">
            <Upload className="h-5 w-5 text-nl-gold" />
            Importar Dados: {familia}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground font-light pt-2">
            Carregue uma planilha Excel contendo os produtos âncora e comparativos de mercado para a família selecionada.
          </DialogDescription>
        </DialogHeader>

        <div className="py-6">
          {!file ? (
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-white/10 rounded-xl p-10 flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-nl-gold/30 hover:bg-white/5 transition-all group"
            >
              <div className="h-12 w-12 rounded-full bg-white/5 flex items-center justify-center group-hover:scale-110 transition-transform">
                <FileSpreadsheet className="h-6 w-6 text-muted-foreground group-hover:text-nl-gold" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium">Clique para selecionar ou arraste</p>
                <p className="text-xs text-muted-foreground mt-1">Excel (.xlsx, .xls) até 10MB</p>
              </div>
            </div>
          ) : (
            <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-nl-gold/10 flex items-center justify-center">
                  <FileSpreadsheet className="h-5 w-5 text-nl-gold" />
                </div>
                <div>
                  <p className="text-sm font-medium truncate max-w-[200px]">{file.name}</p>
                  <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(0)} KB</p>
                </div>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                className="text-muted-foreground hover:text-destructive"
                onClick={() => setFile(null)}
                disabled={isProcessing}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept=".xlsx,.xls"
            onChange={handleFileChange}
          />
        </div>

        <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 flex gap-3">
          <AlertCircle className="h-5 w-5 text-amber-500 shrink-0" />
          <p className="text-[11px] text-amber-200/80 font-light leading-relaxed">
            Certifique-se de que a planilha segue o padrão estruturado (Abas: "Ancoragem" e "Concorrentes") para que a IA processe corretamente os dados.
          </p>
        </div>

        <DialogFooter className="mt-6">
          <Button 
            variant="ghost" 
            onClick={() => onOpenChange(false)}
            disabled={isProcessing}
            className="text-white hover:bg-white/5"
          >
            Cancelar
          </Button>
          <Button 
            onClick={handleUpload}
            disabled={!file || isProcessing}
            className="bg-nl-gold text-black hover:bg-nl-gold/90 min-w-[120px]"
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processando...
              </>
            ) : (
              "Importar Dados"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
