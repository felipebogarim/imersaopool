# Trilha fluida no Guia de Uso Gerencial

Trocar o carrossel de cards com setas por uma timeline contínua e orgânica, onde as 8 etapas ficam ligadas por um traço único — sem "bloquinhos" separados — mantendo cada etapa clicável e abrindo o mesmo conteúdo detalhado de hoje.

## Como fica

- **Desktop**: um caminho horizontal levemente sinuoso atravessa a largura da página. Sobre ele, 8 nós circulares numerados, alternando o rótulo acima/abaixo da linha (efeito zig-zag), com título curto e uma linha de resumo.
- **Mobile/tablet**: o mesmo caminho vira vertical, com os nós alinhados à esquerda e o texto à direita — leitura natural sem rolagem lateral.
- **Estado ativo**: o trecho do caminho até a etapa selecionada fica preenchido no ciano da marca (progresso visual); o nó ativo cresce um pouco e ganha halo. Os demais ficam em neutro.
- **Hover**: o nó cresce sutilmente e o rótulo ganha contraste — sem sombra pesada nem card.
- **Sem setas de navegação e sem indicadores de bolinha** — a própria linha é a navegação.

## Comportamento

- Clicar em qualquer nó abre a etapa correspondente abaixo, como hoje: rolagem suave até o conteúdo, timeline vertical lateral acompanhando e destacando a etapa ativa, e transição deslizante entre etapas.
- Botões "Etapa anterior / Próxima etapa" continuam funcionando e atualizam o preenchimento da linha.
- Nada muda no conteúdo textual das etapas nem nos links de cada módulo.

## Detalhes técnicos

- Alterar apenas `src/components/guia/GuiaGerencial.tsx`: remover `TimelineCard`, o trilho com `overflow-x-auto`, as funções `deslizar` e os indicadores.
- Novo componente interno `TrilhaFluida`: SVG responsivo (`viewBox` + `preserveAspectRatio`) com um `path` de curva suave de fundo e um segundo `path` de progresso usando `stroke-dasharray`/`stroke-dashoffset` animado via transição CSS.
- Nós renderizados como botões HTML posicionados em percentuais sobre o SVG (acessíveis por teclado, `aria-current="step"`), não como elementos SVG.
- Cores exclusivamente por tokens existentes (`--primary`, `--border`, `--muted-foreground`); nenhuma cor nova em `src/styles.css`.
- Variante vertical ativada por classes responsivas do Tailwind, com um segundo `path` vertical — sem JS de media query.
