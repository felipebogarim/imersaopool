import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CONTEXT_LIMITS = {
  "ai/PROJECT_BRAIN.md": 300,
  "ai/AGENT_INSTRUCTIONS.md": 200,
  "ai/TASK_TEMPLATE.md": 180,
};

let failed = false;
for (const [file, limit] of Object.entries(CONTEXT_LIMITS)) {
  try {
    const content = readFileSync(resolve(root, file), "utf8");
    const lines = content === "" ? 0 : content.split(/\r?\n/).length - Number(content.endsWith("\n"));
    const ok = lines <= limit;
    console.log(`${file}: ${lines}/${limit} lines — ${ok ? "OK" : "FAIL"}`);
    failed ||= !ok;
  } catch (error) {
    console.error(`${file}: FAIL (${error.code === "ENOENT" ? "missing file" : error.message})`);
    failed = true;
  }
}

if (failed) {
  console.error("Compact current context and move historical details to docs/development.");
  process.exitCode = 1;
}
