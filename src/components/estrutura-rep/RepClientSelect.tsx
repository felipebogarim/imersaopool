import React, { useState, useEffect, useMemo } from "react";
import {
  Building,
  Check,
  ChevronsUpDown,
  Search,
  Sparkles,
  MapPin,
  X,
  Loader2,
  Edit2,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { fetchClientsForRep, type RepClientOption } from "@/lib/estrutura-rep/rep-clients";
import { cn } from "@/lib/utils";

interface RepClientSelectProps {
  value: string;
  onChange: (nome: string) => void;
  onSelectClient?: (client: { nome: string; cidade?: string | null; estado?: string | null }) => void;
  representativeId?: string;
  repNome?: string;
  structureClients?: Array<{ nome: string; cidade?: string | null; estado?: string | null }>;
  placeholder?: string;
  id?: string;
  required?: boolean;
}

export function RepClientSelect({
  value,
  onChange,
  onSelectClient,
  representativeId,
  repNome,
  structureClients,
  placeholder = "Selecione ou busque um cliente...",
  id,
  required = false,
}: RepClientSelectProps) {
  const [open, setOpen] = useState(false);
  const [clients, setClients] = useState<RepClientOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [manualMode, setManualMode] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchClientsForRep(representativeId, repNome, structureClients)
      .then((data) => {
        if (active) setClients(data);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [representativeId, repNome, structureClients]);

  const repClientsCount = useMemo(
    () => clients.filter((c) => c.isRepClient).length,
    [clients]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return clients;

    return clients.filter((c) => {
      const nomeMatch = c.nome_fantasia.toLowerCase().includes(q);
      const razaoMatch = c.razao_social ? c.razao_social.toLowerCase().includes(q) : false;
      const cidadeMatch = c.cidade ? c.cidade.toLowerCase().includes(q) : false;
      const estadoMatch = c.estado ? c.estado.toLowerCase().includes(q) : false;
      return nomeMatch || razaoMatch || cidadeMatch || estadoMatch;
    });
  }, [clients, search]);

  const handleSelect = (client: RepClientOption) => {
    onChange(client.nome_fantasia);
    onSelectClient?.({
      nome: client.nome_fantasia,
      cidade: client.cidade,
      estado: client.estado,
    });
    setOpen(false);
    setSearch("");
  };

  const handleUseCustomName = (customName: string) => {
    const clean = customName.trim();
    if (!clean) return;
    onChange(clean);
    onSelectClient?.({ nome: clean });
    setOpen(false);
    setSearch("");
  };

  if (manualMode) {
    return (
      <div className="space-y-1">
        <div className="relative">
          <Building className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            id={id}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="pl-9 pr-20 h-9 text-xs"
            required={required}
            autoFocus
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setManualMode(false)}
            className="absolute right-1 top-1 h-7 text-[10px] text-primary hover:text-primary px-2 font-medium"
            title="Voltar para seleção na lista"
          >
            Abrir Lista
          </Button>
        </div>
      </div>
    );
  }

  const repClientsList = useMemo(() => filtered.filter((c) => c.isRepClient), [filtered]);
  const otherClientsList = useMemo(() => filtered.filter((c) => !c.isRepClient), [filtered]);

  return (
    <div className="space-y-1">
      <Popover modal={true} open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            id={id}
            role="combobox"
            aria-expanded={open}
            className={cn(
              "flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-1.5 text-xs shadow-2xs transition-colors hover:bg-muted/40 focus:outline-none focus:ring-1 focus:ring-ring text-left cursor-pointer",
              !value && "text-muted-foreground"
            )}
          >
            <div className="flex items-center gap-2 truncate flex-1 min-w-0 pr-1">
              <Building className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate font-medium text-foreground">
                {value || placeholder}
              </span>
            </div>
            <div className="flex items-center gap-1 shrink-0 text-muted-foreground">
              {value && (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    onChange("");
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.stopPropagation();
                      onChange("");
                    }
                  }}
                  className="p-1 hover:text-destructive transition rounded-full hover:bg-destructive/10 cursor-pointer"
                  title="Limpar cliente"
                >
                  <X className="h-3 w-3" />
                </span>
              )}
              <ChevronsUpDown className="h-3.5 w-3.5 opacity-60" />
            </div>
          </button>
        </PopoverTrigger>

        <PopoverContent
          className="w-[--radix-popover-trigger-width] min-w-[340px] max-w-[440px] p-0 z-[70] shadow-xl border rounded-xl bg-popover"
          align="start"
          sideOffset={4}
        >
          {/* Campo de Busca Rápida */}
          <div className="p-2.5 border-b bg-muted/20 space-y-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar cliente por nome, razão social ou cidade..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (filtered.length > 0) {
                      handleSelect(filtered[0]);
                    } else if (search.trim()) {
                      handleUseCustomName(search);
                    }
                  }
                }}
                className="pl-8 h-8 text-xs bg-background"
                autoFocus
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-2 top-2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center justify-between text-[11px] text-muted-foreground px-0.5">
              <span>
                {loading ? (
                  <span className="flex items-center gap-1 text-primary">
                    <Loader2 className="h-3 w-3 animate-spin" /> Carregando clientes...
                  </span>
                ) : (
                  <span>
                    {filtered.length} {filtered.length === 1 ? "cliente" : "clientes"}
                    {repClientsCount > 0 && ` (${repClientsCount} na carteira do rep)`}
                  </span>
                )}
              </span>

              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setManualMode(true);
                }}
                className="text-primary hover:underline font-semibold flex items-center gap-1 cursor-pointer"
              >
                <Edit2 className="h-3 w-3" />
                <span>Digitar manualmente</span>
              </button>
            </div>
          </div>

          {/* Opção de Usar Termo Pesquisado como Nome Personalizado */}
          {search.trim().length > 0 && !filtered.some((c) => c.nome_fantasia.toLowerCase() === search.trim().toLowerCase()) && (
            <div className="p-2 border-b bg-primary/5">
              <button
                type="button"
                onClick={() => handleUseCustomName(search)}
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg border border-primary/20 bg-background hover:bg-primary/10 text-xs text-primary font-semibold transition cursor-pointer text-left"
              >
                <span className="truncate">
                  Usar <strong>"{search.trim()}"</strong> como novo cliente
                </span>
                <Sparkles className="h-3.5 w-3.5 shrink-0 ml-1.5" />
              </button>
            </div>
          )}

          {/* Lista com Rolagem */}
          <div className="max-h-64 overflow-y-auto p-1.5 space-y-1 no-scrollbar">
            {filtered.length === 0 ? (
              <div className="py-6 text-center text-xs text-muted-foreground space-y-2">
                <Building className="h-6 w-6 mx-auto opacity-40 text-muted-foreground" />
                <p>Nenhum cliente encontrado para "{search}".</p>
                {search.trim() && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => handleUseCustomName(search)}
                    className="h-7 text-xs font-semibold gap-1 text-primary"
                  >
                    <Plus className="h-3 w-3" />
                    Usar "{search.trim()}"
                  </Button>
                )}
              </div>
            ) : (
              <>
                {/* Grupo 1: Clientes da Carteira do Rep */}
                {repClientsList.length > 0 && (
                  <div className="space-y-1">
                    <div className="px-2 pt-1 pb-0.5 text-[10px] font-bold uppercase tracking-wider text-primary flex items-center justify-between">
                      <span>Carteira do Representante ({repClientsList.length})</span>
                      {repNome && <span className="font-normal text-muted-foreground lowercase truncate max-w-[120px]">{repNome}</span>}
                    </div>
                    {repClientsList.map((client) => {
                      const isSelected = value.trim().toLowerCase() === client.nome_fantasia.toLowerCase();

                      return (
                        <button
                          key={client.id}
                          type="button"
                          onClick={() => handleSelect(client)}
                          className={cn(
                            "w-full flex items-start justify-between gap-2 p-2 rounded-lg text-left text-xs transition cursor-pointer group",
                            isSelected
                              ? "bg-primary/10 text-primary font-bold"
                              : "hover:bg-muted text-foreground"
                          )}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className="truncate font-semibold text-foreground group-hover:text-primary transition-colors">
                                {client.nome_fantasia}
                              </span>
                              <Badge
                                variant="secondary"
                                className="text-[9px] h-4 px-1 py-0 font-bold bg-primary/15 text-primary border-primary/30 shrink-0"
                              >
                                Carteira
                              </Badge>
                            </div>

                            {client.razao_social && client.razao_social !== client.nome_fantasia && (
                              <span className="text-[10px] text-muted-foreground truncate block">
                                {client.razao_social}
                              </span>
                            )}

                            {(client.cidade || client.estado) && (
                              <span className="text-[10px] text-muted-foreground/80 flex items-center gap-1 mt-0.5">
                                <MapPin className="h-2.5 w-2.5 opacity-60" />
                                <span>
                                  {client.cidade}
                                  {client.cidade && client.estado ? ` - ${client.estado}` : client.estado}
                                </span>
                              </span>
                            )}
                          </div>

                          {isSelected && (
                            <Check className="h-4 w-4 text-primary shrink-0 self-center" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Grupo 2: Outros Clientes */}
                {otherClientsList.length > 0 && (
                  <div className="space-y-1 pt-1.5">
                    {repClientsList.length > 0 && (
                      <div className="px-2 pt-1 pb-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-t">
                        Outros Clientes Cadastrados ({otherClientsList.length})
                      </div>
                    )}
                    {otherClientsList.map((client) => {
                      const isSelected = value.trim().toLowerCase() === client.nome_fantasia.toLowerCase();

                      return (
                        <button
                          key={client.id}
                          type="button"
                          onClick={() => handleSelect(client)}
                          className={cn(
                            "w-full flex items-start justify-between gap-2 p-2 rounded-lg text-left text-xs transition cursor-pointer group",
                            isSelected
                              ? "bg-primary/10 text-primary font-bold"
                              : "hover:bg-muted text-foreground"
                          )}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className="truncate font-semibold text-foreground group-hover:text-primary transition-colors">
                                {client.nome_fantasia}
                              </span>
                            </div>

                            {client.razao_social && client.razao_social !== client.nome_fantasia && (
                              <span className="text-[10px] text-muted-foreground truncate block">
                                {client.razao_social}
                              </span>
                            )}

                            {(client.cidade || client.estado) && (
                              <span className="text-[10px] text-muted-foreground/80 flex items-center gap-1 mt-0.5">
                                <MapPin className="h-2.5 w-2.5 opacity-60" />
                                <span>
                                  {client.cidade}
                                  {client.cidade && client.estado ? ` - ${client.estado}` : client.estado}
                                </span>
                              </span>
                            )}
                          </div>

                          {isSelected && (
                            <Check className="h-4 w-4 text-primary shrink-0 self-center" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
