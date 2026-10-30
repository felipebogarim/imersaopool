import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Loader2, Paperclip, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { BrandMark } from "@/components/Brand";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  ACTION_FILES_BUCKET,
  ACTION_MAX_FILE_BYTES,
  ACTION_STATUSES,
  ACTION_STATUS_LABEL,
  formatPrazo,
  type ActionStatus,
  type ActionUpdateInput,
} from "@/lib/action-tracking";
import {
  createPublicActionUpload,
  getPublicActionForm,
  submitPublicActionUpdate,
  type PublicActionForm,
} from "@/lib/action-tracking.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/atualizacao-acoes/$token")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Atualização das ações" }, { name: "robots", content: "noindex" }],
  }),
  component: PublicActionUpdatePage,
});

type Pend = { description: string; assigneeName: string; assigneeUserId: string | null };
type Draft = {
  status: ActionStatus;
  note: string;
  pendencias: Pend[];
  files: { path: string; name: string; mime: string | null; size: number }[];
  uploading: boolean;
};

const OTHER = "__outro__";

function PublicActionUpdatePage() {
  const { token } = Route.useParams();
  const loadFn = useServerFn(getPublicActionForm);
  const uploadFn = useServerFn(createPublicActionUpload);
  const submitFn = useServerFn(submitPublicActionUpdate);

  const [form, setForm] = useState<PublicActionForm | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [submitting, setSubmitting] = useState(false);
  const [saved, setSaved] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const f = await loadFn({ data: { token } });
        setForm(f);
        if (f.valid) {
          setDrafts(
            Object.fromEntries(
              f.actions.map((a) => [
                a.id,
                { status: a.status, note: "", pendencias: [], files: [], uploading: false },
              ]),
            ),
          );
        }
      } catch {
        setForm({ valid: false, reason: "not_found" });
      }
    })();
  }, [token, loadFn]);

  const patch = (id: string, p: Partial<Draft>) =>
    setDrafts((d) => ({ ...d, [id]: { ...d[id], ...p } }));

  async function addFiles(cardId: string, list: FileList | null) {
    if (!list?.length) return;
    patch(cardId, { uploading: true });
    setError(null);
    try {
      const added: Draft["files"] = [];
      for (const file of Array.from(list)) {
        if (file.size > ACTION_MAX_FILE_BYTES) throw new Error(`"${file.name}" tem mais de 25MB.`);
        const { path, uploadToken } = await uploadFn({
          data: { token, cardId, fileName: file.name, size: file.size },
        });
        const { error: upErr } = await supabase.storage
          .from(ACTION_FILES_BUCKET)
          .uploadToSignedUrl(path, uploadToken, file, { contentType: file.type || undefined });
        if (upErr) throw new Error(`Falha ao enviar "${file.name}".`);
        added.push({ path, name: file.name, mime: file.type || null, size: file.size });
      }
      setDrafts((d) => ({
        ...d,
        [cardId]: { ...d[cardId], files: [...d[cardId].files, ...added] },
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao enviar o arquivo.");
    } finally {
      patch(cardId, { uploading: false });
    }
  }

  async function submit() {
    if (!form?.valid) return;
    setSubmitting(true);
    setError(null);
    try {
      const updates: ActionUpdateInput[] = form.actions.map((a) => {
        const d = drafts[a.id];
        return {
          cardId: a.id,
          status: d.status,
          note: d.note,
          pendencias: d.pendencias.filter((p) => p.description.trim() && p.assigneeName.trim()),
          files: d.files.map((f) => ({ path: f.path, name: f.name, mime: f.mime, size: f.size })),
        };
      });
      const r = await submitFn({ data: { token, updates } });
      setSaved(r.saved);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível enviar.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="mx-auto max-w-3xl space-y-5 p-4 sm:p-6">
        <div className="flex items-center gap-3">
          <BrandMark />
          <h1 className="text-xl font-semibold">Atualização das ações</h1>
        </div>

        {!form ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : !form.valid ? (
          <p className="rounded-lg border bg-background p-6 text-sm">
            {form.reason === "expired"
              ? "Este link expirou. Aguarde o próximo e-mail semanal ou peça um novo link."
              : "Este link não é válido."}
          </p>
        ) : saved !== null ? (
          <div className="space-y-2 rounded-lg border bg-background p-6">
            <CheckCircle2 className="h-8 w-8 text-emerald-600" />
            <p className="font-medium">
              {saved
                ? `Obrigado! ${saved} ação(ões) atualizada(s).`
                : "Nenhuma alteração foi informada."}
            </p>
            {saved ? (
              <p className="text-sm text-muted-foreground">
                O responsável foi avisado e você receberá uma cópia por e-mail. Você pode reabrir
                este link para enviar novas atualizações até{" "}
                {new Date(form.expiresAt).toLocaleDateString("pt-BR")}.
              </p>
            ) : null}
            <Button variant="outline" onClick={() => setSaved(null)}>
              Voltar ao formulário
            </Button>
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Olá, {form.repName}. Marque o status de cada ação, escreva uma nota, anexe arquivos
              (fotos, vídeos, PDFs…) e registre pendências que dependem de outras pessoas. Só o que
              você preencher ou alterar será enviado.
            </p>
            {!form.actions.length ? (
              <p className="rounded-lg border bg-background p-6 text-sm">
                Você não tem ações vinculadas no momento.
              </p>
            ) : (
              form.actions.map((a) => {
                const d = drafts[a.id];
                if (!d) return null;
                return (
                  <section key={a.id} className="space-y-3 rounded-lg border bg-background p-4">
                    <div>
                      <h2 className="font-semibold">{a.title}</h2>
                      <p className="text-xs text-muted-foreground">
                        {a.client ? `${a.client} · ` : ""}Prazo: {formatPrazo(a.due_date)}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Status">
                      {ACTION_STATUSES.map((s) => (
                        <button
                          key={s}
                          type="button"
                          role="radio"
                          aria-checked={d.status === s}
                          onClick={() => patch(a.id, { status: s })}
                          className={cn(
                            "rounded-full border px-4 py-1.5 text-sm transition-colors",
                            d.status === s
                              ? "border-primary bg-primary text-primary-foreground"
                              : "hover:bg-muted",
                          )}
                        >
                          {ACTION_STATUS_LABEL[s]}
                        </button>
                      ))}
                    </div>

                    <Textarea
                      placeholder="Notas sobre esta ação…"
                      value={d.note}
                      onChange={(e) => patch(a.id, { note: e.target.value })}
                    />

                    <div className="space-y-1">
                      <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-primary">
                        <Paperclip className="h-4 w-4" />
                        {d.uploading ? "Enviando…" : "Anexar arquivos (até 25MB cada)"}
                        <input
                          type="file"
                          multiple
                          className="hidden"
                          disabled={d.uploading}
                          onChange={(e) => {
                            void addFiles(a.id, e.target.files);
                            e.target.value = "";
                          }}
                        />
                      </label>
                      {d.files.map((f, i) => (
                        <div
                          key={f.path}
                          className="flex items-center justify-between text-xs text-muted-foreground"
                        >
                          <span className="truncate">{f.name}</span>
                          <button
                            type="button"
                            aria-label={`Remover ${f.name}`}
                            onClick={() =>
                              patch(a.id, { files: d.files.filter((_, k) => k !== i) })
                            }
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Pendências com outras pessoas</span>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            patch(a.id, {
                              pendencias: [
                                ...d.pendencias,
                                { description: "", assigneeName: "", assigneeUserId: null },
                              ],
                            })
                          }
                        >
                          <Plus className="mr-1 h-3.5 w-3.5" /> Pendência
                        </Button>
                      </div>
                      {d.pendencias.map((p, i) => {
                        const known = p.assigneeUserId
                          ? p.assigneeUserId
                          : p.assigneeName
                            ? OTHER
                            : "";
                        const setP = (np: Partial<Pend>) =>
                          patch(a.id, {
                            pendencias: d.pendencias.map((x, k) => (k === i ? { ...x, ...np } : x)),
                          });
                        return (
                          <div key={i} className="space-y-2 rounded-md border p-2">
                            <Input
                              placeholder="O que está pendente?"
                              value={p.description}
                              onChange={(e) => setP({ description: e.target.value })}
                            />
                            <div className="flex flex-wrap gap-2">
                              <select
                                className="h-9 rounded-md border bg-background px-2 text-sm"
                                value={known}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  const person = a.people.find((x) => x.id === v);
                                  if (person)
                                    setP({ assigneeUserId: person.id, assigneeName: person.name });
                                  else
                                    setP({
                                      assigneeUserId: null,
                                      assigneeName: v === OTHER ? " " : "",
                                    });
                                }}
                              >
                                <option value="">Com quem está?</option>
                                {a.people.map((x) => (
                                  <option key={x.id} value={x.id}>
                                    {x.name}
                                  </option>
                                ))}
                                <option value={OTHER}>Outra pessoa (digitar)</option>
                              </select>
                              {!p.assigneeUserId && known === OTHER ? (
                                <Input
                                  className="min-w-[180px] flex-1"
                                  placeholder="Nome da pessoa"
                                  value={p.assigneeName.trim() ? p.assigneeName : ""}
                                  onChange={(e) => setP({ assigneeName: e.target.value || " " })}
                                />
                              ) : null}
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                aria-label="Remover pendência"
                                onClick={() =>
                                  patch(a.id, {
                                    pendencias: d.pendencias.filter((_, k) => k !== i),
                                  })
                                }
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                );
              })
            )}

            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <Button
              className="w-full"
              disabled={
                submitting || !form.actions.length || Object.values(drafts).some((d) => d.uploading)
              }
              onClick={submit}
            >
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Enviar atualização
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
