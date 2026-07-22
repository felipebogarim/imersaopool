import { createFileRoute } from "@tanstack/react-router";
import { ShieldCheck, ExternalLink, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

const PDF_URL =
  "/__l5e/assets-v1/b3cfe05f-1f3f-48bd-a147-7bb152e1800a/Relatorio_Final_Seguranca_Privacidade_Conformidade.pdf";

export const Route = createFileRoute("/_authenticated/admin/criterios-seguranca")({
  component: CriteriosSegurancaPage,
  head: () => ({
    meta: [
      { title: "Critérios de Segurança | Admin" },
      {
        name: "description",
        content:
          "Relatório completo dos critérios de segurança, privacidade e conformidade adotados pela plataforma.",
      },
    ],
  }),
});

function CriteriosSegurancaPage() {
  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-primary/10 text-primary">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold">Critérios de Segurança</h1>
            <p className="text-sm text-muted-foreground max-w-2xl">
              Documento oficial com os critérios de segurança, privacidade e
              conformidade aplicados à plataforma. Este é o mesmo relatório
              disponibilizado ao usuário no aceite dos termos.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <a href={PDF_URL} target="_blank" rel="noopener">
              <ExternalLink className="h-4 w-4 mr-2" /> Abrir em nova aba
            </a>
          </Button>
          <Button asChild>
            <a href={PDF_URL} download>
              <Download className="h-4 w-4 mr-2" /> Baixar PDF
            </a>
          </Button>
        </div>
      </header>

      <div className="border rounded-lg overflow-hidden bg-muted/30" style={{ height: "80vh" }}>
        <iframe
          src={PDF_URL}
          title="Critérios de Segurança"
          className="w-full h-full"
        />
      </div>
    </div>
  );
}
