import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/AppShell";
import { ShieldCheck, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/permissoes")({
  component: PermissoesPage,
});

const MODULES = [
  "BI", "Imersões", "Entrevistas", "Price", "Clientes",
  "Representantes", "Agentes", "Projeção", "Novo Corp", "Admin",
];
const ROLES = ["Gestão", "Diretoria", "Liderança"];

// default matrix: Gestão vê tudo; Diretoria vê tudo menos Admin; Liderança operacional
const MATRIX: Record<string, Record<string, boolean>> = {
  "Gestão": Object.fromEntries(MODULES.map(m => [m, true])),
  "Diretoria": Object.fromEntries(MODULES.map(m => [m, m !== "Admin"])),
  "Liderança": Object.fromEntries(MODULES.map(m => [m, !["Admin", "Novo Corp", "Agentes"].includes(m)])),
};

function PermissoesPage() {
  return (
    <div>
      <div className="border-b border-border px-8 py-6">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Permissões</h1>
            <p className="text-sm text-muted-foreground">Matriz de acesso por perfil</p>
          </div>
        </div>
      </div>

      <PageHeader title="Perfis × Módulos" subtitle="Defina o que cada perfil pode acessar" />

      <div className="p-4 sm:p-8">
        <div className="rounded-xl border border-border bg-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground border-b border-border">
                <th className="px-6 py-3 font-normal">Módulo</th>
                {ROLES.map(r => (
                  <th key={r} className="px-6 py-3 font-normal text-center">{r}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MODULES.map(m => (
                <tr key={m} className="border-b border-border last:border-0 hover:bg-muted/30">
                  <td className="px-6 py-4 font-medium">{m}</td>
                  {ROLES.map(r => {
                    const on = MATRIX[r][m];
                    return (
                      <td key={r} className="px-6 py-4 text-center">
                        <span
                          className={cn(
                            "inline-flex h-7 w-7 items-center justify-center rounded-full",
                            on ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground/40"
                          )}
                        >
                          {on ? <Check className="h-4 w-4" /> : "—"}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          Ajustes finos por usuário podem ser configurados em <strong>Admin → Usuários</strong>.
        </p>
      </div>
    </div>
  );
}
