import { readFileSync, writeFileSync } from "node:fs";
import { matchRepresentativeId } from "@/lib/visao-rep";
const reps = JSON.parse(process.env.REPS!);
const companyId = process.env.CID!;
const rows = JSON.parse(readFileSync("/tmp/vr2/reports.json", "utf8"));
const now = new Date().toISOString();
const esc = (s: string | null) => (s == null ? "null" : `'${s.replace(/'/g, "''")}'`);
rows.forEach((r: any, i: number) => {
  const repId = matchRepresentativeId(r.name, reps);
  const data = { ...r.data, metadata: { ...r.data.metadata, representative_id: repId, source_file_name: r.file, created_at: now, updated_at: now }, source_control: { ...r.data.source_control, creation_mode: r.creation_mode, source_file: r.file, schema_version: r.schema_version, import_date: now, last_update: now, content_hash: r.hash } };
  const sql = `delete from public.visao_rep_reports where ${repId ? `representative_id = '${repId}' or ` : ""}lower(trim(representative_name)) = lower(trim(${esc(r.name)}));
insert into public.visao_rep_reports (company_id, representative_id, representative_name, region, creation_mode, schema_version, titulo, data, source_file_name, content_hash, import_date)
values (${esc(companyId)}, ${repId ? esc(repId) : "null"}, ${esc(r.name)}, ${esc(r.region)}, ${esc(r.creation_mode)}, ${esc(r.schema_version)}, ${esc(r.titulo)}, ${esc(JSON.stringify(data))}::jsonb, ${esc(r.file)}, ${esc(r.hash)}, now());`;
  writeFileSync(`/tmp/vr2/insert-${i}.sql`, sql);
  console.log(i, r.name, repId, sql.length);
});
