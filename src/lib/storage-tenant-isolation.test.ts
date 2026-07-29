/**
 * Testes de isolamento entre empresas (multi-tenant) para o Storage.
 *
 * Objetivo: garantir, de forma automatizada e repetível, que a LISTAGEM e o
 * DOWNLOAD de arquivos nunca devolvam metadados (nome, tamanho, mimetype,
 * caminho) de arquivos pertencentes a outra empresa/usuário.
 *
 * Estes testes leem diretamente o catálogo do banco (políticas de RLS,
 * definição das funções e permissões de execução) e falham quando alguma
 * regra de isolamento é afrouxada por uma migração futura.
 *
 * Rodam apenas quando há conexão com o banco (variável PGHOST presente).
 */
import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const hasDb = Boolean(process.env.PGHOST);

function q<T = Record<string, unknown>>(sql: string): T[] {
  const wrapped = `SELECT coalesce(json_agg(t), '[]'::json)::text FROM (${sql}) t;`;
  const out = execFileSync("psql", ["-At", "-c", wrapped], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  return JSON.parse(out.trim()) as T[];
}

/** Expressões aceitas como "escopo de tenant/dono" numa política de storage. */
const TENANT_SCOPES = [
  "current_company_id()",
  "auth.uid()",
  "kanban_can_access_board",
  "is_admin_or_gestor",
];

describe.skipIf(!hasDb)("storage: isolamento de metadados entre empresas", () => {
  it("mantém RLS habilitado em storage.objects", () => {
    const [row] = q<{ relrowsecurity: boolean; relforcerowsecurity: boolean }>(
      `SELECT c.relrowsecurity, c.relforcerowsecurity
         FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'storage' AND c.relname = 'objects'`,
    );
    expect(row?.relrowsecurity).toBe(true);
  });

  it("não expõe nenhum bucket publicamente", () => {
    const publicos = q<{ id: string }>(`SELECT id FROM storage.buckets WHERE public`);
    expect(publicos.map((b) => b.id)).toEqual([]);
  });

  it("toda política de leitura de arquivos é limitada a empresa/dono", () => {
    const policies = q<{ policyname: string; roles: string; qual: string | null }>(
      `SELECT policyname, roles::text AS roles, qual
         FROM pg_policies
        WHERE schemaname = 'storage' AND tablename = 'objects'
          AND cmd IN ('SELECT', 'ALL')`,
    );
    expect(policies.length).toBeGreaterThan(0);

    for (const p of policies) {
      const qual = (p.qual ?? "").trim();
      // Uma política sem condição (ou com "true") liberaria metadados de todos os tenants.
      expect(qual, `política "${p.policyname}" sem condição de escopo`).not.toBe("");
      expect(qual.toLowerCase(), `política "${p.policyname}" é irrestrita`).not.toBe("true");
      expect(
        TENANT_SCOPES.some((s) => qual.includes(s)),
        `política "${p.policyname}" não usa nenhum escopo de empresa/dono: ${qual}`,
      ).toBe(true);
      // Leitura de arquivos nunca pode alcançar visitantes anônimos.
      expect(p.roles, `política "${p.policyname}" alcança anon/public`).not.toMatch(
        /\banon\b|\{public\}/,
      );
    }
  });

  it("todo bucket existente possui ao menos uma política de leitura", () => {
    const semPolitica = q<{ id: string }>(
      `SELECT b.id
         FROM storage.buckets b
        WHERE b.id <> 'backups'
          AND NOT EXISTS (
            SELECT 1 FROM pg_policies p
             WHERE p.schemaname = 'storage' AND p.tablename = 'objects'
               AND p.cmd IN ('SELECT','ALL')
               AND p.qual LIKE '%' || b.id || '%'
          )`,
    );
    expect(semPolitica.map((b) => b.id)).toEqual([]);
  });
});

describe.skipIf(!hasDb)("list_storage_objects: listagem restrita", () => {
  const [fn] = hasDb
    ? q<{ def: string }>(
        `SELECT pg_get_functiondef(p.oid) AS def
           FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
          WHERE n.nspname = 'public' AND p.proname = 'list_storage_objects'`,
      )
    : [{ def: "" }];

  it("exige perfil administrativo (ou chamada de serviço) antes de listar", () => {
    expect(fn?.def).toBeTruthy();
    expect(fn.def).toMatch(/has_role\s*\(\s*auth\.uid\(\)\s*,\s*'admin'/);
    expect(fn.def).toMatch(/RAISE EXCEPTION/i);
  });

  it("nunca inclui o bucket de backups no resultado", () => {
    expect(fn.def).toMatch(/bucket_id\s*<>\s*'backups'/);
  });

  it("não é executável por visitantes anônimos", () => {
    const [row] = q<{ anon: boolean; pub: boolean }>(
      `SELECT has_function_privilege('anon', p.oid, 'execute') AS anon,
              has_function_privilege('public', p.oid, 'execute') AS pub
         FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'list_storage_objects'`,
    );
    expect(row.anon).toBe(false);
    expect(row.pub).toBe(false);
  });
});

describe.skipIf(!hasDb)("funções que tocam metadados de arquivos", () => {
  it("nenhuma função SECURITY DEFINER lê storage.objects sem checagem de acesso", () => {
    const fns = q<{ proname: string; def: string }>(
      `SELECT p.proname, pg_get_functiondef(p.oid) AS def
         FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.prosecdef
          AND pg_get_functiondef(p.oid) ILIKE '%storage.objects%'`,
    );
    for (const f of fns) {
      expect(
        /has_role|current_company_id|auth\.uid\(\)|service_role/.test(f.def),
        `função ${f.proname} lê storage.objects sem checagem de acesso`,
      ).toBe(true);
    }
  });
});
