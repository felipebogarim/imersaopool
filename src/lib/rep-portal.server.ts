// Server-only: núcleo do portal do representante (usuário externo com login).
// Tudo aqui usa service role, SEMPRE escopado ao representante vinculado ao usuário logado.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  ACTION_FILES_BUCKET,
  formatPrazo,
  readActionMeta,
  type ActionAcceptance,
  type ActionStatus,
} from "@/lib/action-tracking";
import { listActionsForRep, notifySubmission, sendSystemEmail } from "@/lib/action-tracking.server";
import { needsRepFirstAccess } from "@/lib/rep-first-access";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const admin = supabaseAdmin as any;
const origin = () => process.env.PUBLIC_SITE_URL || "https://poolflux.app";

export type PortalRep = { id: string; nome: string; email: string | null };

/** Representante vinculado ao usuário logado; sem vínculo = sem acesso ao portal. */
export async function repForUser(userId: string): Promise<PortalRep> {
  const { data } = await admin
    .from("representatives")
    .select("id, nome, email")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) throw new Error("Acesso restrito a representantes.");
  return data as PortalRep;
}

export type PortalFile = { id: string; name: string; mime: string | null; url: string | null };
export type PortalUpdate = {
  id: string;
  author: string | null;
  status: ActionStatus | null;
  note: string | null;
  created_at: string;
  files: PortalFile[];
};
export type PortalExtension = {
  id: string;
  requested_due: string;
  justification: string;
  status: "pendente" | "aprovada" | "recusada";
  decision_note: string | null;
  created_at: string;
};
export type PortalAction = {
  id: string;
  title: string;
  client?: string;
  due_date: string | null;
  status: ActionStatus;
  acceptance: ActionAcceptance;
  updates: PortalUpdate[];
  extensions: PortalExtension[];
};

/**
 * Ações do representante. Só aparecem as que já foram ENVIADAS como sugestão — rascunhos
 * internos (acceptance = 'nao_enviada') nunca são expostos.
 */
export async function loadPortal(rep: PortalRep): Promise<PortalAction[]> {
  const actions = (await listActionsForRep(rep.id, { includeDone: true })).filter(
    (a) => a.acceptance !== "nao_enviada",
  );
  const ids = actions.map((a) => a.id);
  if (!ids.length) return [];

  const [{ data: updates }, { data: files }, { data: exts }] = await Promise.all([
    admin
      .from("kanban_action_updates")
      .select("id, card_id, author_name, status, note, created_at")
      .in("card_id", ids)
      .eq("source", "representante")
      .order("created_at", { ascending: false })
      .limit(500),
    admin
      .from("kanban_action_update_files")
      .select("id, update_id, card_id, storage_path, file_name, mime_type")
      .in("card_id", ids),
    admin
      .from("kanban_action_extension_requests")
      .select("id, card_id, requested_due, justification, status, decision_note, created_at")
      .eq("representative_id", rep.id)
      .in("card_id", ids)
      .order("created_at", { ascending: false }),
  ]);

  const signed = new Map<string, string | null>();
  await Promise.all(
    (files ?? []).map(async (f: { id: string; storage_path: string }) => {
      const { data } = await admin.storage
        .from(ACTION_FILES_BUCKET)
        .createSignedUrl(f.storage_path, 3600);
      signed.set(f.id, data?.signedUrl ?? null);
    }),
  );

  return actions.map((a) => ({
    id: a.id,
    title: a.title,
    client: readActionMeta(a.metadata).client_name,
    due_date: a.due_date,
    status: a.status,
    acceptance: a.acceptance,
    updates: (updates ?? [])
      .filter((u: { card_id: string }) => u.card_id === a.id)
      .slice(0, 20)
      .map(
        (u: {
          id: string;
          author_name: string | null;
          status: ActionStatus | null;
          note: string | null;
          created_at: string;
        }): PortalUpdate => ({
          id: u.id,
          author: u.author_name,
          status: u.status,
          note: u.note,
          created_at: u.created_at,
          files: (files ?? [])
            .filter((f: { update_id: string }) => f.update_id === u.id)
            .map((f: { id: string; file_name: string; mime_type: string | null }) => ({
              id: f.id,
              name: f.file_name,
              mime: f.mime_type,
              url: signed.get(f.id) ?? null,
            })),
        }),
      ),
    extensions: (exts ?? []).filter((e: { card_id: string }) => e.card_id === a.id),
  }));
}

/** Garante que a ação pertence ao representante e já foi enviada a ele. */
export async function ownedAction(rep: PortalRep, cardId: string) {
  const actions = await listActionsForRep(rep.id, { includeDone: true });
  const card = actions.find((a) => a.id === cardId && a.acceptance !== "nao_enviada");
  if (!card) throw new Error("Ação não encontrada.");
  return card;
}

export async function recordRepUpdate(args: {
  rep: PortalRep;
  cardId: string;
  status?: ActionStatus | null;
  note?: string | null;
  files: { path: string; name: string; mime?: string | null; size?: number | null }[];
}) {
  const { rep, cardId } = args;
  const card = await ownedAction(rep, cardId);
  if (card.acceptance !== "aceita")
    throw new Error("Aceite a sugestão antes de registrar andamento.");
  const note = args.note?.trim() || null;
  const files = args.files.filter((f) => f.path.startsWith(`${cardId}/`));
  const statusChanged = args.status && args.status !== card.status;
  if (!note && !files.length && !statusChanged) throw new Error("Nada para registrar.");

  const { data: upd, error } = await admin
    .from("kanban_action_updates")
    .insert({
      card_id: cardId,
      source: "representante",
      author_name: rep.nome,
      status: args.status ?? null,
      note,
    })
    .select("id")
    .single();
  if (error) throw new Error("Falha ao salvar a atualização.");
  if (statusChanged) {
    await admin.from("kanban_action_tracking").upsert({
      card_id: cardId,
      status: args.status,
      updated_at: new Date().toISOString(),
      updated_by_name: rep.nome,
    });
  }
  if (files.length) {
    await admin.from("kanban_action_update_files").insert(
      files.map((f) => ({
        update_id: upd.id,
        card_id: cardId,
        storage_path: f.path,
        file_name: f.name,
        mime_type: f.mime ?? null,
        size_bytes: f.size ?? null,
      })),
    );
  }
  const meta = readActionMeta(card.metadata);
  const { data: created } = await admin
    .from("kanban_cards")
    .select("created_by")
    .eq("id", cardId)
    .maybeSingle();
  const labels: Record<ActionStatus, string> = {
    nao_iniciado: "Não iniciado",
    em_andamento: "Em andamento",
    concluido: "Concluído",
  };
  await notifySubmission({
    submissionId: crypto.randomUUID(),
    repName: rep.nome,
    repEmail: null,
    items: [
      {
        cardId,
        title: card.title,
        client: meta.client_name,
        statusLabel: labels[args.status ?? card.status],
        note: note ?? undefined,
        pendencias: [],
        files: files.length,
        responsibleId: meta.responsible_id,
        createdBy: created?.created_by ?? undefined,
      },
    ],
  });
}

export async function recordExtensionRequest(args: {
  rep: PortalRep;
  cardId: string;
  requestedDue: string;
  justification: string;
}) {
  const { rep, cardId } = args;
  const card = await ownedAction(rep, cardId);
  if (card.status === "concluido") throw new Error("A ação já foi concluída.");
  const { data: pending } = await admin
    .from("kanban_action_extension_requests")
    .select("id")
    .eq("card_id", cardId)
    .eq("status", "pendente")
    .maybeSingle();
  if (pending) throw new Error("Já existe um pedido de prorrogação aguardando resposta.");

  const { error } = await admin.from("kanban_action_extension_requests").insert({
    card_id: cardId,
    representative_id: rep.id,
    current_due: card.due_date ? card.due_date.slice(0, 10) : null,
    requested_due: args.requestedDue,
    justification: args.justification.trim(),
  });
  if (error) throw new Error("Falha ao registrar o pedido de prorrogação.");

  const label = `Prorrogação solicitada para ${formatPrazo(args.requestedDue)}`;
  await admin.from("kanban_action_updates").insert({
    card_id: cardId,
    source: "representante",
    author_name: rep.nome,
    note: `${label}: ${args.justification.trim()}`,
  });
  const meta = readActionMeta(card.metadata);
  const { data: created } = await admin
    .from("kanban_cards")
    .select("created_by")
    .eq("id", cardId)
    .maybeSingle();
  await notifySubmission({
    submissionId: crypto.randomUUID(),
    repName: rep.nome,
    repEmail: null,
    items: [
      {
        cardId,
        title: card.title,
        client: meta.client_name,
        statusLabel: label,
        note: args.justification.trim(),
        pendencias: [],
        files: 0,
        responsibleId: meta.responsible_id,
        createdBy: created?.created_by ?? undefined,
      },
    ],
  });
}

type RepRecord = { id: string; nome: string; email: string | null; user_id: string | null };

async function loadRep(repId: string): Promise<RepRecord> {
  const { data: rep } = await admin
    .from("representatives")
    .select("id, nome, email, user_id")
    .eq("id", repId)
    .maybeSingle();
  if (!rep) throw new Error("Representante não encontrado.");
  return rep as RepRecord;
}

/**
 * Garante o usuário (externo) do representante. Sem usuário: cria, vincula e devolve o link de
 * primeiro acesso (definir senha). Com usuário: só devolve o id.
 */
async function ensureRepUser(
  rep: RepRecord,
): Promise<{ uid: string; email: string; created: boolean; senhaUrl: string | null }> {
  const email = String(rep.email ?? "")
    .trim()
    .toLowerCase();
  if (!email) throw new Error("Cadastre o e-mail do representante primeiro.");
  if (rep.user_id) {
    // Além do status do perfil, cobre contas legadas marcadas como ativas pelo trigger padrão,
    // mas que ainda nunca cadastraram senha nem entraram no portal.
    const [{ data: prof, error: profErr }, { data: authData, error: authErr }] = await Promise.all([
      admin.from("profiles").select("status").eq("id", rep.user_id).maybeSingle(),
      admin.auth.admin.getUserById(rep.user_id),
    ]);
    if (profErr || authErr || !authData?.user) {
      throw new Error("Não foi possível verificar o acesso do representante.");
    }
    const pendente = needsRepFirstAccess({
      profileStatus: prof?.status,
      mustChangePassword: authData.user.user_metadata?.must_change_password,
      lastSignInAt: authData.user.last_sign_in_at,
    });
    return {
      uid: rep.user_id,
      email,
      created: false,
      senhaUrl: pendente ? await firstAccessLink(rep.user_id) : null,
    };
  }

  // Não reaproveita conta existente: evitaria transformar um usuário interno em "externo".
  const { data: u, error } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { full_name: rep.nome, must_change_password: true },
  });
  if (error) {
    if (/already|registered|exists/i.test(error.message))
      throw new Error("Já existe um usuário com este e-mail. Use outro e-mail para o portal.");
    throw new Error(error.message);
  }
  const uid: string | null = u?.user?.id ?? null;
  if (!uid) throw new Error("Falha ao criar o usuário.");
  // Vínculo ANTES de qualquer outra coisa: ativa a blindagem do banco para esse usuário.
  const { error: linkErr } = await admin
    .from("representatives")
    .update({ user_id: uid })
    .eq("id", rep.id);
  if (linkErr) {
    await admin.auth.admin.deleteUser(uid);
    throw new Error("Falha ao vincular o usuário ao representante.");
  }
  await admin
    .from("profiles")
    .upsert({ id: uid, email, full_name: rep.nome, status: "pendente" }, { onConflict: "id" });
  await admin.from("user_roles").delete().eq("user_id", uid);
  await admin.from("user_roles").insert({ user_id: uid, role: "representante" });
  return { uid, email, created: true, senhaUrl: await firstAccessLink(uid) };
}

async function firstAccessLink(uid: string): Promise<string> {
  const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
  const { error: tokErr } = await admin.from("first_access_tokens").insert({ user_id: uid, token });
  if (tokErr) throw new Error("Falha ao gerar o convite.");
  return `${origin()}/definir-senha?t=${token}`;
}

/** Cria (ou reaproveita) o usuário do representante e envia o convite para definir a senha. */
export async function provisionRepAccess(
  repId: string,
): Promise<{ email: string; created: boolean }> {
  const rep = await loadRep(repId);
  const user = await ensureRepUser(rep);
  const link = user.senhaUrl ?? (await firstAccessLink(user.uid));
  const res = await sendSystemEmail({
    templateName: "rep-portal-boas-vindas",
    to: user.email,
    idempotencyKey: `rep-portal-${user.uid}-${Date.now()}`,
    templateData: { name: rep.nome, link, portalUrl: `${origin()}/portal-rep` },
  });
  if (!res.sent) throw new Error(`Convite não enviado (${res.reason ?? "erro"}).`);
  return { email: user.email, created: user.created };
}

/**
 * Convite para revisar as metas de um cliente (linha de Performance). Quem chama já conferiu
 * que o usuário é gestão da empresa da linha. Primeiro acesso: cria o usuário e inclui o link
 * para definir a senha.
 */
export async function inviteRepToMetasRow(
  rowId: string,
  mensagem: string,
): Promise<{ email: string; incluiLinkSenha: boolean }> {
  const { data: row } = await admin
    .from("rep_performance_rows")
    .select("razao_social, rep_performance_uploads!inner(representative_id)")
    .eq("id", rowId)
    .maybeSingle();
  const repId = row?.rep_performance_uploads?.representative_id as string | undefined;
  if (!row || !repId) throw new Error("Cliente não encontrado.");
  const rep = await loadRep(repId);
  const user = await ensureRepUser(rep);
  // O convite pode ser aberto em um navegador com uma sessão interna já ativa. Um link novo de
  // senha garante que o destinatário assuma a conta correta antes de entrar nas metas.
  const senhaUrl = user.senhaUrl ?? (await firstAccessLink(user.uid));
  const res = await sendSystemEmail({
    templateName: "metas-convite",
    to: user.email,
    idempotencyKey: `metas-convite-${rowId}-${user.uid}-${Date.now()}`,
    templateData: {
      name: rep.nome,
      cliente: String(row.razao_social ?? "").trim(),
      mensagem: mensagem.trim(),
      metasUrl: `${origin()}/portal-rep/metas/${rowId}`,
      senhaUrl,
    },
  });
  if (!res.sent) throw new Error(`Convite não enviado (${res.reason ?? "erro"}).`);
  return { email: user.email, incluiLinkSenha: true };
}

export type RepMetasRow = { rowId: string; cliente: string; periodo: string | null };

/**
 * Clientes da carteira do representante que têm ciclo de metas, apontando para a linha do
 * upload vigente mais recente de cada cliente.
 */
export async function listRepMetasRows(repId: string): Promise<RepMetasRow[]> {
  const { data: cycles } = await admin
    .from("performance_goal_cycles")
    .select("cliente_key")
    .eq("representative_id", repId);
  const keys = new Set<string>((cycles ?? []).map((c: { cliente_key: string }) => c.cliente_key));
  if (keys.size === 0) return [];
  const { data: rows } = await admin
    .from("rep_performance_rows")
    .select(
      "id, razao_social, rep_performance_uploads!inner(representative_id, substituida_em, periodo_label, periodo_inicio, created_at)",
    )
    .eq("rep_performance_uploads.representative_id", repId)
    .is("rep_performance_uploads.substituida_em", null);
  type Row = {
    id: string;
    razao_social: string;
    rep_performance_uploads: {
      periodo_label: string | null;
      periodo_inicio: string | null;
      created_at: string;
    };
  };
  const best = new Map<string, Row>();
  const ordem = (r: Row) =>
    `${r.rep_performance_uploads.periodo_inicio ?? ""}|${r.rep_performance_uploads.created_at}`;
  for (const r of (rows ?? []) as Row[]) {
    const key = r.razao_social.trim().toUpperCase();
    if (!keys.has(key)) continue;
    const cur = best.get(key);
    if (!cur || ordem(r) > ordem(cur)) best.set(key, r);
  }
  return [...best.values()]
    .map((r) => ({
      rowId: r.id,
      cliente: r.razao_social.trim(),
      periodo: r.rep_performance_uploads.periodo_label,
    }))
    .sort((a, b) => a.cliente.localeCompare(b.cliente, "pt-BR"));
}
