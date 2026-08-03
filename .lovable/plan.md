# Price › Comparativos

Desenvolver o conteúdo interno da página já existente `/price/comparativos` (rota mantida, menu e identidade visual intactos), reaproveitando Competidores e Tabelas.

O escopo enviado é muito grande para uma única entrega. Proponho 4 fases; cada fase entrega algo utilizável de ponta a ponta. Comece pela Fase 1 e siga na sequência.

## Base de dados (Fase 1)

O módulo Price hoje tem: `price_competitors`, `price_tables`, `own_products`, `competitor_products`, `product_equivalences` (simples), `familias_produto`.

Novas tabelas (todas com RLS por empresa e GRANTs):

- `price_products` — produto normalizado (marca própria ou concorrente): marca, família, categoria, tipo, SKU, referência, descrição, imagem, status, fonte/página/data.
- `price_product_specs` — uma linha por atributo: chave, valor original, valor normalizado, numérico, unidade original/normalizada, método de extração, nível de confiança, revisado manualmente.
- `price_product_prices` — preço, com/sem imposto, unidade, por metro/watt/1.000 lm, estado, região, vigência, fonte, página, confiança.
- `price_comparison_rules` — pesos, tolerâncias, critério crítico/eliminatório, penalização por dado ausente (por família/categoria/tipo).
- `price_equivalences` — produto base × comparado, score técnico, score de preço, custo-benefício, nível de equivalência, status (em análise / validado / incompatível), semelhanças/diferenças em JSON, validação (quem/quando), justificativa, exclusão lógica.
- `price_import_files` e `price_import_rows` — arquivos enviados e dados extraídos com confiança e status de revisão.
- `price_audit_logs`, `price_shares` — histórico de alterações e de compartilhamentos.

Permissão de edição: apenas admin (gestormaster) via política RLS + verificação em server function; a UI apenas esconde botões.

## Fase 1 — Fundação e importação da planilha

- Migração das tabelas acima.
- Parser da planilha enviada (layout largo: bloco base BRILIA + blocos por concorrente ROMALUX, INTERLIGHT etc., 18 atributos por bloco) → produtos, specs e preços normalizados, preservando o valor original.
- Botão **Importar dados** com upload de XLSX/CSV, prévia, mapeamento de colunas, detecção de duplicidade e relatório de importação.
- Motor de cálculo: índice de proximidade técnica 0–100 com pesos configuráveis (tabela de pesos de Fitas LED já pré-carregada), critérios eliminatórios e penalização por dado ausente; classificação (direto / aproximado / alternativo / incompatível / dados insuficientes).
- Estado inicial da página: título, texto de apoio, seleção de família/categoria, busca de produto base, comparações recentes.

## Fase 2 — Painel de análise

- Filtros (família, categoria, tipo, marca base, produto base, concorrentes, status, classificação, faixa de proximidade e de preço, data, região) com aplicar/limpar/salvar combinação.
- Card do produto de referência com todos os atributos de Fitas LED.
- Indicadores resumidos clicáveis (equivalentes, diretos, aproximados, alternativos, incompatíveis, menor/maior/médio preço, mais próximo, melhor custo-benefício, em análise, validados).
- Ranking de equivalentes: tabela com cabeçalho e colunas iniciais fixas, ordenação, paginação, seleção de linhas e menu kebab.
- Modos de visualização: Ranking, Cards, Tabela técnica.
- Comparação lado a lado de 2 a 5 produtos com farol por célula (cor + ícone + texto).
- Comparação de preços com gráfico de barras, preço por metro/watt/1.000 lm e farol de preço; distinção entre não informado, sob consulta, não aplicável.
- Análise automática de semelhanças, diferenças e impacto na aplicação (sem conclusões quando faltar dado).

## Fase 3 — Governança

- Drawer de edição técnica completa (somente gestormaster), com salvar rascunho, restaurar valor anterior e validar.
- Status de validação com regras: automático nasce Em análise, edição de item validado volta para Em análise, incompatível exige justificativa, incompatíveis ocultos do ranking padrão.
- Histórico e auditoria de todas as alterações; exclusão lógica com modal de confirmação.
- Fila **Dados pendentes de validação** com aprovar / corrigir / rejeitar / associar / ignorar.
- Configuração de pesos e tolerâncias (Fitas LED e Drivers).

## Fase 4 — Saída comercial

- PDF comercial desenhado (capa, resumo executivo, produto base, ranking, comparação técnica com farol, gráfico de preços, análise, recomendação, fontes e ressalvas), com tela de configuração e pré-visualização.
- Compartilhar por e-mail (PDF anexo, registro do envio) e por WhatsApp (gera PDF, abre WhatsApp com mensagem, sem afirmar entrega).
- Regras de compartilhamento (somente validados por padrão) e histórico de compartilhamentos.

## Fora do escopo destas fases

Importação por PDF e por imagem com OCR (itens 27 e 29). Depende de OCR no servidor e vale tratar depois que Excel/CSV estiver estável — posso incluir numa Fase 5 se quiser.

## Notas técnicas

- Rota mantida: `src/routes/_authenticated/price.comparativos.tsx`, dentro do layout `price.tsx` existente.
- Componentes novos em `src/components/price/`, lógica pura em `src/lib/price-comparativos*.ts` (testável), server functions em `src/lib/price-comparativos.functions.ts`.
- Sem novas cores ou fontes: apenas tokens semânticos e componentes shadcn já usados na plataforma.
