import { NAV_TREE, type NavGroup, type NavLeaf } from "@/lib/nav-tree";

/** Usuários que enxergam a Home 2 (oculta para os demais). */
export const HOME2_EMAILS = ["marcos@newline.ind.br"];

export function isHome2User(email?: string | null): boolean {
  return HOME2_EMAILS.includes((email ?? "").trim().toLowerCase());
}

export interface Home2Section {
  key: string;
  title: string;
  links: { key: string; label: string; to: string }[];
}

/**
 * Setores e itens da Home 2: só o que está liberado para o usuário (`can`), na ordem do menu.
 * Ignora a própria home, grupos de admin e itens exclusivos do gestor master.
 */
export function buildHome2Sections(
  can: (key: string) => boolean,
  isMaster = false,
  tree: NavGroup[] = NAV_TREE,
): Home2Section[] {
  const sections: Home2Section[] = [];
  for (const g of tree) {
    if (g.key === "home" || g.adminOnly) continue;
    const leaves: { key: string; label: string; to: string }[] =
      g.children.length > 0
        ? g.children
            .filter((c: NavLeaf) => can(c.key) && (!c.masterOnly || isMaster))
            .map((c) => ({ key: c.key, label: c.label, to: c.to }))
        : g.to && can(g.key)
          ? [{ key: g.key, label: g.label, to: g.to }]
          : [];
    if (leaves.length) sections.push({ key: g.key, title: g.label, links: leaves });
  }
  return sections;
}
