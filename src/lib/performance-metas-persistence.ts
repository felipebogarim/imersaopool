// Camada de gravação do módulo Performance → METAS.
//
// ESTADO ATUAL: adaptador local. O payload é montado e validado, mas nada é
// gravado no banco — as tabelas ainda dependem de migration a ser autorizada
// (ver docs/performance-metas-persistencia-plano.md). Quando a migration for
// aplicada, esta função passa a chamar as server functions de gravação,
// sem alterar a tela.

import type { SavePayload } from "./performance-metas";

export type PersistResult = { mode: "local" | "database"; saved: number };

export async function persistMetasDraft(payload: SavePayload): Promise<PersistResult> {
  const saved = payload.perfil === "gestor" ? payload.metas.length : payload.sugestoes.length;
  return { mode: "local", saved };
}
