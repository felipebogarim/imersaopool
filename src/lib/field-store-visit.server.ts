// Aplicação do modelo canônico field_immersion_v2 nos capítulos da sessão.
// Nenhuma IA envolvida: o texto é copiado verbatim.
import type { parseFieldStoreVisit as ParseFn, FieldImmersionChapter } from "@/lib/field-store-visit";

function norm(s: string) {
  return String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export async function ingestStoreVisit(args: {
  supabase: any;
  userId: string;
  sessaoId: string;
  filename: string;
  text: string;
  dryRun: boolean;
  parse: typeof ParseFn;
}) {
  const { supabase, sessaoId, filename, text, dryRun, parse, userId } = args;

  const { doc, errors, detected_version, warnings } = parse(text);
  if (!doc) {
    const err: any = new Error(errors[0] ?? "Documento fora do padrão esperado.");
    err.details = errors;
    throw err;
  }

  const { data: interview, error: iErr } = await supabase
    .from("interviews")
    .select("id, roteiro_id, respostas")
    .eq("id", sessaoId)
    .maybeSingle();
  if (iErr) throw new Error(iErr.message);
  if (!interview?.roteiro_id) throw new Error("Sessão sem roteiro vinculado");

  const { data: capitulos, error: cErr } = await supabase
    .from("capitulos")
    .select("id, codigo, titulo, ordem")
    .eq("roteiro_id", interview.roteiro_id)
    .order("ordem");
  if (cErr) throw new Error(cErr.message);
  if (!capitulos?.length) throw new Error("Roteiro sem capítulos");

  const byOrdem = new Map<number, any>();
  const byTitulo = new Map<string, any>();
  const byCodigo = new Map<string, any>();
  for (const c of capitulos as any[]) {
    if (c.ordem != null) byOrdem.set(Number(c.ordem), c);
    byTitulo.set(norm(c.titulo), c);
    byCodigo.set(norm(c.codigo), c);
  }

  const preview = doc.chapters.map((c) => ({
    ordem: c.ordem,
    codigo: c.codigo,
    titulo: c.titulo,
    key: c.key,
    chars: c.markdown.length,
  }));

  if (dryRun) {
    return {
      template: doc.meta["report_template"] || "field_immersion_v2",
      dryRun: true,
      meta: doc.meta,
      preview,
      filled: 0,
      total: capitulos.length,
      unmatched: [] as string[],
      warnings,
    };
  }

  let filled = 0;
  const unmatched: string[] = [];

  for (const p of doc.chapters) {
    // Mapeamento robusto por código (C1, C2...) primeiro.
    let cap = byCodigo.get(norm(p.codigo)) ?? null;
    
    // Fallback para ordem ou título (legado)
    if (!cap) cap = byOrdem.get(p.ordem) ?? byTitulo.get(norm(p.titulo)) ?? null;
    
    if (!cap) {
      unmatched.push(`${p.codigo} — ${p.titulo}`);
      continue;
    }

    const { data: existing } = await supabase
      .from("sessao_capitulos")
      .select("id, sintese")
      .eq("sessao_id", interview.id)
      .eq("capitulo_id", cap.id)
      .maybeSingle();

    const sintese = {
      ...((existing?.sintese as Record<string, unknown>) ?? {}),
      __report_template__: doc.meta["report_template"],
      __markdown__: true,
      __arquivo__: filename,
      __chapter_key__: p.key,
      __chapter_titulo__: p.titulo,
      __chapter_codigo__: p.codigo,
    };

    const payload: any = {
      sessao_id: interview.id,
      capitulo_id: cap.id,
      leitura_estrategica: p.markdown,
      sintese,
      origem: "final",
      status_revisao: "revisado",
    };

    if (existing?.id) {
      await supabase.from("sessao_capitulos").update(payload).eq("id", existing.id);
    } else {
      await supabase.from("sessao_capitulos").insert(payload);
    }
    filled++;
  }

  const prevRespostas = (interview.respostas ?? {}) as Record<string, any>;
  const nextRespostas: Record<string, any> = {
    ...prevRespostas,
    __field_store_visit__: {
      schema_version: doc.meta["schema_version"] ?? "2.0",
      report_template: doc.meta["report_template"] ?? "field_immersion_v2",
      tipo_relatorio: doc.meta["tipo_relatorio"] || "visita_loja",
      meta: doc.meta,
      arquivo: filename,
      importado_por: userId,
      importado_em: new Date().toISOString(),
    },
  };
  
  // No V2, o sumário executivo está em C1 ou é extraído de metadados?
  // Na verdade, o sumário executivo agora deve ser parte do conteúdo de C1 se vier do arquivo.
  
  await supabase.from("interviews").update({ respostas: nextRespostas }).eq("id", interview.id);

  return {
    template: doc.meta["report_template"] || "field_immersion_v2",
    dryRun: false,
    meta: doc.meta,
    preview,
    filled,
    total: capitulos.length,
    unmatched,
    warnings,
  };
}
