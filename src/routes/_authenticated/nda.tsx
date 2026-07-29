import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { BrandLogo } from "@/components/Brand";
import { ShieldCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const NDA_VERSION = "1.0";

export const Route = createFileRoute("/_authenticated/nda")({
  head: () => ({ meta: [{ title: "Termo de Sigilo — PoolFlux" }] }),
  component: NdaPage,
});

function NdaPage() {
  const navigate = useNavigate();
  const [uid, setUid] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUid(data.user?.id ?? null));
  }, []);

  async function accept() {
    if (!accepted || !uid) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ nda_accepted_at: new Date().toISOString(), nda_version: NDA_VERSION })
      .eq("id", uid);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Termo aceito");
    navigate({ to: "/empresas" });
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="w-full max-w-3xl surface rounded-2xl p-6 sm:p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-lg bg-primary/10"><ShieldCheck className="h-6 w-6 text-primary" /></div>
          <div>
            <BrandLogo />
            <h1 className="text-xl font-bold mt-2">Termo de Confidencialidade, Sigilo e LGPD</h1>
            <p className="text-xs text-muted-foreground">Versão {NDA_VERSION} — aceite obrigatório no primeiro acesso</p>
          </div>
        </div>

        <div className="prose prose-sm prose-invert max-h-[50vh] overflow-y-auto pr-2 space-y-4 text-sm leading-relaxed text-foreground/90">
          <p><strong>1. Confidencialidade absoluta.</strong> Toda e qualquer informação inserida, gerada, exportada ou visualizada nesta plataforma — incluindo dados de clientes, representantes, imersões, entrevistas, preços, estratégias comerciais, planos de ação, diagnósticos gerados por IA, anexos, gravações de áudio e quaisquer outros conteúdos — é considerada <strong>estritamente confidencial</strong>.</p>

          <p><strong>2. Proibição de compartilhamento.</strong> É <strong>expressamente proibido</strong> compartilhar, divulgar, reproduzir, transmitir, publicar ou disponibilizar a terceiros, por qualquer meio (físico, digital, verbal, capturas de tela, encaminhamento de arquivos, mensagens, redes sociais etc.), qualquer informação obtida através desta plataforma, sem <strong>autorização prévia, expressa e por escrito</strong> do responsável pela empresa titular dos dados.</p>

          <p><strong>3. Uso restrito.</strong> As informações só podem ser utilizadas para as finalidades legítimas de trabalho vinculadas à empresa que concedeu o acesso. Qualquer uso diverso — pessoal, comercial paralelo, competitivo, ou em benefício de terceiros — configura violação deste termo.</p>

          <p><strong>4. Lei Geral de Proteção de Dados (LGPD — Lei nº 13.709/2018).</strong> O usuário compromete-se a tratar todos os dados pessoais acessados em conformidade com a LGPD, respeitando princípios de finalidade, adequação, necessidade, transparência, segurança, prevenção e não discriminação. É vedado tratar dados pessoais fora das hipóteses legais autorizadas, e o usuário deve manter sigilo mesmo após o término de sua relação com a empresa.</p>

          <p><strong>5. Responsabilidade.</strong> O descumprimento deste termo sujeita o usuário às sanções cabíveis nas esferas <strong>civil, penal, trabalhista e administrativa</strong>, incluindo indenização por perdas e danos, e às penalidades previstas na LGPD (multas, bloqueio e eliminação de dados, entre outras).</p>

          <p><strong>6. Registro do aceite.</strong> Ao clicar em "Li e aceito", o usuário declara ter lido, compreendido e concordado integralmente com este termo. O aceite fica registrado com data, hora e identificação do usuário para fins de auditoria.</p>

          <p><strong>7. Vigência.</strong> As obrigações de sigilo previstas neste termo são <strong>permanentes</strong> e permanecem em vigor mesmo após o encerramento do acesso à plataforma.</p>
        </div>

        <div className="mt-6 pt-6 border-t border-border space-y-4">
          <label className="flex items-start gap-3 cursor-pointer">
            <Checkbox checked={accepted} onCheckedChange={v => setAccepted(v === true)} className="mt-0.5" />
            <span className="text-sm">
              Li e aceito integralmente o Termo de Confidencialidade, Sigilo e LGPD, comprometendo-me a manter sigilo absoluto e a não compartilhar informações desta plataforma com terceiros sem autorização.
            </span>
          </label>
          <Button onClick={accept} disabled={!accepted || saving} className="w-full">
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Aceitar e continuar
          </Button>
        </div>
      </div>
    </div>
  );
}
