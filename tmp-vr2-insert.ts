import { readFileSync } from "node:fs";
import { matchRepresentativeId } from "@/lib/visao-rep";
import { execFileSync } from "node:child_process";

const q = (sql: string) => execFileSync("psql", [process.env.DATABASE_URL ?? "", "-At", "-c", sql]).toString().trim();

const reps = q("select id||'|'||nome from representatives")
  .split("\n").filter(Boolean).map(l => { const [id, ...n] = l.split("|"); return { id, nome: n.join("|") }; });
const companyId = q("select company_id from representatives where company_id is not null limit 1");

const rows = JSON.parse(readFileSync("/tmp/vr2/reports.json", "utf8"));
const now = new Date().toISOString();
const esc = (s: string | null) => (s == null ? "null" : `'${s.replace(/'/g, "''")}'`);

for (const r of rows) {
  const repId = matchRepresentativeId(r.name, reps);
  const data = { ...r.data, metadata: { ...r.data.metadata, representative_id: repId, source_file_name: r.file, created_at: now, updated_at: now }, source_control: { ...r.data.source_control, creation_mode: r.creation_mode, source_file: r.file, schema_version: r.schema_version, import_date: now, last_update: now, content_hash: r.hash } };
  const del = repId
    ? `delete from visao_rep_reports where representative_id = '${repId}' or lower(trim(representative_name)) = lower(trim(${esc(r.name)}));`
    : `delete from visao_rep_reports where lower(trim(representative_name)) = lower(trim(${esc(r.name)}));`;
  const ins = `insert into visao_rep_reports (company_id, representative_id, representative_name, region, creation_mode, schema_version, titulo, data, source_file_name, content_hash, import_date) values (${companyId ? esc(companyId) : "null"}, ${repId ? esc(repId) : "null"}, ${esc(r.name)}, ${esc(r.region)}, ${esc(r.creation_mode)}, ${esc(r.schema_version)}, ${esc(r.titulo)}, ${esc(JSON.stringify(data))}::jsonb, ${esc(r.file)}, ${esc(r.hash)}, now());`;
  q(`begin; ${del} ${ins} commit;`);
  console.log(`${r.name} -> rep_id=${repId ?? "SEM VÍNCULO"}`);
}
console.log(q("select representative_name||' | '||coalesce(representative_id::text,'-')||' | '||schema_version from visao_rep_reports order by representative_name"));
