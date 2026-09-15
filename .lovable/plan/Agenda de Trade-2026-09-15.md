# Agenda de Trade

Nova ferramenta dentro de **Ferramentas → Agenda de Trade**, combinando agenda de ações comerciais com controle de investimentos por cliente, incluindo rateio de despesas de viagem.

## 1. Base de dados (Lovable Cloud)

Novas tabelas, todas com empresa, RLS por empresa e datas de criação/atualização:

- **Centros de custo** — nome, descrição, ativo/inativo. Semente: Trade Marketing, Comercial, Marketing, Eventos, Treinamentos, Relacionamento, Viagens, Showroom, PDV, Representantes.
- **Categorias de investimento** — nome, se é despesa rateável (passagem, hospedagem, alimentação, combustível, pedágio, estacionamento, táxi, deslocamento, transporte), ativo. Semente com as 22 categorias pedidas.
- **Viagens de trade** — título, cidade, data inicial e final, responsável, observações.
- **Ações de trade** — viagem (opcional), tipo de ação, descrição livre para "Outro", descrição, data inicial/final, horário, cidade, status (planejado, confirmado, realizado, cancelado), responsável (usuário e/ou representante).
- **Clientes da ação** — vínculo ação ↔ cliente (permite vários clientes por ação).
- **Investimentos** — pertence a uma ação ou diretamente a uma viagem; descrição, categoria, centro de custo, data, valor planejado, valor realizado, status, observação, anexo, e indicação de despesa rateada.
- **Rateios** — linhas de alocação por cliente de um investimento: cliente e valor alocado. O valor total fica apenas no investimento; as alocações são a divisão dele. Consolidados somam o investimento uma única vez; visões por cliente somam as alocações.

Anexos de comprovante usam um bucket privado novo, com link de download assinado.

## 2. Tela principal — `/ferramentas/agenda-trade`

- Visões **Mês**, **Semana** e **Lista**, com navegação de período no mesmo padrão da Agenda atual.
- Botão **Nova ação** e criação rápida clicando numa data do calendário.
- Filtros: período, cliente, representante/responsável, tipo de ação, status e centro de custo.
- Cards no calendário mostrando cliente, tipo de ação, cidade, responsável e status (cor por status).
- Faixa de resumo financeiro do período: total planejado, total realizado, e totais por cliente, por tipo de ação e por centro de custo.
- Clique no card abre os detalhes completos.

## 3. Cadastro da ação

Diálogo com fluxo rápido: Cliente(s) → Tipo de ação → Datas → Investimentos → Salvar.

- Seleção de clientes com busca na base existente, múltipla.
- Lista de 40 tipos de ação do mercado de iluminação; "Outro" abre campo de descrição.
- Status editável; ações realizadas continuam editáveis para lançar custos finais.
- Vínculo opcional a uma viagem (criar ou escolher existente).

## 4. Bloco INVESTIMENTOS

Dentro da ação, lista de investimentos com botão **+ Adicionar investimento**. Cada linha: descrição, categoria, centro de custo, data, valor planejado, valor realizado, status, observação e anexo.

Quando a categoria é de viagem, aparece a pergunta *"Esta despesa deve ser rateada entre outros clientes?"*. Ao escolher Sim, o usuário seleciona os clientes participantes e o sistema divide o valor igualmente, mostrando o valor por cliente e mantendo registrados o valor total original, a quantidade e a lista de clientes.

## 5. Viagem de trade

Tela/diálogo de viagem agrupando várias ações e clientes, com bloco próprio de despesas gerais (passagem, hotel, alimentação, táxi, estacionamento) rateáveis entre os clientes da viagem. Visão de custo real por cliente da viagem.

## 6. Painel gerencial

Aba "Painel" na mesma página, com filtros de período (mês, trimestre, semestre, ano, personalizado):

- Indicadores: investimento planejado, realizado, diferença e variação %, número de ações, clientes atendidos, investimento médio por cliente e por ação, investimento em viagens, eventos e treinamentos.
- Visões por cliente (ações, planejado, realizado, direto, rateado, total, histórico), por tipo de ação, por centro de custo e por responsável.

## 7. Integração futura com o cliente

A estrutura já permite consultar o investimento de trade por cliente (direto + rateado, por período e por tipo). O BI atual não será alterado agora.

## Detalhes técnicos

- Rota `src/routes/_authenticated/ferramentas.agenda-trade.tsx`, componentes em `src/components/agenda-trade/`, tipos e helpers em `src/lib/agenda-trade-*`.
- Leituras/escritas via cliente do Cloud com RLS por empresa; listas de usuários reaproveitam `getAgendaUsers`.
- Item novo em `src/lib/nav-tree.ts` no grupo Ferramentas (`ferramentas.agenda-trade`), sem mexer nos itens existentes.
- Nenhuma funcionalidade atual é alterada.
