import { parseVisaoRepMarkdown, contentHash } from "@/lib/visao-rep2-markdown";
import { normalizeVisaoRep2 } from "@/lib/visao-rep2-schema";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const files = process.argv.slice(2);
mkdirSync("/tmp/vr2", { recursive: true });
const out: any[] = [];
for (const f of files) {
  const text = readFileSync(f, "utf8");
  const v = normalizeVisaoRep2(parseVisaoRepMarkdown(text));
  out.push({
    file: f.split("/").pop(),
    hash: await contentHash(text),
    name: v.metadata.representative_name,
    region: v.metadata.region,
    creation_mode: v.metadata.creation_mode,
    schema_version: v.metadata.schema_version,
    titulo: v.executive_view.central_thesis?.slice(0, 120) ?? null,
    positioning: (v as any).brand_positioning ?? null,
    data: v,
  });
}
writeFileSync("/tmp/vr2/reports.json", JSON.stringify(out));
console.log(out.map(o => [o.name, o.schema_version, o.data.perspectives.length, o.data.executive_view.priority_signals.length, o.positioning ? Object.keys(o.positioning).length : 0].join(" | ")).join("\n"));
