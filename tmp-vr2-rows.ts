import { readFileSync, writeFileSync } from "node:fs";
import { matchRepresentativeId } from "@/lib/visao-rep";
const reps = JSON.parse(process.env.REPS!);
const companyId = process.env.CID!;
const now = new Date().toISOString();
const rows = JSON.parse(readFileSync("/tmp/vr2/reports.json","utf8")).map((r:any)=>{
  const repId = matchRepresentativeId(r.name, reps);
  const data = { ...r.data, metadata:{ ...r.data.metadata, representative_id: repId, source_file_name: r.file, created_at: now, updated_at: now }, source_control:{ ...r.data.source_control, creation_mode:r.creation_mode, source_file:r.file, schema_version:r.schema_version, import_date:now, last_update:now, content_hash:r.hash } };
  return { company_id: companyId, representative_id: repId, representative_name: r.name, region: r.region, creation_mode: r.creation_mode, schema_version: r.schema_version, titulo: r.titulo, data, source_file_name: r.file, content_hash: r.hash, import_date: now };
});
writeFileSync("/tmp/vr2/rows.json", JSON.stringify(rows));
