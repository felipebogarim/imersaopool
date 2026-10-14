import type { RepresentadaItem, ModeloNegocioRepresentada, RepStructure } from "./types";

export interface BrandLibraryItem {
  id: string;
  nome: string;
  logo_url?: string;
  segmento: string;
  modelo_negocio: ModeloNegocioRepresentada;
  canais: string[];
  abrangencia?: string;
  origem?: string;
}

const SHARED_BRAND_STORAGE_KEY = "rep_shared_brand_library";

// Logos padrão em SVG vetorial leve para as principais marcas do setor de iluminação
const SVG_NEWLINE = `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 60"><rect width="200" height="60" rx="8" fill="#ffffff"/><text x="100" y="38" font-family="system-ui, -apple-system, sans-serif" font-weight="800" font-size="26" text-anchor="middle" fill="#0084a8" letter-spacing="1">newline</text></svg>`
)}`;

const SVG_BRILIA = `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 60"><rect width="200" height="60" rx="8" fill="#ffffff"/><circle cx="38" cy="30" r="16" fill="#f97316"/><circle cx="38" cy="30" r="9" fill="#ffffff"/><text x="118" y="38" font-family="system-ui, -apple-system, sans-serif" font-weight="800" font-size="26" text-anchor="middle" fill="#1e293b" letter-spacing="0.5">brilia</text></svg>`
)}`;

const SVG_MISTER_LED = `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 60"><rect width="200" height="60" rx="8" fill="#ffffff"/><rect x="18" y="14" width="34" height="32" rx="4" fill="#ea580c"/><text x="35" y="36" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="14" text-anchor="middle" fill="#ffffff">ML</text><text x="122" y="33" font-family="system-ui, -apple-system, sans-serif" font-weight="800" font-size="19" text-anchor="middle" fill="#1e293b">MISTER LED</text><text x="122" y="46" font-family="system-ui, -apple-system, sans-serif" font-weight="600" font-size="9" text-anchor="middle" fill="#64748b" letter-spacing="2">ILUMINAÇÃO</text></svg>`
)}`;

const SVG_ALPERTONE = `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 60"><rect width="200" height="60" rx="8" fill="#ffffff"/><rect x="15" y="14" width="170" height="32" rx="6" fill="#dc2626"/><text x="100" y="36" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="20" text-anchor="middle" fill="#ffffff" letter-spacing="1">alpertone</text></svg>`
)}`;

const SVG_STELLA = `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 60"><rect width="200" height="60" rx="8" fill="#ffffff"/><text x="100" y="38" font-family="system-ui, -apple-system, sans-serif" font-weight="800" font-size="26" text-anchor="middle" fill="#0f172a" letter-spacing="2">STELLA</text></svg>`
)}`;

const SVG_INTERLIGHT = `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 60"><rect width="200" height="60" rx="8" fill="#ffffff"/><text x="100" y="38" font-family="system-ui, -apple-system, sans-serif" font-weight="800" font-size="23" text-anchor="middle" fill="#0284c7" letter-spacing="1">INTERLIGHT</text></svg>`
)}`;

/** Catálogo base de marcas de iluminação com logomarcas vetorizadas */
export const DEFAULT_BRAND_CATALOG: BrandLibraryItem[] = [
  {
    id: "lib-newline",
    nome: "Newline Iluminação",
    logo_url: SVG_NEWLINE,
    segmento: "Iluminação Técnica e Decorativa",
    modelo_negocio: "fabricante",
    canais: ["varejo", "distribuidores", "projetos"],
    abrangencia: "Integral (todos os estados)",
    origem: "Catálogo Oficial",
  },
  {
    id: "lib-brilia",
    nome: "Brilia",
    logo_url: SVG_BRILIA,
    segmento: "Iluminação LED e Lâmpadas",
    modelo_negocio: "importador",
    canais: ["varejo", "projetos"],
    abrangencia: "Integral",
    origem: "Catálogo Oficial",
  },
  {
    id: "lib-mister-led",
    nome: "Mister Led",
    logo_url: SVG_MISTER_LED,
    segmento: "Iluminação Técnica e Fitas LED",
    modelo_negocio: "fabricante",
    canais: ["varejo", "projetos", "venda_direta"],
    abrangencia: "Integral",
    origem: "Catálogo Oficial",
  },
  {
    id: "lib-alpertone",
    nome: "Alpertone",
    logo_url: SVG_ALPERTONE,
    segmento: "Iluminação Comercial e Industrial",
    modelo_negocio: "fabricante",
    canais: ["varejo", "projetos"],
    abrangencia: "Integral",
    origem: "Catálogo Oficial",
  },
  {
    id: "lib-stella",
    nome: "Stella Iluminação",
    logo_url: SVG_STELLA,
    segmento: "Iluminação Decorativa e Técnica",
    modelo_negocio: "importador",
    canais: ["varejo", "projetos"],
    abrangencia: "Integral",
    origem: "Catálogo Oficial",
  },
  {
    id: "lib-interlight",
    nome: "Interlight",
    logo_url: SVG_INTERLIGHT,
    segmento: "Iluminação Arquitetural",
    modelo_negocio: "fabricante",
    canais: ["projetos", "distribuidores"],
    abrangencia: "Integral",
    origem: "Catálogo Oficial",
  },
];

/** Normaliza o nome da marca para comparação e deduplicação */
export function normalizeBrandKey(name: string): string {
  return (name || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

/** Obtém as marcas salvas no LocalStorage compartilhado */
export function getSavedSharedBrands(): BrandLibraryItem[] {
  if (typeof window === "undefined" || typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(SHARED_BRAND_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Salva/atualiza uma marca na biblioteca compartilhada */
export function saveBrandToLibrary(
  brand: Partial<RepresentadaItem> & { nome: string },
  repNome?: string
): void {
  if (
    typeof window === "undefined" ||
    typeof localStorage === "undefined" ||
    !brand.nome?.trim()
  )
    return;

  try {
    const current = getSavedSharedBrands();
    const key = normalizeBrandKey(brand.nome);
    const existingIdx = current.findIndex((b) => normalizeBrandKey(b.nome) === key);

    const updatedItem: BrandLibraryItem = {
      id: brand.id || `lib-${Date.now()}`,
      nome: brand.nome.trim(),
      logo_url: brand.logo_url || (existingIdx >= 0 ? current[existingIdx].logo_url : undefined),
      segmento: brand.segmento || "Iluminação & Complementos",
      modelo_negocio: brand.modelo_negocio || "fabricante",
      canais: brand.canais && brand.canais.length > 0 ? brand.canais : ["varejo", "projetos"],
      abrangencia: brand.abrangencia || "Integral",
      origem: repNome ? `Cadastrado por ${repNome}` : "Biblioteca Compartilhada",
    };

    let nextList: BrandLibraryItem[];
    if (existingIdx >= 0) {
      // Se já existia, atualiza mas preserva logo_url se o novo não tiver
      const existing = current[existingIdx];
      nextList = [...current];
      nextList[existingIdx] = {
        ...existing,
        ...updatedItem,
        logo_url: updatedItem.logo_url || existing.logo_url,
      };
    } else {
      nextList = [updatedItem, ...current];
    }

    localStorage.setItem(SHARED_BRAND_STORAGE_KEY, JSON.stringify(nextList));
  } catch (err) {
    console.warn("[saveBrandToLibrary] Falha ao persistir na biblioteca compartilhada:", err);
  }
}

/**
 * Retorna a lista unificada de todas as marcas e logomarcas disponíveis:
 * Combina o catálogo padrão, as marcas salvas no LocalStorage compartilhado e
 * todas as marcas cadastradas em qualquer representante na aplicação.
 */
export function getSharedBrandLibrary(
  allStructures?: Record<string, RepStructure> | RepStructure[]
): BrandLibraryItem[] {
  const map = new Map<string, BrandLibraryItem>();

  // 1. Catálogo base padrão
  for (const item of DEFAULT_BRAND_CATALOG) {
    const key = normalizeBrandKey(item.nome);
    map.set(key, item);
  }

  // 2. Marcas salvas no LocalStorage compartilhado
  const saved = getSavedSharedBrands();
  for (const item of saved) {
    const key = normalizeBrandKey(item.nome);
    const existing = map.get(key);
    if (!existing) {
      map.set(key, item);
    } else {
      // Atualiza mantendo a melhor logo e dados
      map.set(key, {
        ...existing,
        ...item,
        logo_url: item.logo_url || existing.logo_url,
      });
    }
  }

  // 3. Marcas cadastradas em qualquer representante carregado
  if (allStructures) {
    const structList = Array.isArray(allStructures)
      ? allStructures
      : Object.values(allStructures);

    structList.forEach((struct) => {
      const repNome = struct.nome_representante || struct.empresa_representacao;
      (struct.marcas_representadas || []).forEach((m) => {
        if (!m.nome?.trim()) return;
        const key = normalizeBrandKey(m.nome);
        const existing = map.get(key);

        const libraryEntry: BrandLibraryItem = {
          id: m.id,
          nome: m.nome.trim(),
          logo_url: m.logo_url || existing?.logo_url,
          segmento: m.segmento || existing?.segmento || "Iluminação & Complementos",
          modelo_negocio: m.modelo_negocio || existing?.modelo_negocio || "fabricante",
          canais: m.canais && m.canais.length > 0 ? m.canais : existing?.canais || ["varejo"],
          abrangencia: m.abrangencia || existing?.abrangencia || "Integral",
          origem: repNome ? `Utilizada por ${repNome}` : "Cadastrada em representante",
        };

        if (!existing) {
          map.set(key, libraryEntry);
        } else {
          // Se o representante tem logo_url e o existente não tem, atualiza
          map.set(key, {
            ...existing,
            ...libraryEntry,
            logo_url: libraryEntry.logo_url || existing.logo_url,
          });
        }
      });
    });
  }

  // Converte para array
  const list = Array.from(map.values());

  // Ordena com Newline primeiro e as demais em ordem alfabética
  return list.sort((a, b) => {
    const aIsNewline = a.nome.toLowerCase().includes("newline");
    const bIsNewline = b.nome.toLowerCase().includes("newline");
    if (aIsNewline && !bIsNewline) return -1;
    if (!aIsNewline && bIsNewline) return 1;
    return a.nome.localeCompare(b.nome);
  });
}
