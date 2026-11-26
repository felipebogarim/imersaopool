import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { PageHeader } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { extractFileText } from "@/lib/sintese-file-text";
import {
  getBrainAdminOverview,
  listBrainKnowledge,
  saveBrainKnowledge,
  saveBrainSettings,
  setBrainKnowledgeStatus,
  setBrainRoleCapability,
} from "@/lib/brain.functions";
import {
  BRAIN_CAPABILITIES,
  BRAIN_CAPABILITY_LABEL,
  type BrainCapability,
} from "@/lib/brain/types";

export const Route = createFileRoute("/_authenticated/inteligencia/gestao")({
  ssr: false,
  head: () => ({ meta: [{ title: "Gestão do Brain | PoolFlux" }] }),
  component: GestaoBrainPage,
});

const PAPEIS = [
  "admin",
  "gestor",
  "gestor_comercial",
  "comercial",
  "agente",
  "representante",
] as const;
const TIPOS = [
  "imersao",
  "percepcao",
  "concorrencia",
  "decisao",
  "diagnostico",
  "institucional",
  "regra",
  "glossario",
  "outro",
] as const;
type Tipo = (typeof TIPOS)[number];
type Conf = "representantes" | "gestao" | "restrito";

const fmt = (n: number) => n.toLocaleString("pt-BR");

function GestaoBrainPage() {
  const qc = useQueryClient();
  const overviewFn = useServerFn(getBrainAdminOverview);
  const settingsFn = useServerFn(saveBrainSettings);
  const capFn = useServerFn(setBrainRoleCapability);
  const { data, error, isLoading } = useQuery({
    queryKey: ["brain-admin"],
    queryFn: () => overviewFn(),
  });

  if (isLoading) return <p className="p-6 text-sm text-muted-foreground">Carregando…</p>;
  if (error || !data)
    return (
      <p className="m-6 text-sm text-destructive">
        {error instanceof Error ? error.message : "Sem acesso."}
      </p>
    );

  const pode = (c: BrainCapability) => data.capabilities.includes(c);
  const s = data.settings;
  const salvar = async (patch: Record<string, unknown>) => {
    try {
      await settingsFn({ data: patch });
      toast.success("Configuração salva.");
      void qc.invalidateQueries({ queryKey: ["brain-admin"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao salvar.");
    }
  };
  const temCap = (role: string, cap: string) =>
    data.papeis.some((p) => p.role === role && p.capability === cap);

  return (
    <div className="space-y-4 p-4">
      <PageHeader
        title="Gestão do Brain"
        subtitle="Inteligência Comercial Newline — configuração, conhecimento e auditoria"
      />
      {!s.persistencia && (
        <p className="rounded-md border border-amber-400/50 bg-amber-50 p-3 text-sm dark:bg-amber-950/30">
          A migration do Brain ainda não foi aplicada: o chat funciona para gestão sem histórico, e
          as configurações abaixo usam os padrões do sistema (somente leitura).
        </p>
      )}
      <Tabs defaultValue="config">
        <TabsList>
          <TabsTrigger value="config">Configuração</TabsTrigger>
          <TabsTrigger value="permissoes">Permissões</TabsTrigger>
          <TabsTrigger value="conhecimento">Conhecimento</TabsTrigger>
          {(pode("custos_limites") || pode("auditoria")) && (
            <TabsTrigger value="uso">Uso e auditoria</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="config" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 rounded-lg border p-4">
              <h3 className="text-sm font-semibold">Portal do Representante</h3>
              <p className="text-xs text-muted-foreground">
                Mantenha desligado até a aprovação dos testes de isolamento entre carteiras.
              </p>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  disabled={!pode("custos_limites") || !s.persistencia}
                  checked={s.portal_representante_habilitado}
                  onChange={(e) => {
                    if (
                      e.target.checked &&
                      !window.confirm("Liberar o chat no Portal do Representante?")
                    )
                      return;
                    void salvar({ portal_representante_habilitado: e.target.checked });
                  }}
                />
                Chat habilitado no portal
              </label>
            </div>
            <ConfigNumeros s={s} pode={pode("custos_limites") && s.persistencia} salvar={salvar} />
            <ConfigModelos s={s} pode={pode("modelos") && s.persistencia} salvar={salvar} />
          </div>
        </TabsContent>

        <TabsContent value="permissoes">
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-xs">
              <thead className="bg-muted/60">
                <tr>
                  <th className="px-2 py-2 text-left">Capacidade</th>
                  {PAPEIS.map((p) => (
                    <th key={p} className="px-2 py-2">
                      {p}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {BRAIN_CAPABILITIES.map((c) => (
                  <tr key={c} className="border-t">
                    <td className="px-2 py-1.5">{BRAIN_CAPABILITY_LABEL[c]}</td>
                    {PAPEIS.map((p) => (
                      <td key={p} className="px-2 py-1.5 text-center">
                        <input
                          type="checkbox"
                          aria-label={`${c} ${p}`}
                          checked={p === "admin" || temCap(p, c)}
                          disabled={
                            !data.isAdmin ||
                            !s.persistencia ||
                            p === "admin" ||
                            (p === "representante" && c !== "chat")
                          }
                          onChange={async (e) => {
                            try {
                              await capFn({
                                data: { role: p, capability: c, ativo: e.target.checked },
                              });
                              void qc.invalidateQueries({ queryKey: ["brain-admin"] });
                            } catch (err) {
                              toast.error(err instanceof Error ? err.message : "Falha ao salvar.");
                            }
                          }}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Papéis sem capacidade de chat ficam bloqueados. Representantes acessam somente a própria
            carteira, independentemente desta tabela.
          </p>
        </TabsContent>

        <TabsContent value="conhecimento">
          <Conhecimento pode={pode} />
        </TabsContent>

        <TabsContent value="uso" className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-4">
            {[
              ["Turnos (30 dias)", fmt(data.uso30d.turnos)],
              ["Usuários", fmt(data.uso30d.usuarios)],
              [
                "Tokens entrada/saída",
                `${fmt(data.uso30d.tokensEntrada)} / ${fmt(data.uso30d.tokensSaida)}`,
              ],
              ["Erros", fmt(data.uso30d.erros)],
            ].map(([l, v]) => (
              <div key={l} className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">{l}</p>
                <p className="text-lg font-semibold tabular-nums">{v}</p>
              </div>
            ))}
          </div>
          {pode("auditoria") && (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-xs">
                <thead className="bg-muted/60">
                  <tr>
                    {[
                      "Quando",
                      "Usuário",
                      "Interface",
                      "Escopo",
                      "Ferramentas",
                      "Clientes",
                      "Status",
                    ].map((h) => (
                      <th key={h} className="px-2 py-2 text-left">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.auditoria.map((a, i) => (
                    <tr key={i} className="border-t">
                      <td className="px-2 py-1 whitespace-nowrap">
                        {new Date(a.created_at).toLocaleString("pt-BR")}
                      </td>
                      <td className="px-2 py-1 font-mono">{a.user_id.slice(0, 8)}</td>
                      <td className="px-2 py-1">{a.interface}</td>
                      <td className="px-2 py-1">{a.escopo}</td>
                      <td className="px-2 py-1">
                        {(a.ferramentas ?? []).map((f) => f.nome).join(", ")}
                      </td>
                      <td className="px-2 py-1">{(a.clientes ?? []).length}</td>
                      <td className="px-2 py-1">{a.status}</td>
                    </tr>
                  ))}
                  {!data.auditoria.length && (
                    <tr>
                      <td colSpan={7} className="px-2 py-3 text-center text-muted-foreground">
                        Sem registros.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

type S = Awaited<ReturnType<typeof getBrainAdminOverview>>["settings"];

function ConfigNumeros({
  s,
  pode,
  salvar,
}: {
  s: S;
  pode: boolean;
  salvar: (p: Record<string, unknown>) => Promise<void>;
}) {
  const [v, setV] = useState({
    retencao_conversas_dias: s.retencao_conversas_dias,
    retencao_anexos_dias: s.retencao_anexos_dias,
    limite_mensagens_dia: s.limite_mensagens_dia,
  });
  const campos: Array<[keyof typeof v, string]> = [
    ["retencao_conversas_dias", "Retenção de conversas (dias)"],
    ["retencao_anexos_dias", "Retenção de anexos (dias)"],
    ["limite_mensagens_dia", "Limite de mensagens por usuário/dia"],
  ];
  return (
    <div className="space-y-2 rounded-lg border p-4">
      <h3 className="text-sm font-semibold">Retenção e limites</h3>
      {campos.map(([k, l]) => (
        <label key={k} className="flex items-center justify-between gap-2 text-xs">
          {l}
          <Input
            type="number"
            className="h-8 w-28"
            disabled={!pode}
            value={v[k]}
            onChange={(e) => setV({ ...v, [k]: Number(e.target.value) })}
          />
        </label>
      ))}
      <Button size="sm" disabled={!pode} onClick={() => void salvar(v)}>
        Salvar
      </Button>
    </div>
  );
}

function ConfigModelos({
  s,
  pode,
  salvar,
}: {
  s: S;
  pode: boolean;
  salvar: (p: Record<string, unknown>) => Promise<void>;
}) {
  const [v, setV] = useState({ modelo_padrao: s.modelo_padrao, modelo_analise: s.modelo_analise });
  return (
    <div className="space-y-2 rounded-lg border p-4">
      <h3 className="text-sm font-semibold">Modelos (Lovable AI Gateway)</h3>
      <label className="block space-y-1 text-xs">
        Padrão
        <Input
          disabled={!pode}
          value={v.modelo_padrao}
          onChange={(e) => setV({ ...v, modelo_padrao: e.target.value })}
        />
      </label>
      <label className="block space-y-1 text-xs">
        Análise aprofundada
        <Input
          disabled={!pode}
          value={v.modelo_analise}
          onChange={(e) => setV({ ...v, modelo_analise: e.target.value })}
        />
      </label>
      <Button size="sm" disabled={!pode} onClick={() => void salvar(v)}>
        Salvar
      </Button>
    </div>
  );
}

function Conhecimento({ pode }: { pode: (c: BrainCapability) => boolean }) {
  const qc = useQueryClient();
  const listFn = useServerFn(listBrainKnowledge);
  const saveFn = useServerFn(saveBrainKnowledge);
  const statusFn = useServerFn(setBrainKnowledgeStatus);
  const [busca, setBusca] = useState("");
  const [form, setForm] = useState({
    titulo: "",
    conteudo: "",
    tipo: "percepcao" as Tipo,
    camada: "memoria" as "memoria" | "institucional",
    cliente: "",
    fonte: "",
    data_referencia: "",
    confidencialidade: "gestao" as Conf,
  });
  const lista = useQuery({
    queryKey: ["brain-knowledge", busca],
    queryFn: () => listFn({ data: { busca } }),
    enabled:
      pode("conhecimento_cadastrar") || pode("conhecimento_aprovar") || pode("confidencialidade"),
  });

  async function salvar(importacao = false, itens = [form]) {
    try {
      const r = await saveFn({
        data: {
          importacao,
          itens: itens.map((i) => ({
            ...i,
            cliente: i.cliente || undefined,
            fonte: i.fonte || undefined,
            data_referencia: i.data_referencia || undefined,
          })),
        },
      });
      toast.success(
        r.status === "validado" ? "Conhecimento validado e disponível." : "Enviado para aprovação.",
      );
      setForm({ ...form, titulo: "", conteudo: "", cliente: "" });
      void qc.invalidateQueries({ queryKey: ["brain-knowledge"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao salvar.");
    }
  }

  async function importar(files: FileList | null) {
    if (!files?.length) return;
    const itens = [];
    for (const f of Array.from(files)) {
      const conteudo = (await extractFileText(f).catch(() => "")).trim();
      if (conteudo.length < 10) {
        toast.error(`${f.name}: sem texto extraível.`);
        continue;
      }
      itens.push({ ...form, titulo: f.name, conteudo: conteudo.slice(0, 100_000), fonte: f.name });
    }
    if (itens.length) await salvar(true, itens);
  }

  if (!lista.data && !pode("conhecimento_cadastrar"))
    return <p className="text-sm text-muted-foreground">Sem permissão para o conhecimento.</p>;

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
      {pode("conhecimento_cadastrar") && (
        <div className="space-y-2 rounded-lg border p-4">
          <h3 className="text-sm font-semibold">Cadastrar conhecimento</h3>
          <Input
            placeholder="Título"
            value={form.titulo}
            onChange={(e) => setForm({ ...form, titulo: e.target.value })}
          />
          <Textarea
            placeholder="Conteúdo (percepção, regra, decisão, metodologia…)"
            rows={6}
            value={form.conteudo}
            onChange={(e) => setForm({ ...form, conteudo: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-2 text-xs">
            <select
              className="h-8 rounded-md border bg-background px-2"
              value={form.tipo}
              onChange={(e) => setForm({ ...form, tipo: e.target.value as Tipo })}
            >
              {TIPOS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <select
              className="h-8 rounded-md border bg-background px-2"
              value={form.camada}
              onChange={(e) =>
                setForm({ ...form, camada: e.target.value as "memoria" | "institucional" })
              }
            >
              <option value="memoria">Memória comercial</option>
              <option value="institucional">Institucional</option>
            </select>
            <select
              className="h-8 rounded-md border bg-background px-2"
              value={form.confidencialidade}
              onChange={(e) => setForm({ ...form, confidencialidade: e.target.value as Conf })}
            >
              <option value="representantes">Visível a representantes</option>
              <option value="gestao">Somente gestão</option>
              {pode("confidencialidade") && <option value="restrito">Restrito</option>}
            </select>
            <Input
              className="h-8"
              type="date"
              value={form.data_referencia}
              onChange={(e) => setForm({ ...form, data_referencia: e.target.value })}
            />
            <Input
              className="h-8"
              placeholder="Cliente (opcional)"
              value={form.cliente}
              onChange={(e) => setForm({ ...form, cliente: e.target.value })}
            />
            <Input
              className="h-8"
              placeholder="Fonte"
              value={form.fonte}
              onChange={(e) => setForm({ ...form, fonte: e.target.value })}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              disabled={form.titulo.length < 3 || form.conteudo.length < 10}
              onClick={() => void salvar()}
            >
              Salvar
            </Button>
            {pode("conhecimento_importar") && (
              <label className="inline-flex cursor-pointer items-center rounded-md border px-3 text-xs hover:bg-muted">
                Importar arquivos
                <input
                  type="file"
                  multiple
                  hidden
                  accept=".pdf,.docx,.xlsx,.csv,.txt,.md"
                  onChange={(e) => void importar(e.target.files)}
                />
              </label>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground">
            Sem permissão de aprovação, o item entra como sugestão e só é usado pelo chat após
            aprovado.
          </p>
        </div>
      )}
      <div className="space-y-2 rounded-lg border p-4">
        <Input
          placeholder="Buscar por título"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
        {lista.data && !lista.data.available && (
          <p className="text-xs text-muted-foreground">
            Base de conhecimento indisponível (migration pendente).
          </p>
        )}
        <div className="max-h-[60vh] space-y-1.5 overflow-y-auto">
          {(lista.data?.itens ?? []).map((k) => (
            <div key={k.id} className="flex items-start gap-2 rounded-md border p-2 text-xs">
              <div className="flex-1">
                <p className="font-medium">{k.titulo}</p>
                <p className="text-muted-foreground">
                  {k.tipo} · {k.confidencialidade}
                  {k.cliente_nome ? ` · ${k.cliente_nome}` : ""} · v{k.versao}
                </p>
              </div>
              <Badge variant={k.status === "validado" ? "default" : "secondary"}>{k.status}</Badge>
              {pode("conhecimento_aprovar") && k.status !== "validado" && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 px-2 text-[10px]"
                  onClick={() =>
                    void statusFn({ data: { id: k.id, status: "validado" } }).then(() =>
                      qc.invalidateQueries({ queryKey: ["brain-knowledge"] }),
                    )
                  }
                >
                  Aprovar
                </Button>
              )}
              {pode("conhecimento_aprovar") && k.status === "validado" && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 px-2 text-[10px]"
                  onClick={() =>
                    void statusFn({ data: { id: k.id, status: "inativo" } }).then(() =>
                      qc.invalidateQueries({ queryKey: ["brain-knowledge"] }),
                    )
                  }
                >
                  Inativar
                </Button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
