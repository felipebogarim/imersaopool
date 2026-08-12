import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { 
  Search, 
  Filter, 
  MoreHorizontal, 
  Eye, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  Building2, 
  LayoutGrid,
  Sparkles,
  Calendar
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { getSuggested } from "@/lib/kanban-suggested";
import type { KCard, Board, KList } from "@/lib/kanban-types";

export const Route = createFileRoute("/_authenticated/mapa-acoes/")({
  head: () => ({ meta: [{ title: "Mapa de Ações — PoolFlux" }] }),
  component: MapaAcoesResumoPage,
});

function MapaAcoesResumoPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [filterBoard, setFilterBoard] = useState("all");
  const [filterTipo, setFilterTipo] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterEvolucao, setFilterEvolucao] = useState("all");

  const { data: boards = [] } = useQuery({
    queryKey: ["kanban-boards-resumo"],
    queryFn: async () => {
      const { data } = await supabase.from("kanban_boards").select("id, name, color").is("archived_at", null);
      return data ?? [];
    },
  });

  const { data: lists = [] } = useQuery({
    queryKey: ["kanban-lists-resumo"],
    queryFn: async () => {
      const { data } = await supabase.from("kanban_lists").select("id, name, board_id").is("archived_at", null);
      return data ?? [];
    },
  });

  const { data: cards = [], isLoading } = useQuery({
    queryKey: ["kanban-cards-resumo"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("kanban_cards")
        .select("*")
        .is("archived_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as KCard[];
    },
  });

  const processedCards = useMemo(() => {
    return cards.map(card => {
      const board = boards.find(b => b.id === card.board_id);
      const list = lists.find(l => l.id === card.list_id);
      const suggested = getSuggested(card);
      
      // Tipo: Sugerida ou Aceita (Aprovada)
      const tipo = suggested.suggested 
        ? (suggested.status === "aprovada" ? "Aceita" : "Sugerida")
        : "Manual";

      // Evolução
      let evolucao = "No prazo";
      if (card.due_date && !card.completed_at) {
        const now = new Date();
        const due = new Date(card.due_date);
        const diffDays = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        
        if (diffDays < 0) evolucao = "Atrasada";
        else if (diffDays <= 3) evolucao = "Prazo próximo";
      }

      return {
        ...card,
        boardName: board?.name ?? "N/A",
        boardColor: board?.color ?? "#94a3b8",
        statusLabel: list?.name ?? "N/A",
        tipo,
        evolucao,
        clientName: (card.metadata as any)?.client_name ?? "NA"
      };
    });
  }, [cards, boards, lists]);

  const filteredCards = useMemo(() => {
    return processedCards.filter(c => {
      const matchesSearch = !search || 
        c.title.toLowerCase().includes(search.toLowerCase()) ||
        c.clientName.toLowerCase().includes(search.toLowerCase());
      
      const matchesBoard = filterBoard === "all" || c.board_id === filterBoard;
      const matchesTipo = filterTipo === "all" || c.tipo.toLowerCase() === filterTipo.toLowerCase();
      
      // Status mapping for the filter: A fazer, Em andamento, Concluída
      // We map list names loosely or use completed_at
      const matchesStatus = filterStatus === "all" || (() => {
        if (filterStatus === "concluida") return !!c.completed_at;
        if (filterStatus === "andamento") return !c.completed_at && c.statusLabel.toLowerCase().includes("andamento");
        if (filterStatus === "fazer") return !c.completed_at && !c.statusLabel.toLowerCase().includes("andamento");
        return true;
      })();

      const matchesEvolucao = filterEvolucao === "all" || c.evolucao.toLowerCase() === filterEvolucao.toLowerCase();

      return matchesSearch && matchesBoard && matchesTipo && matchesStatus && matchesEvolucao;
    });
  }, [processedCards, search, filterBoard, filterTipo, filterStatus, filterEvolucao]);

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-20">
      <PageHeader
        title="Mapa de Ações"
        subtitle="Painel de leitura rápida das ações estratégicas e operacionais."
      />

      <div className="px-4 sm:px-8 max-w-7xl mx-auto space-y-6">
        {/* Filtros */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[300px]">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Buscar por cliente, título ou palavra-chave..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            
            <Select value={filterBoard} onValueChange={setFilterBoard}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Board" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Boards</SelectItem>
                {boards.map(b => (
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterTipo} onValueChange={setFilterTipo}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Tipos</SelectItem>
                <SelectItem value="Sugerida">Sugerida</SelectItem>
                <SelectItem value="Aceita">Aceita</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos Status</SelectItem>
                <SelectItem value="fazer">A fazer</SelectItem>
                <SelectItem value="andamento">Em andamento</SelectItem>
                <SelectItem value="concluida">Concluída</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterEvolucao} onValueChange={setFilterEvolucao}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Evolução" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Qualquer Evolução</SelectItem>
                <SelectItem value="no prazo">No prazo</SelectItem>
                <SelectItem value="prazo próximo">Prazo próximo</SelectItem>
                <SelectItem value="atrasada">Atrasada</SelectItem>
              </SelectContent>
            </Select>

            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => {
                setSearch("");
                setFilterBoard("all");
                setFilterTipo("all");
                setFilterStatus("all");
                setFilterEvolucao("all");
              }}
              className="text-slate-500"
            >
              Limpar
            </Button>
          </div>
        </div>

        {/* Lista de Ações */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px] font-bold tracking-wider">
                <tr>
                  <th className="px-6 py-4">Título da Ação</th>
                  <th className="px-6 py-4">Board</th>
                  <th className="px-6 py-4">Tipo</th>
                  <th className="px-6 py-4">Cliente</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Prazo</th>
                  <th className="px-6 py-4">Evolução</th>
                  <th className="px-6 py-4 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-slate-400">
                      Carregando ações...
                    </td>
                  </tr>
                ) : filteredCards.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-slate-400">
                      Nenhuma ação encontrada com os filtros aplicados.
                    </td>
                  </tr>
                ) : (
                  filteredCards.map((card) => (
                    <tr key={card.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 font-medium text-slate-900 min-w-[200px]">
                        {card.title}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full" style={{ background: card.boardColor }} />
                          <span className="text-slate-600">{card.boardName}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant={card.tipo === "Aceita" ? "default" : "outline"} className={cn(
                          "text-[10px]",
                          card.tipo === "Aceita" ? "bg-emerald-500 hover:bg-emerald-600" : "text-amber-600 border-amber-200"
                        )}>
                          {card.tipo === "Aceita" && <CheckCircle2 className="w-3 h-3 mr-1" />}
                          {card.tipo === "Sugerida" && <Sparkles className="w-3 h-3 mr-1" />}
                          {card.tipo}
                        </Badge>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-slate-600">
                          {card.clientName !== "NA" && <Building2 className="w-3.5 h-3.5 text-slate-400" />}
                          <span className="truncate max-w-[150px]">{card.clientName}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          {card.completed_at ? (
                            <Badge variant="outline" className="text-emerald-600 border-emerald-100 bg-emerald-50 text-[10px]">
                              Concluída
                            </Badge>
                          ) : (
                            <span className="text-slate-600">{card.statusLabel}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-500">
                        {card.due_date ? (
                          <div className="flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5" />
                            {new Date(card.due_date).toLocaleDateString("pt-BR")}
                          </div>
                        ) : "—"}
                      </td>
                      <td className="px-6 py-4">
                        <Badge 
                          variant="outline" 
                          className={cn(
                            "text-[10px]",
                            card.evolucao === "Atrasada" ? "text-red-600 border-red-200 bg-red-50" :
                            card.evolucao === "Prazo próximo" ? "text-amber-600 border-amber-200 bg-amber-50" :
                            "text-slate-600 border-slate-200 bg-slate-50"
                          )}
                        >
                          {card.evolucao === "Atrasada" && <AlertTriangle className="w-3 h-3 mr-1" />}
                          {card.evolucao === "Prazo próximo" && <Clock className="w-3 h-3 mr-1" />}
                          {card.evolucao}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem 
                              className="gap-2"
                              onClick={() => {
                                window.open(`/tarefas/b/${card.board_id}?card=${card.id}`, "_blank");
                              }}
                            >
                              <Eye className="h-4 w-4" /> Ver ação
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
