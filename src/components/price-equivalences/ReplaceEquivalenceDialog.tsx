// Substitui (ou define) o concorrente equivalente de um produto base, pela aba Equivalências.
// Origem gravada: "Validação manual do administrador".
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ProductCombobox, productCode } from "@/components/price-comparison-groups/ProductCombobox";
import type { LoadedProduct } from "@/lib/price-comparativos-data";
import { fetchBrandOptions } from "@/lib/price-comparison-lookup";
import { saveOfficialEquivalence } from "@/lib/price-equivalences-official";

export function ReplaceEquivalenceDialog({
  open,
  onOpenChange,
  base,
  replaceId,
  initialBrand,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  base: LoadedProduct;
  replaceId: string | null;
  initialBrand: string | null;
  onSaved: () => void;
}) {
  const [brand, setBrand] = useState(initialBrand ?? "");
  const [product, setProduct] = useState<LoadedProduct | null>(null);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const brands = useQuery({
    queryKey: ["price-equivalences-competitor-brands", base.familia],
    queryFn: () => fetchBrandOptions(base.familia),
    enabled: open,
  });

  async function save() {
    if (!product) return;
    setSaving(true);
    try {
      await saveOfficialEquivalence({
        baseProductId: base.id,
        comparedProductId: product.id,
        origin: "admin_manual",
        notes: notes.trim() || null,
        replaceId,
      });
      toast.success("Equivalência atualizada.");
      onSaved();
      onOpenChange(false);
    } catch (e) {
      console.error(e);
      toast.error("Não foi possível salvar a equivalência.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{replaceId ? "Substituir concorrente" : "Definir equivalência"}</DialogTitle>
          <DialogDescription>
            Base: {base.marca} {productCode(base)} — {base.nome}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Marca concorrente</Label>
            <Select
              value={brand}
              onValueChange={(v) => {
                setBrand(v);
                setProduct(null);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione a marca" />
              </SelectTrigger>
              <SelectContent>
                {(brands.data?.competitors ?? []).map((b) => (
                  <SelectItem key={b} value={b}>
                    {b}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Código do concorrente</Label>
            <ProductCombobox
              value={product}
              onSelect={setProduct}
              familia={base.familia}
              categoria={base.categoria}
              marca={brand}
              placeholder="Pesquisar por código ou descrição"
              disabled={!brand}
            />
          </div>
          <div className="space-y-1">
            <Label>Observações</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={!product || saving}>
            Atualizar equivalência
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
