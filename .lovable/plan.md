# Plano de Verificação e Sincronização de Interface

O usuário relatou que não está visualizando as atualizações solicitadas anteriormente (como a substituição de ícones por logos em blocos específicos). Este plano visa diagnosticar e garantir que todas as alterações visuais foram aplicadas corretamente nos componentes correspondentes e que a interface reflete os dados mais recentes.

## Passos de Diagnóstico e Correção

1. **Verificação de Assets e Branding**
   - Confirmar se os arquivos de manifesto de assets (`.asset.json`) para os logos (PoolFlow, Jornada de Produtos, GrowUp Saúde) estão presentes e apontam para as URLs corretas.
   - Validar se o componente `src/components/Brand.tsx` está exportando corretamente os componentes de logo com os assets certos.

2. **Revisão da Página Home (`src/routes/_authenticated/home.tsx`)**
   - Verificar se os blocos de "Marketing", "Produtos" e "Performance" na Home estão utilizando os novos componentes de logo em vez dos ícones da `lucide-react`.
   - Garantir que o título principal ("Dados e tomada de decisão.") e outros rótulos de seção foram atualizados conforme solicitado.

3. **Revisão do Guia Gerencial (`src/components/guia/GuiaGerencial.tsx`)**
   - Garantir que a trilha visual (`TrilhaFluida`) e os detalhes de etapa (`EtapaDetalhe`) utilizam os logos específicos para as etapas de Performance, Visões Consolidadas e Tarefas.
   - Verificar se o mapeamento de ícones na trilha mobile também reflete essas mudanças.

4. **Gestão de Tarefas/Kanban (`src/routes/_authenticated/tarefas.index.tsx`)**
   - Validar se os cabeçalhos de workspaces que mencionam "Marketing", "Flow" ou "Jornada de Produtos" renderizam automaticamente os logos correspondentes.

5. **Verificação de Cache e Build**
   - Se os arquivos estiverem corretos, orientar o usuário a limpar o cache do navegador ou forçar um recarregamento da página (`Ctrl+F5`).

## Detalhes Técnicos

- **Logos afetados:**
  - `GrowUpSaudeLogo` para Performance.
  - `JornadaProdutosLogo` para Jornada de Produtos/Visões Consolidadas.
  - `PoolFlowLogo` para Marketing/CRM/Tarefas.
- **Arquivos principais:** `src/components/Brand.tsx`, `src/routes/_authenticated/home.tsx`, `src/components/guia/GuiaGerencial.tsx`, `src/routes/_authenticated/tarefas.index.tsx`.
