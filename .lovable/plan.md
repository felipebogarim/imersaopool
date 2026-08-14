# Plano de Implementação: Painel de Membros do Board e Exportação de Ações

Este plano descreve a implementação de um novo Painel de Membros no topo de cada board do Kanban, permitindo visualizar membros vinculados a ações e exportar seus desempenhos em PDF ou painéis visuais.

## Mudanças Propostas

### 1. Componente de Diálogo de Membros do Board (`src/components/kanban/BoardMembersListDialog.tsx`)
- Criar um novo componente para listar os membros do board.
- Buscar todos os perfis e representantes vinculados a cards no board atual (via `kanban_card_members` e metadados de cards).
- Exibir cada membro com um menu (kebab) contendo:
  - **Painél de Ações**: Abre uma visão filtrada das ações do membro (estilo Mapa de Ações).
  - **Compartilhar painél**: Gera PDF e oferece compartilhamento via WhatsApp/E-mail.
  - **Baixar pdf**: Download direto do PDF.

### 2. Painel Visual de Ações (`src/components/kanban/MemberActionsPanel.tsx`)
- Implementar uma visão de "Mapa de Ações" para um membro específico.
- Reutilizar a lógica de filtros do Mapa de Preços/Ações, mas focada apenas nos cards vinculados ao membro.
- Exibir cards em formato de lista/tabela sem ações de edição, focada em visualização e transparência.

### 3. Exportação de PDF e Farol de Evolução (`src/lib/kanban-member-pdf.ts`)
- Criar biblioteca para gerar um PDF visualmente atraente.
- Implementar o "Farol de Evolução": indicadores de progresso baseados no status dos cards vinculados ao membro.
- Excluir automaticamente ações já concluídas do relatório.
- Integrar com `window.open` para compartilhamento via WhatsApp (`https://wa.me/`) ou `mailto:`.

### 4. Integração na Página do Board (`src/routes/_authenticated/tarefas.b.$boardId.tsx`)
- Adicionar o botão "Membros" no cabeçalho do board.
- Integrar o novo diálogo `BoardMembersListDialog`.

## Detalhes Técnicos
- **Consultas**: Otimizar a busca de membros únicos vinculados a cards no board para evitar redundância.
- **PDF**: Utilizar `jspdf` e `jspdf-autotable` seguindo a paleta de cores e tipografia da Newline (fundo azul-claro, cartões arredondados).
- **Compartilhamento**: Gerar link de WhatsApp formatado com mensagem personalizada e, se possível, instrução para anexar o PDF.

## User Review Required
- A cor e o estilo do "Farol de Evolução" no PDF devem seguir exatamente o padrão `FAROL_CELL_CLASS` definido no sistema?
- O botão "Membros" deve substituir o atual "Membros do Workspace" ou coexistir com ele (um sendo para gestão de acesso e outro para gestão de execução)?
