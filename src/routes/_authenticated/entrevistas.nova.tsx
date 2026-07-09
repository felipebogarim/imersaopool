import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { toast } from "sonner";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/entrevistas/nova")({
  head: () => ({ meta: [{ title: "Nova entrevista — PoolFlux" }] }),
  component: NovaEntrevista,
});

const PERFIS = [
  { value: "representante", label: "Representante" },
  { value: "gestor_nl", label: "Gestor NL" },
  { value: "trade_nl", label: "Trade NL" },
  { value: "lojista", label: "Lojista" },
  { value: "projetista", label: "Projetista" },
  { value: "vendedor", label: "Vendedor" },
  { value: "gestor_de_loja", label: "Gestor de Loja" },
  { value: "arquiteto", label: "Arquiteto" },
  { value: "especificador", label: "Especificador" },
  { value: "outro", label: "Outro" },
];

const TIPOS = [
  { value: "presencial", label: "Presencial" },
  { value: "online", label: "Online" },
];


function NovaEntrevista() {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    nome: "",
    perfil: "",
    perfil_outro: "",
    data: new Date().toISOString().slice(0, 10),
    tipo: "",
    roteiro_id: "" as string,
  });
  const [vinculado, setVinculado] = useState(false);
  const [clientId, setClientId] = useState<string | null>(null);
  const [clientOpen, setClientOpen] = useState(false);

  const [roteiroManual, setRoteiroManual] = useState(false);

  const { data: roteiros = [] } = useQuery({
    queryKey: ["roteiros-ativos"],
    queryFn: async () =>
      (await supabase.from("roteiros").select("id, nome, versao").eq("ativo", true).order("nome")).data ?? [],
  });

  const { data: roteiroPerfis = [] } = useQuery({
    queryKey: ["roteiro-perfis"],
    queryFn: async () =>
      (await supabase.from("roteiro_perfis").select("roteiro_id, perfil")).data ?? [],
  });

  // Auto-seleciona roteiro ao escolher perfil (a menos que o usuário já tenha escolhido manualmente)
  useEffect(() => {
    if (!form.perfil || roteiroManual) return;
    const match = roteiroPerfis.find((rp: any) => rp.perfil === form.perfil);
    if (match && match.roteiro_id !== form.roteiro_id) {
      setForm((f) => ({ ...f, roteiro_id: match.roteiro_id }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.perfil, roteiroPerfis]);

  const { data: clients = [] } = useQuery({
    queryKey: ["clients-select-all"],
    queryFn: async () =>
      (
        await supabase
          .from("clients")
          .select("id, nome_fantasia")
          .order("nome_fantasia")
      ).data ?? [],
    enabled: vinculado,
  });

  const selectedClient = useMemo(
    () => clients.find((c: any) => c.id === clientId),
    [clients, clientId],
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nome.trim()) return toast.error("Informe o nome do entrevistado");
    if (!form.perfil) return toast.error("Selecione o perfil");
    if (form.perfil === "outro" && !form.perfil_outro.trim())
      return toast.error("Especifique o perfil");
    if (!form.tipo) return toast.error("Selecione o tipo");
    if (!form.roteiro_id) return toast.error("Selecione um roteiro");
    if (vinculado && !clientId)
      return toast.error("Selecione o cliente vinculado");

    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase.from("interviews").insert({
      created_by: userData.user?.id,
      entrevistado_nome: form.nome,
      entrevistado_classificacao: form.perfil,
      perfil: form.perfil,
      perfil_outro: form.perfil === "outro" ? form.perfil_outro : null,
      data_entrevista: form.data || null,
      tipo: form.tipo,
      client_id: vinculado ? clientId : null,
      roteiro_id: form.roteiro_id || null,
      entrevistador_nome: userData.user?.email ?? "—",
      respostas: {},
    } as any);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Entrevista registrada");
    navigate({ to: "/entrevistas" });
  }

  return (
    <div>
      <PageHeader title="Nova entrevista" subtitle="Registre uma conversa de campo" />
      <form onSubmit={submit} className="p-8 max-w-3xl">
        <div className="surface rounded-xl p-6 space-y-4">
          <div>
            <Label>Nome do entrevistado *</Label>
            <Input
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
              placeholder="Nome completo"
            />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label>Perfil *</Label>
              <Select
                value={form.perfil}
                onValueChange={(v) => setForm({ ...form, perfil: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {PERFIS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Data *</Label>
              <Input
                type="date"
                value={form.data}
                onChange={(e) => setForm({ ...form, data: e.target.value })}
              />
            </div>
            {form.perfil === "outro" && (
              <div className="md:col-span-2">
                <Label>Especificar perfil *</Label>
                <Input
                  value={form.perfil_outro}
                  onChange={(e) => setForm({ ...form, perfil_outro: e.target.value })}
                />
              </div>
            )}
            <div>
              <Label>Tipo *</Label>
              <Select
                value={form.tipo}
                onValueChange={(v) => setForm({ ...form, tipo: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Label>Roteiro (opcional)</Label>
              <Select
                value={form.roteiro_id || "none"}
                onValueChange={(v) => setForm({ ...form, roteiro_id: v === "none" ? "" : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sem roteiro" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem roteiro</SelectItem>
                  {roteiros.map((r: any) => (
                    <SelectItem key={r.id} value={r.id}>{r.nome} (v{r.versao})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Ative um roteiro para capturar a entrevista por capítulos estruturados.
              </p>
            </div>
          </div>


          <div className="pt-2 border-t border-border">
            <div className="flex items-center justify-between py-2">
              <div>
                <Label>Vinculado a um cliente?</Label>
                <p className="text-xs text-muted-foreground">
                  Ative para associar a entrevista a um cliente da base.
                </p>
              </div>
              <Switch
                checked={vinculado}
                onCheckedChange={(v) => {
                  setVinculado(v);
                  if (!v) setClientId(null);
                }}
              />
            </div>

            {vinculado && (
              <div>
                <Label>Cliente *</Label>
                <Popover open={clientOpen} onOpenChange={setClientOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      role="combobox"
                      className="w-full justify-between font-normal"
                    >
                      {selectedClient?.nome_fantasia ?? "Selecione um cliente"}
                      <ChevronsUpDown className="h-4 w-4 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Buscar cliente..." />
                      <CommandList>
                        <CommandEmpty>Nenhum cliente encontrado.</CommandEmpty>
                        <CommandGroup>
                          {clients.map((c: any) => (
                            <CommandItem
                              key={c.id}
                              value={c.nome_fantasia}
                              onSelect={() => {
                                setClientId(c.id);
                                setClientOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  clientId === c.id ? "opacity-100" : "opacity-0",
                                )}
                              />
                              {c.nome_fantasia}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            )}
          </div>

          <div className="flex gap-3 justify-end pt-4">
            <Button type="button" variant="outline" onClick={() => navigate({ to: "/entrevistas" })}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Salvando..." : "Salvar entrevista"}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
