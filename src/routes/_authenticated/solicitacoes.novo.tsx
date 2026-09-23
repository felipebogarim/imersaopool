import { useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  listCategories,
  listClientsLite,
  listProductsLite,
  listSectors,
} from "@/lib/internal-tickets/queries";
import {
  TICKET_PRIORITIES,
  TICKET_PRIORITY_LABEL,
  type TicketPriority,
} from "@/lib/internal-tickets/priority";
import { createInternalTicket, sendInternalTicket } from "@/lib/internal-tickets/tickets.functions";

export const Route = createFileRoute("/_authenticated/solicitacoes/novo")({
  head: () => ({ meta: [{ title: "Novo Ticket — Solicitações Internas — PoolFlux" }] }),
  component: NewTicketPage,
});

const NONE = "__none__";

function NewTicketPage() {
  const navigate = useNavigate();
  const categoriesQuery = useQuery({
    queryKey: ["internal-ticket-categories"],
    queryFn: listCategories,
  });
  const sectorsQuery = useQuery({ queryKey: ["internal-ticket-sectors"], queryFn: listSectors });
  const clientsQuery = useQuery({
    queryKey: ["internal-ticket-clients-lite"],
    queryFn: listClientsLite,
  });
  const productsQuery = useQuery({
    queryKey: ["internal-ticket-products-lite"],
    queryFn: listProductsLite,
  });

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [sectorId, setSectorId] = useState<string>("");
  const [clientId, setClientId] = useState<string>(NONE);
  const [productId, setProductId] = useState<string>(NONE);
  const [priority, setPriority] = useState<TicketPriority>("normal");
  const [submitting, setSubmitting] = useState(false);

  const activeCategories = useMemo(
    () => (categoriesQuery.data ?? []).filter((c) => c.active),
    [categoriesQuery.data],
  );
  const activeSectors = useMemo(
    () => (sectorsQuery.data ?? []).filter((s) => s.active),
    [sectorsQuery.data],
  );

  function onCategoryChange(id: string) {
    setCategoryId(id);
    const category = activeCategories.find((c) => c.id === id);
    if (category?.default_sector_id) setSectorId(category.default_sector_id);
  }

  const canSubmit =
    title.trim().length >= 3 && description.trim().length > 0 && categoryId && sectorId;

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const ticket = await createInternalTicket({
        data: {
          title: title.trim(),
          description: description.trim(),
          categoryId,
          sectorId,
          clientId: clientId === NONE ? null : clientId,
          productId: productId === NONE ? null : productId,
          priority,
        },
      });
      await sendInternalTicket({ data: { ticketId: ticket.id } });
      toast.success(`Ticket ${ticket.ticket_number} enviado`);
      navigate({ to: "/solicitacoes" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao criar o ticket");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-background pb-10">
      <PageHeader title="Novo Ticket" subtitle="Registre uma solicitação para outro setor" />
      <div className="mx-auto max-w-2xl space-y-4 px-4 py-6 sm:px-8">
        <div className="space-y-1.5">
          <Label>Título</Label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex.: Pintura especial no produto X"
          />
        </div>

        <div className="space-y-1.5">
          <Label>Descrição</Label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={5}
            placeholder="Descreva a solicitação com o máximo de contexto possível"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Categoria</Label>
            <Select
              value={categoryId}
              onValueChange={onCategoryChange}
              disabled={activeCategories.length === 0}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    activeCategories.length === 0 ? "Nenhuma categoria cadastrada" : "Selecione"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {activeCategories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {categoriesQuery.isSuccess && activeCategories.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Nenhuma categoria ativa. Peça a um admin para cadastrar em Admin → Solicitações
                Internas.
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Setor responsável</Label>
            <Select value={sectorId} onValueChange={setSectorId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {activeSectors.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Cliente (opcional)</Label>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger>
                <SelectValue placeholder="Nenhum" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Nenhum</SelectItem>
                {(clientsQuery.data ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nome_fantasia}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Produto (opcional)</Label>
            <Select value={productId} onValueChange={setProductId}>
              <SelectTrigger>
                <SelectValue placeholder="Nenhum" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Nenhum</SelectItem>
                {(productsQuery.data ?? []).map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Prioridade</Label>
          <Select value={priority} onValueChange={(v) => setPriority(v as TicketPriority)}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TICKET_PRIORITIES.map((p) => (
                <SelectItem key={p} value={p}>
                  {TICKET_PRIORITY_LABEL[p]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button disabled={!canSubmit || submitting} onClick={handleSubmit} className="w-full">
          {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Enviar solicitação
        </Button>
      </div>
    </div>
  );
}
