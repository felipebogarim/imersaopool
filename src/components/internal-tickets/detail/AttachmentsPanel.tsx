import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { uploadTicketAttachment } from "@/lib/internal-tickets/attachments";

export function AttachmentsPanel({ ticketId }: { ticketId: string }) {
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleUpload(file: File) {
    setUploading(true);
    try {
      await uploadTicketAttachment(ticketId, file);
      toast.success("Anexo enviado");
      qc.invalidateQueries({ queryKey: ["internal-ticket-attachments", ticketId] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao enviar anexo");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-2 rounded-lg border p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Anexos</p>
      <input
        ref={fileInputRef}
        type="file"
        className="text-xs"
        disabled={uploading}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleUpload(file);
        }}
      />
      {uploading && <p className="text-xs text-muted-foreground">Enviando…</p>}
    </div>
  );
}
