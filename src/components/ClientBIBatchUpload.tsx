import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Upload, Users } from "lucide-react";
import { toast } from "sonner";
import {
  parseClientBIWorkbookBatch,
  parseClientFamiliasWorkbookBatch,
} from "@/lib/client-bi-parser";

async function replaceAndInsert(
  kind: "bi" | "familias",
  items: Array<{ razao_social: string; data: any }>,
  ctx: { repId: string; companyId: string; filename: string; userId: string | null },
) {
  // marca todas as versões ativas dessa combinação (rep + kind) como substituídas
  const razoes = items.map((i) => i.razao_social);
  await (supabase as any)
    .from("client_bi_uploads")
    .update({ substituida_em: new Date().toISOString() })
    .eq("representative_id", ctx.repId)
    .eq("kind", kind)
    .in("razao_social", razoes)
    .is("substituida_em", null);

  const payload = items.map((it) => ({
    representative_id: ctx.repId,
    company_id: ctx.companyId,
    razao_social: it.razao_social,
    kind,
    filename: ctx.filename,
    data: it.data,
    uploaded_by: ctx.userId,
  }));
  const { error } = await (supabase as any).from("client_bi_uploads").insert(payload);
  if (error) throw error;
  return items.length;
}

export function ClientBIBatchUpload({
  repId,
  companyId,
}: {
  repId: string;
  companyId: string | null;
}) {
  const qc = useQueryClient();
  const biRef = useRef<HTMLInputElement>(null);
  const famRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<"bi" | "familias" | null>(null);

  const uploadBI = useMutation({
    mutationFn: async (file: File) => {
      if (!companyId) throw new Error("Representante sem empresa associada.");
      const buf = await file.arrayBuffer();
      const items = parseClientBIWorkbookBatch(buf);
      const { data: userRes } = await supabase.auth.getUser();
      return replaceAndInsert("bi", items, {
        repId,
        companyId,
        filename: file.name,
        userId: userRes.user?.id ?? null,
      });
    },
    onSuccess: (n) => {
      toast.success(`BI importado para ${n} cliente(s).`);
      qc.invalidateQueries({ queryKey: ["client-bi"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao importar BI."),
    onSettled: () => setBusy(null),
  });

  const uploadFam = useMutation({
    mutationFn: async (file: File) => {
      if (!companyId) throw new Error("Representante sem empresa associada.");
      const buf = await file.arrayBuffer();
      const items = parseClientFamiliasWorkbookBatch(buf);
      const { data: userRes } = await supabase.auth.getUser();
      return replaceAndInsert("familias", items, {
        repId,
        companyId,
        filename: file.name,
        userId: userRes.user?.id ?? null,
      });
    },
    onSuccess: (n) => {
      toast.success(`Resultado por família importado para ${n} cliente(s).`);
      qc.invalidateQueries({ queryKey: ["client-familias"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao importar planilha."),
    onSettled: () => setBusy(null),
  });

  function onFile(kind: "bi" | "familias") {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      e.target.value = "";
      if (!f) return;
      setBusy(kind);
      (kind === "bi" ? uploadBI : uploadFam).mutate(f);
    };
  }

  return (
    <div className="surface rounded-xl px-4 py-3 flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2 flex-1 min-w-[220px]">
        <Users className="h-4 w-4 text-muted-foreground" />
        <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
          BI dos clientes (upload em lote)
        </p>
        <span className="hidden md:inline text-xs text-muted-foreground">
          — uma planilha cria automaticamente a página de todos os clientes
        </span>
      </div>
      <input ref={biRef} type="file" accept=".xlsx" className="hidden" onChange={onFile("bi")} />
      <input ref={famRef} type="file" accept=".xlsx" className="hidden" onChange={onFile("familias")} />
      <Button size="sm" variant="outline" onClick={() => biRef.current?.click()} disabled={busy !== null}>
        <Upload className="h-3.5 w-3.5 mr-1" />
        {busy === "bi" ? "Importando…" : "Carregar BI (todos)"}
      </Button>
      <Button size="sm" variant="outline" onClick={() => famRef.current?.click()} disabled={busy !== null}>
        <Upload className="h-3.5 w-3.5 mr-1" />
        {busy === "familias" ? "Importando…" : "Carregar resultado por família (todos)"}
      </Button>
    </div>
  );
}
