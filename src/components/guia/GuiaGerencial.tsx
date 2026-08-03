import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  ArrowLeft, ArrowRight, BookOpen, Check, CheckCircle2, ChevronRight, Compass,
  ExternalLink, Eye, Flag, LayoutGrid, Lightbulb, ListChecks, MapPin, Play, Target,
} from "lucide-react";
import {
  GUIA_ETAPAS, GUIA_FLUXO, loadProgresso, saveProgresso, type GuiaEtapa, type GuiaProgresso,
} from "@/lib/guia-gerencial";

export function GuiaGerencial() {
  const [userId, setUserId] = useState<string | null>(null);
  const [prog, setProg] = useState<GuiaProgresso>(() => loadProgresso("anon"));
  const [modo, setModo] = useState<"mapa" | "trilha">("mapa");
  const [idx, setIdx] = useState(0);
  const [onboarding, setOnboarding] = useState(false);

  useEffect(() => {
    let alive = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!alive) return;
      const uid = data.user?.id ?? "anon";
      setUserId(uid);
      const p = loadProgresso(uid);
      setProg(p);
      if (!p.iniciadoEm && !p.onboardingDispensado) setOnboarding(true);
    });
    return () => { alive = false; };
  }, []);

  const persist = useCallback((patch: Partial<GuiaProgresso>) => {
    setProg(prev => {
      const next = { ...prev, ...patch };
      saveProgresso(userId ?? "anon", next);
      return next;
    });
  }, [userId]);

  const total = GUIA_ETAPAS.length;
  const pct = Math.round((prog.concluidas.length / total) * 100);
  const etapa = GUIA_ETAPAS[idx];

  const irPara = useCallback((i: number) => {
    const e = GUIA_ETAPAS[i];
    if (!e) return;
    setIdx(i);
    setModo("trilha");
    setProg(prev => {
      const next: GuiaProgresso = {
        ...prev,
        etapaAtual: e.id,
        visitadas: prev.visitadas.includes(e.id) ? prev.visitadas : [...prev.visitadas, e.id],
        iniciadoEm: prev.iniciadoEm ?? new Date().toISOString(),
      };
      saveProgresso(userId ?? "anon", next);
      return next;
    });
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }, [userId]);

  const concluirEtapa = useCallback((e: GuiaEtapa, avancar: boolean) => {
    setProg(prev => {
      const concluidas = prev.concluidas.includes(e.id) ? prev.concluidas : [...prev.concluidas, e.id];
      const next: GuiaProgresso = {
        ...prev,
        concluidas,
        concluidoEm: concluidas.length === total ? (prev.concluidoEm ?? new Date().toISOString()) : prev.concluidoEm,
      };
      saveProgresso(userId ?? "anon", next);
      return next;
    });
    if (avancar && e.numero < total) irPara(e.numero);
  }, [irPara, total, userId]);

  const continuarIdx = useMemo(() => {
    const i = GUIA_ETAPAS.findIndex(e => e.id === prog.etapaAtual);
    return i >= 0 ? i : 0;
  }, [prog.etapaAtual]);

  return (
    <div className="pb-16">
      <OnboardingDialog
        open={onboarding}
        onStart={() => { setOnboarding(false); irPara(0); }}
        onExplore={() => { setOnboarding(false); persist({ onboardingDispensado: true }); }}
        onLater={() => { setOnboarding(false); persist({ onboardingDispensado: true }); }}
      />

      {/* HERO */}
      <section className="border-b border-border bg-gradient-to-b from-primary/10 via-background to-background">
        <div className="mx-auto max-w-[1200px] px-4 sm:px-8 py-10 sm:py-14">
          <Badge variant="outline" className="mb-4 gap-1.5"><Compass className="h-3 w-3" /> Trilha gerencial</Badge>
          <h1 className="text-3xl sm:text-5xl font-bold tracking-tight">Guia de Uso Gerencial</h1>
          <p className="mt-3 text-base sm:text-lg text-muted-foreground max-w-3xl">
            Siga a trilha para transformar informações comerciais em decisões, prioridades e ações.
          </p>
          <p className="mt-2 text-sm text-muted-foreground max-w-3xl">
            Conheça o fluxo recomendado para analisar representantes, clientes, desempenho, preços e oportunidades
            comerciais dentro da plataforma.
          </p>

          <div className="mt-6 flex flex-wrap gap-2">
            <Button onClick={() => irPara(0)} className="gap-2"><Play className="h-4 w-4" /> Começar a trilha</Button>
            {prog.iniciadoEm && (
              <Button variant="secondary" onClick={() => irPara(continuarIdx)} className="gap-2">
                <ArrowRight className="h-4 w-4" /> Continuar de onde parei
              </Button>
            )}
            <Button variant="outline" onClick={() => setModo("mapa")} className="gap-2">
              <LayoutGrid className="h-4 w-4" /> Ver visão geral
            </Button>
          </div>

          <div className="mt-8 grid gap-3 grid-cols-2 lg:grid-cols-4">
            {[
              { icon: MapPin, label: "8 etapas" },
              { icon: Target, label: "Visão gerencial" },
              { icon: BookOpen, label: "Leitura orientada" },
              { icon: ExternalLink, label: "Acesso direto aos módulos" },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="surface rounded-xl p-4 flex items-center gap-3">
                <Icon className="h-4 w-4 text-cyan shrink-0" />
                <span className="text-sm font-medium">{label}</span>
              </div>
            ))}
          </div>

          <p className="mt-8 text-sm text-muted-foreground max-w-4xl border-l-2 border-primary/50 pl-4">
            “Uma boa gestão comercial começa pela compreensão do contexto, avança pela análise dos resultados e se
            completa quando os aprendizados são transformados em ações. Esta trilha mostra o caminho recomendado para
            utilizar o Imersão Comercial de forma gerencial.”
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-[1200px] px-4 sm:px-8">
        {/* PROGRESSO */}
        <div className="sticky top-0 z-20 -mx-4 sm:-mx-8 px-4 sm:px-8 py-3 bg-background/90 backdrop-blur border-b border-border">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-xs text-muted-foreground">
              {modo === "trilha"
                ? `Etapa ${etapa.numero} de ${total} · ${etapa.titulo}`
                : "Visão geral da trilha"}
            </p>
            <p className="text-xs font-mono">{pct}% concluído</p>
          </div>
          <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Progresso da trilha">
            <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>

        {modo === "mapa" ? (
          <MapaTrilha prog={prog} onSelect={irPara} />
        ) : (
          <EtapaDetalhe
            etapa={etapa}
            total={total}
            concluida={prog.concluidas.includes(etapa.id)}
            onPrev={() => irPara(idx - 1)}
            onNext={() => irPara(idx + 1)}
            onMapa={() => setModo("mapa")}
            onConcluir={(avancar) => concluirEtapa(etapa, avancar)}
          />
        )}

        {/* FINAL */}
        <section className="mt-12 surface rounded-2xl p-6 sm:p-8">
          <h2 className="text-2xl font-bold tracking-tight">Da informação à ação</h2>
          <p className="mt-3 text-sm text-muted-foreground max-w-3xl">
            “O Imersão Comercial conecta entrevistas, percepções, indicadores, clientes, preços e planos de ação. O valor
            do sistema está na utilização integrada dessas informações, permitindo que a gestão compreenda o contexto,
            identifique prioridades e acompanhe a execução.”
          </p>

          <div className="mt-6 flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => irPara(0)} className="gap-2">
              <BookOpen className="h-4 w-4" /> Revisar a trilha
            </Button>
            <Button variant="outline" onClick={() => setModo("mapa")} className="gap-2">
              <LayoutGrid className="h-4 w-4" /> Acessar o painel principal
            </Button>
            <Button asChild className="gap-2">
              <Link to="/tarefas"><ListChecks className="h-4 w-4" /> Continuar para Gestão de Tarefas</Link>
            </Button>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-x-2 gap-y-2 text-xs">
            {GUIA_FLUXO.map((f, i) => (
              <span key={f} className="flex items-center gap-2">
                <span className="rounded-full border border-border px-3 py-1 text-muted-foreground">{f}</span>
                {i < GUIA_FLUXO.length - 1 && <ChevronRight className="h-3 w-3 text-muted-foreground" aria-hidden />}
              </span>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function MapaTrilha({ prog, onSelect }: { prog: GuiaProgresso; onSelect: (i: number) => void }) {
  return (
    <section className="py-8">
      <h2 className="text-xl font-bold tracking-tight">Mapa geral da jornada</h2>
      <p className="text-sm text-muted-foreground mt-1">
        Cada etapa alimenta a seguinte. Clique em uma etapa para abrir a orientação completa.
      </p>

      <ol className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {GUIA_ETAPAS.map((e, i) => {
          const concluida = prog.concluidas.includes(e.id);
          const visitada = prog.visitadas.includes(e.id);
          return (
            <li key={e.id}>
              <button
                type="button"
                onClick={() => onSelect(i)}
                className="surface w-full text-left rounded-xl p-5 h-full transition hover:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="h-8 w-8 rounded-lg bg-primary/15 text-primary grid place-items-center text-sm font-bold">
                    {e.numero}
                  </span>
                  {concluida ? (
                    <span className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-cyan">
                      <CheckCircle2 className="h-3 w-3" /> Concluída
                    </span>
                  ) : visitada ? (
                    <span className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                      <Eye className="h-3 w-3" /> Visitada
                    </span>
                  ) : null}
                </div>
                <p className="font-semibold">{e.titulo}</p>
                <p className="text-xs text-muted-foreground mt-1">{e.resumo}</p>
                <span className="mt-3 inline-flex items-center gap-1 text-xs text-cyan">
                  Abrir etapa <ChevronRight className="h-3 w-3" />
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function Bloco({
  icon: Icon, titulo, children,
}: { icon: any; titulo: string; children: React.ReactNode }) {
  return (
    <div className="surface rounded-xl p-5">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="h-4 w-4 text-cyan" />
        <h3 className="text-sm font-semibold">{titulo}</h3>
      </div>
      {children}
    </div>
  );
}

function Lista({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2 text-sm text-muted-foreground">
      {items.map(t => (
        <li key={t} className="flex gap-2">
          <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary shrink-0" aria-hidden />
          <span>{t}</span>
        </li>
      ))}
    </ul>
  );
}

function EtapaDetalhe({
  etapa, total, concluida, onPrev, onNext, onMapa, onConcluir,
}: {
  etapa: GuiaEtapa;
  total: number;
  concluida: boolean;
  onPrev: () => void;
  onNext: () => void;
  onMapa: () => void;
  onConcluir: (avancar: boolean) => void;
}) {
  return (
    <section className="py-8 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Etapa {etapa.numero} de {total}</p>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mt-1">
            {etapa.numero}. {etapa.titulo}
          </h2>
          <p className="text-sm text-cyan mt-2">{etapa.frase}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {etapa.to ? (
            <Button asChild className="gap-2">
              <Link to={etapa.to as any}><ExternalLink className="h-4 w-4" /> {etapa.botao}</Link>
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <Badge variant="outline">Em desenvolvimento</Badge>
              <Button disabled className="gap-2"><ExternalLink className="h-4 w-4" /> {etapa.botao}</Button>
            </div>
          )}
        </div>
      </div>

      <div className="surface rounded-xl p-5 border-l-4 border-primary">
        <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Objetivo gerencial</p>
        <p className="text-sm">{etapa.objetivo}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Bloco icon={LayoutGrid} titulo="O que você encontrará">
          <Lista items={etapa.encontrar} />
        </Bloco>
        <Bloco icon={Compass} titulo="Como utilizar">
          <Lista items={etapa.comoUsar} />
        </Bloco>
        <Bloco icon={Eye} titulo="O que observar">
          <Lista items={etapa.observar} />
        </Bloco>
        <div className="space-y-4">
          <Bloco icon={Flag} titulo="Decisão esperada">
            <p className="text-sm text-muted-foreground">{etapa.decisao}</p>
          </Bloco>
          <Bloco icon={Lightbulb} titulo="Próximo passo recomendado">
            <p className="text-sm text-muted-foreground">{etapa.proximoPasso}</p>
          </Bloco>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-5">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={onPrev} disabled={etapa.numero === 1} className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Button>
          <Button variant="outline" onClick={onMapa} className="gap-2">
            <LayoutGrid className="h-4 w-4" /> Visão geral
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant={concluida ? "secondary" : "outline"}
            onClick={() => onConcluir(false)}
            className="gap-2"
          >
            <Check className="h-4 w-4" /> {concluida ? "Etapa concluída" : "Marcar como concluída"}
          </Button>
          <Button onClick={() => onConcluir(true)} disabled={etapa.numero === total} className="gap-2">
            Avançar <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </section>
  );
}

function OnboardingDialog({
  open, onStart, onExplore, onLater,
}: { open: boolean; onStart: () => void; onExplore: () => void; onLater: () => void }) {
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onLater(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Bem-vindo ao Imersão Comercial</DialogTitle>
          <DialogDescription>
            O Guia de Uso Gerencial mostra, em 8 etapas, como transformar informações comerciais em decisões e ações.
            Você pode percorrê-lo agora ou voltar quando quiser.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <Button onClick={onStart} className="gap-2"><Play className="h-4 w-4" /> Começar o Guia de Uso Gerencial</Button>
          <Button variant="secondary" onClick={onExplore}>Explorar o sistema agora</Button>
          <Button variant="ghost" onClick={onLater}>Ver este guia depois</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
