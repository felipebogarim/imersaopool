import { createFileRoute, Link } from "@tanstack/react-router";
import { Settings2, ShieldCheck, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useGroContext } from "@/hooks/useGroContext";

export const Route = createFileRoute("/_authenticated/gro/usuarios")({
  component: ConsultancyUsers,
});

function ConsultancyUsers() {
  const { data: context } = useGroContext();
  if (!context?.isConsultant) {
    return <div className="p-8 text-center">Área restrita à consultoria.</div>;
  }
  return (
    <div className="mx-auto max-w-5xl p-4 sm:p-8">
      <h1 className="text-2xl font-bold">Usuários</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Administração dos acessos da consultoria e das empresas atendidas.
      </p>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-5 w-5 text-primary" /> Usuários cadastrados
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>Os perfis utilizam o Supabase Auth e o RBAC existente.</p>
            {context.isPlatformAdmin ? (
              <Button asChild variant="outline">
                <Link to="/admin/usuarios">Gerenciar usuários</Link>
              </Button>
            ) : (
              <p className="rounded-lg border border-dashed p-3">
                Seu perfil permite consultar esta área, mas alterações de acesso exigem um
                administrador da plataforma.
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-5 w-5 text-primary" /> Perfis reconhecidos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>Administração da plataforma</p>
            <p>Consultoria — administração e operação</p>
            <p>Empresa — administração e usuário</p>
            <p className="flex items-center gap-2 pt-2 text-xs">
              <Settings2 className="h-4 w-4" /> As permissões continuam centralizadas no RBAC.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
