import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listarRepresentantes from "./tools/listar-representantes";
import performanceRepresentante from "./tools/performance-representante";
import buscarClientes from "./tools/buscar-clientes";
import listarQuadrosTarefas from "./tools/listar-quadros-tarefas";
import listarTarefas from "./tools/listar-tarefas";
import criarTarefa from "./tools/criar-tarefa";

const projectRef = import.meta.env['VITE_SUPABASE_PROJECT_ID'] ?? "project-ref-unset";

export default defineMcp({
  name: "imersao-comercial-pool",
  title: "Imersao Comercial Pool",
  version: "0.1.0",
  instructions:
    "Ferramentas do Imersão Comercial Pool (PoolFlux). Consulte representantes, performance ativa, clientes e quadros de Gestão de Tarefas, e crie tarefas. Todas as consultas respeitam as permissões do usuário conectado.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    listarRepresentantes,
    performanceRepresentante,
    buscarClientes,
    listarQuadrosTarefas,
    listarTarefas,
    criarTarefa,
  ],
});
