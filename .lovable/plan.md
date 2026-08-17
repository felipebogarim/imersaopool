# Plan: Ajustar cores dos ícones para Amarelo

O objetivo é alterar a cor dos ícones principais na Home e no Guia Gerencial de branco/padrão para o amarelo da marca (`text-nl-gold` ou `text-primary` dependendo do contexto do componente).

## Alterações

### 1. Home
- Localizar os ícones nos cards de "Performance", "Imersões" e "Preços".
- Garantir que todos utilizem a cor amarela (`text-nl-gold`). O ícone de "Preços" já possui essa cor, aplicarei aos demais para consistência.

### 2. Guia Gerencial
- No componente `TrilhaFluida` e `EtapaDetalhe`, alterar a cor dos ícones (BarChart3, TrendingUp, etc.) para amarelo quando não estiverem ativos/selecionados (atualmente são `text-muted-foreground` ou branco).
- Nos blocos de conteúdo ("O que você encontrará", etc.), alterar `text-primary` (que é azul no tema base) para uma cor que reflita o amarelo solicitado (`text-nl-gold`).

## Detalhes Técnicos

- **Home (`src/routes/_authenticated/home.tsx`)**:
  - Remover a condicional `group.title === "Preços" ? "text-nl-gold" : ""` no mapeamento dos ícones e aplicar `text-nl-gold` a todos.

- **Guia Gerencial (`src/components/guia/GuiaGerencial.tsx`)**:
  - Atualizar as classes de cor nos componentes `TrilhaFluida` e `EtapaDetalhe`.
  - Revisar o uso de `text-primary` em `Bloco` e outros elementos de ícone para garantir o tom amarelo.

## Validação
- Abrir a Home e o Guia Gerencial no preview.
- Confirmar visualmente que os ícones estão amarelos e possuem boa legibilidade contra o fundo escuro/claro.