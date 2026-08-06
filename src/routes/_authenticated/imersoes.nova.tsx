import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { VoiceInput } from "@/components/VoiceInput";
import { LabelHelp } from "@/components/FieldHelp";
import { IMMERSION_HELP } from "@/lib/field-help-texts";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { toast } from "sonner";
import { ArrowLeft, Check, ChevronsUpDown } from "lucide-react";

const searchSchema = z.object({ client: z.string().optional() });

export const Route = createFileRoute("/_authenticated/imersoes/nova")({
  head: () => ({ meta: [{ title: "Nova imersão — PoolFlux" }] }),
  validateSearch: searchSchema,
  component: NewImmersion,
});

const PERFIS = [
  { value: "cliente", label: "Cliente" },
  { value: "especificador", label: "Especificador" },
  { value: "ld", label: "LD" },
  { value: "outro", label: "Outro" },
];

const TIPOS = [
  { value: "presencial", label: "Presencial" },
  { value: "online", label: "Online" },
];

function NewImmersion() {
  const navigate = useNavigate();
  const { client: preClient } = Route.useSearch();
  const [saving, setSaving] = useState(false);
  const [clientOpen, setClientOpen] = useState(false);
  const [repOpen, setRepOpen] = useState(false);
  const [roteiroManual, setRoteiroManual] = useState(false);

  const [form, setForm] = useState<Record<string, any>>({
    perfil: preClient ? "cliente" : "",
    client_id: preClient || "",
    data_visita: new Date().toISOString().slice(0, 10),
    tipo: "",
    vinculado_rep: false,
    representative_id: "",
    acompanhantes: "",
    titulo: "",
    roteiro_id: "",
    especificar_perfil: "",
    empresa_manual: "",
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["clients-select-all"],
    queryFn: async () => {
      const page = 1000;
      const all: any[] = [];
      for (let from = 0; from < 20000; from += page) {
        const { data, error } = await supabase
          .from("clients")
          .select("id, nome_fantasia, razao_social")
          .order("nome_fantasia")
          .range(from, from + page - 1);
        if (error) throw error;
        all.push(...(data ?? []));
        if (!data || data.length < page) break;
      }
      return all;
    },
  });

  const { data: reps = [] } = useQuery({
    queryKey: ["reps-select"],
    queryFn: async () => (await supabase.from("representatives").select("id, nome").order("nome")).data ?? [],
  });

  const { data: roteiros = [] } = useQuery({
    queryKey: ["roteiros-ativos"],
    queryFn: async () =>
      (await supabase.from("roteiros").select("id, nome, versao").eq("ativo", true).order("nome")).data ?? [],
  });

  const { data: roteiroPerfis = [] } = useQuery({
    queryKey: ["roteiro-perfis"],
    queryFn: async () => (await supabase.from("roteiro_perfis").select("roteiro_id, perfil")).data ?? [],
  });

  useEffect(() => {
    if (roteiroManual || form.roteiro_id) return;
    const match = roteiroPerfis.find((rp: any) => rp.perfil === "imersao");
    if (match) setForm(f => ({ ...f, roteiro_id: match.roteiro_id }));
  }, [roteiroPerfis, roteiroManual, form.roteiro_id]);

  async function save() {
    if (!form.perfil) return toast.error("Selecione o perfil");
    if (form.perfil === "cliente" && !form.client_id && !form.empresa_manual) return toast.error("Informe o cliente ou empresa");
    if (!form.roteiro_id) return toast.error("Selecione um roteiro");
    
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    
    // Gerar título se vazio
    const finalTitle = form.titulo || `Imersão - ${form.perfil} - ${form.data_visita}`;

    const { data, error } = await supabase.from("immersions").insert({
      titulo: finalTitle,
      client_id: form.perfil === "cliente" ? (form.client_id || null) : null,
      representative_id: form.vinculado_rep ? (form.representative_id || null) : null,
      data_visita: form.data_visita,
      status: "planejada",
      created_by: user?.id,
      agente_id: user?.id,
      roteiro_id: form.roteiro_id,
      observacoes: JSON.stringify({
        perfil: form.perfil,
        especificar_perfil: form.especificar_perfil,
        tipo: form.tipo,
        acompanhantes: form.acompanhantes,
        empresa_manual: form.empresa_manual
      })
    } as any).select("id").single();

    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Imersão criada");
    navigate({ to: "/imersoes/$id", params: { id: data.id } });
  }

  return (
    <div>
      <PageHeader
        title="Nova imersão"
        subtitle="Estruture um novo diagnóstico de campo"
        actions={<Button variant="ghost" asChild><Link to="/imersoes"><ArrowLeft className="h-4 w-4 mr-1" /> Voltar</Link></Button>}
      />
      <div className="p-4 sm:p-8 max-w-3xl">
        <div className="surface rounded-xl p-6 space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Perfil */}
            <div className="space-y-2">
              <Label>Perfil *</Label>
              <Select value={form.perfil} onValueChange={v => setForm(f => ({ ...f, perfil: v, client_id: v === "cliente" ? f.client_id : "" }))}>
                <SelectTrigger><SelectValue placeholder="Selecione o perfil" /></SelectTrigger>
                <SelectContent>
                  {PERFIS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Data */}
            <div className="space-y-2">
              <Label>Data *</Label>
              <Input type="date" value={form.data_visita} onChange={e => setForm(f => ({ ...f, data_visita: e.target.value }))} />
            </div>

            {/* Empresa / Cliente */}
            <div className="md:col-span-2 space-y-2">
              {form.perfil === "cliente" ? (
                <>
                  <Label>Empresa (Cliente) *</Label>
                  <Popover open={clientOpen} onOpenChange={setClientOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" role="combobox" className="w-full justify-between font-normal h-10 px-3">
                        <span className="truncate">
                          {clients.find((c: any) => c.id === form.client_id)?.nome_fantasia || form.empresa_manual || "Selecione ou digite o nome da empresa"}
                        </span>
                        <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                      <Command shouldFilter={false}>
                        <CommandInput 
                          placeholder="Pesquisar cliente ou digitar novo..." 
                          onValueChange={(v) => setForm(f => ({ ...f, empresa_manual: v }))}
                        />
                        <CommandList className="max-h-64">
                          <CommandEmpty className="p-2 text-xs">
                            Nenhum cliente encontrado. "{form.empresa_manual}" será usado como nome manual.
                          </CommandEmpty>
                          <CommandGroup>
                            {clients
                              .filter((c: any) => 
                                !form.empresa_manual || 
                                c.nome_fantasia?.toLowerCase().includes(form.empresa_manual.toLowerCase()) ||
                                c.razao_social?.toLowerCase().includes(form.empresa_manual.toLowerCase())
                              )
                              .slice(0, 50)
                              .map((c: any) => (
                                <CommandItem
                                  key={c.id}
                                  value={c.id}
                                  onSelect={() => {
                                    setForm(f => ({ ...f, client_id: c.id, empresa_manual: "" }));
                                    setClientOpen(false);
                                  }}
                                >
                                  <Check className={form.client_id === c.id ? "mr-2 h-4 w-4 opacity-100" : "mr-2 h-4 w-4 opacity-0"} />
                                  <span className="truncate">{c.nome_fantasia || c.razao_social}</span>
                                </CommandItem>
                              ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </>
              ) : (
                <>
                  <Label>Especificar perfil</Label>
                  <Input 
                    placeholder="Ex: Arquiteto parceiro, Consultor..." 
                    value={form.especificar_perfil} 
                    onChange={e => setForm(f => ({ ...f, especificar_perfil: e.target.value }))}
                  />
                </>
              )}
            </div>

            {/* Tipo */}
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={form.tipo} onValueChange={v => setForm(f => ({ ...f, tipo: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione o tipo" /></SelectTrigger>
                <SelectContent>
                  {TIPOS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Vinculado a Rep */}
            <div className="space-y-2">
              <Label>Vinculado a um representante?</Label>
              <div className="flex items-center gap-3 mt-1">
                <Button 
                  type="button" 
                  variant={form.vinculado_rep ? "default" : "outline"} 
                  size="sm"
                  onClick={() => setForm(f => ({ ...f, vinculado_rep: true }))}
                >Sim</Button>
                <Button 
                  type="button" 
                  variant={!form.vinculado_rep ? "default" : "outline"} 
                  size="sm"
                  onClick={() => setForm(f => ({ ...f, vinculado_rep: false, representative_id: "" }))}
                >Não</Button>
              </div>
            </div>

            {form.vinculado_rep && (
              <div className="md:col-span-2 space-y-2">
                <Label>Representante *</Label>
                <Popover open={repOpen} onOpenChange={setRepOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" className="w-full justify-between font-normal h-10 px-3">
                      <span className="truncate">
                        {reps.find((r: any) => r.id === form.representative_id)?.nome || "Selecione o representante"}
                      </span>
                      <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Pesquisar representante..." />
                      <CommandList className="max-h-64">
                        <CommandEmpty>Nenhum representante encontrado.</CommandEmpty>
                        <CommandGroup>
                          {reps.map((r: any) => (
                            <CommandItem
                              key={r.id}
                              value={r.id}
                              onSelect={() => {
                                setForm(f => ({ ...f, representative_id: r.id }));
                                setRepOpen(false);
                              }}
                            >
                              <Check className={form.representative_id === r.id ? "mr-2 h-4 w-4 opacity-100" : "mr-2 h-4 w-4 opacity-0"} />
                              <span className="truncate">{r.nome}</span>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            )}

            {/* Acompanhantes */}
            <div className="md:col-span-2 space-y-2">
              <Label>Mais alguém acompanhou?</Label>
              <Input 
                placeholder="Ex: João Silva (Diretor), Maria Santos..." 
                value={form.acompanhantes} 
                onChange={e => setForm(f => ({ ...f, acompanhantes: e.target.value }))}
              />
            </div>

            {/* Roteiro */}
            <div className="md:col-span-2 space-y-2 pt-4 border-t border-border">
              <Label>Roteiro de diagnóstico *</Label>
              <Select value={form.roteiro_id} onValueChange={v => { setRoteiroManual(true); setForm(f => ({ ...f, roteiro_id: v })); }}>
                <SelectTrigger><SelectValue placeholder="Selecione um roteiro" /></SelectTrigger>
                <SelectContent>{roteiros.map((r: any) => <SelectItem key={r.id} value={r.id}>{r.nome} (v{r.versao})</SelectItem>)}</SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">O roteiro define os capítulos e perguntas que serão preenchidos após a criação.</p>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" asChild><Link to="/imersoes">Cancelar</Link></Button>
            <Button onClick={save} disabled={saving}>{saving ? "Criando..." : "Criar imersão e abrir roteiro"}</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
