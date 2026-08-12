import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { BrandAdjustment } from "@/lib/price-mapa/types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Info } from "lucide-react";

interface CenárioSimuladorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  adjustments: BrandAdjustment[];
  onAdjustmentsChange: (adjustments: BrandAdjustment[]) => void;
}

export function CenárioSimulador({
  open,
  onOpenChange,
  adjustments,
  onAdjustmentsChange
}: CenárioSimuladorProps) {
  const brands = ["Interlight", "Perfil & LED", "Usina", "Spotline", "Astraled", "Nordecor"];

  const handleUpdate = (brand: string, value: string) => {
    const numericValue = parseFloat(value) || 0;
    const existing = adjustments.find(a => a.brand === brand);
    
    if (existing) {
      onAdjustmentsChange(adjustments.map(a => 
        a.brand === brand ? { ...a, adjustmentPct: numericValue } : a
      ));
    } else {
      onAdjustmentsChange([...adjustments, { brand, adjustmentPct: numericValue }]);
    }
  };

  const getBrandValue = (brand: string) => {
    return adjustments.find(a => a.brand === brand)?.adjustmentPct ?? 0;
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[400px] sm:w-[540px] bg-[#0A0A0A] border-white/10 text-white overflow-y-auto">
        <SheetHeader className="space-y-4">
          <SheetTitle className="text-2xl font-light text-nl-gold">Simulador de Cenários</SheetTitle>
          <SheetDescription className="text-muted-foreground font-light">
            Ajuste o posicionamento dos concorrentes para simular novos cenários competitivos.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-8 space-y-6">
          <div className="bg-nl-gold/5 border border-nl-gold/20 p-4 rounded-xl flex gap-3">
            <Info className="h-5 w-5 text-nl-gold shrink-0 mt-0.5" />
            <p className="text-xs text-nl-gold/80 font-light leading-relaxed">
              O ajuste percentual é aplicado sobre o preço normalizado do concorrente. 
              Valores negativos simulam descontos, valores positivos simulam aumentos.
            </p>
          </div>

          <Separator className="bg-white/5" />

          <div className="space-y-4">
            {brands.map(brand => (
              <div key={brand} className="flex items-center justify-between gap-4 p-3 rounded-lg border border-white/5 bg-white/[0.02]">
                <span className="text-sm font-light uppercase tracking-wider">{brand}</span>
                <div className="flex items-center gap-2">
                  <Input 
                    type="number"
                    className="w-24 bg-background border-white/10 text-right h-9"
                    value={getBrandValue(brand)}
                    onChange={(e) => handleUpdate(brand, e.target.value)}
                  />
                  <span className="text-xs text-muted-foreground w-4">%</span>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-6 flex gap-3">
            <Button 
              className="flex-1 bg-nl-gold text-black hover:bg-nl-gold/90 font-medium"
              onClick={() => onOpenChange(false)}
            >
              Aplicar Cenário
            </Button>
            <Button 
              variant="outline" 
              className="flex-1 border-white/10 font-light"
              onClick={() => onAdjustmentsChange([])}
            >
              Resetar
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
