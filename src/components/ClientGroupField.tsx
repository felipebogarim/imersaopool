import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Users, Search } from "lucide-react";

type Props = {
  pertenceGrupo: boolean;
  grupoNome: string;
  onChange: (v: { pertence_grupo: boolean; grupo_nome: string | null }) => void;
};

export function ClientGroupField({ pertenceGrupo, grupoNome, onChange }: Props) {
  const [q, setQ] = useState("");

  const { data: groups = [] } = useQuery({
    queryKey: ["client-groups"],
    queryFn: async () => {
      const { data } = await supabase
        .from("clients")
        .select("grupo_nome")
        .not("grupo_nome", "is", null);
      const uniq = Array.from(new Set((data ?? []).map((r: any) => r.grupo_nome).filter(Boolean))).sort();
      return uniq as string[];
    },
  });

  const { data: peers = [] } = useQuery({
    queryKey: ["group-peers", grupoNome],
    enabled: pertenceGrupo && !!grupoNome,
    queryFn: async () => {
      const { data } = await supabase
        .from("clients")
        .select("id, nome_fantasia, cidade, estado")
        .eq("grupo_nome", grupoNome)
        .limit(20);
      return data ?? [];
    },
  });

  const filtered = useMemo(
    () => groups.filter((g) => !q || g.toLowerCase().includes(q.toLowerCase())).slice(0, 10),
    [groups, q]
  );

  return (
    <div className="md:col-span-2 rounded-lg border border-border p-4 space-y-3 bg-muted/10">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-cyan" />
          <Label className="text-sm font-medium">Pertence a um grupo econômico?</Label>
        </div>
        <Switch
          checked={pertenceGrupo}
          onCheckedChange={(v) => onChange({ pertence_grupo: v, grupo_nome: v ? grupoNome : null })}
        />
      </div>

      {pertenceGrupo && (
        <div className="space-y-2">
          <div>
            <Label className="text-xs text-muted-foreground">Nome do grupo</Label>
            <Input
              value={grupoNome}
              onChange={(e) => onChange({ pertence_grupo: true, grupo_nome: e.target.value })}
              placeholder="Digite ou selecione um grupo existente"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Buscar grupo existente</Label>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                className="pl-8"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Filtrar grupos..."
              />
            </div>
            {q && filtered.length > 0 && (
              <div className="mt-1 max-h-40 overflow-y-auto rounded-md border border-border bg-background">
                {filtered.map((g) => (
                  <button
                    type="button"
                    key={g}
                    onClick={() => {
                      onChange({ pertence_grupo: true, grupo_nome: g });
                      setQ("");
                    }}
                    className="block w-full text-left px-3 py-1.5 text-sm hover:bg-muted"
                  >
                    {g}
                  </button>
                ))}
              </div>
            )}
          </div>
          {peers.length > 0 && (
            <div className="text-xs text-muted-foreground">
              {peers.length} cliente(s) já no grupo <span className="font-medium text-foreground">{grupoNome}</span>
              <ul className="mt-1 space-y-0.5">
                {peers.slice(0, 5).map((p: any) => (
                  <li key={p.id}>• {p.nome_fantasia} {p.cidade ? `— ${p.cidade}/${p.estado ?? ""}` : ""}</li>
                ))}
                {peers.length > 5 && <li>… e mais {peers.length - 5}</li>}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
