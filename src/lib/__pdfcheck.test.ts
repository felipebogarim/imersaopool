import { describe, it, expect, vi } from "vitest";
import fs from "node:fs";

const raw = JSON.parse(fs.readFileSync("/tmp/pdfchk/data.json", "utf8"));

function res(data: any) {
  const p: any = Promise.resolve({ data, error: null });
  const chain: any = new Proxy(p, {
    get(t, k) {
      if (k === "then" || k === "catch" || k === "finally") return (p as any)[k].bind(p);
      return () => chain;
    },
  });
  return chain;
}

vi.mock("@/lib/interview-cover", async (imp) => {
  const a: any = await imp();
  return { ...a, loadCoverImage: async () => "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==" };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getUser: async () => ({ data: { user: null } }) },
    from: (table: string) => {
      const map: Record<string, any> = {
        interviews: raw.interview,
        capitulos: raw.capitulos,
        sessao_capitulos: raw.respostas,
        session_notes: raw.notes,
        roteiros: raw.roteiro,
      };
      return res(map[table] ?? []);
    },
  },
}));

describe("interview pdf", () => {
  it("gera pdf", async () => {
    const { exportInterviewPdf } = await import("./interview-report");
    const saved: any[] = [];
    (globalThis as any).__saved = saved;
    const mod = await import("jspdf");
    const proto: any = (mod.default as any).prototype;
    proto.save = function (name: string) {
      fs.writeFileSync("/tmp/pdfchk/out.pdf", Buffer.from(this.output("arraybuffer")));
      saved.push(name);
    };
    await exportInterviewPdf(raw.interview.id);
    expect(fs.existsSync("/tmp/pdfchk/out.pdf")).toBe(true);
  }, 120000);
});
