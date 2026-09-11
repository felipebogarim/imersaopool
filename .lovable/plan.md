# Agenda em Ferramentas

## Objetivo
Criar a seção **Ferramentas › Agenda**, disponível aos usuários autenticados, para organizar compromissos próprios e convites recebidos.

## O que será entregue
- Nova página **Agenda** no menu Ferramentas.
- Visualizações **Dia, Semana, Mês e Ano**, com navegação entre períodos e atalho para hoje.
- Calendário com compromissos próprios e compromissos nos quais o usuário foi convidado.
- Criação de compromisso ao clicar em uma data ou no botão **Novo compromisso**.
- Formulário com título, data, horário, duração, detalhes e seleção de um ou mais usuários convidados.
- Abertura do compromisso para visualizar, editar ou excluir quando o usuário for o proprietário.
- Identificação visual de compromissos próprios e recebidos por convite.
- Envio automático de e-mail para cada convidado ao salvar; em edições, somente novos convidados recebem o convite.

## Dados e segurança
- Criar tabelas permanentes para compromissos e convidados.
- Permitir que cada usuário gerencie apenas os compromissos que criou.
- Permitir que convidados leiam somente os compromissos dos quais participam.
- Restringir convites a usuários cadastrados e vinculados ao mesmo ambiente empresarial do proprietário.
- Aplicar permissões de acesso no banco e manter o envio de e-mail autenticado.

## Interface
- Calendário responsivo, adaptando as quatro visualizações para telas menores.
- Controles compactos para trocar a visualização e navegar entre datas.
- Compromissos exibidos como cartões dentro das datas, com horário, duração e participantes.
- Janela de criação/edição com busca de usuários por nome ou e-mail e seleção múltipla.

## Validação
- Confirmar criação, edição, exclusão e persistência após recarregar a página.
- Confirmar que convidados visualizam o compromisso, mas não podem alterá-lo.
- Confirmar que o convite por e-mail contém título, data, duração, detalhes, organizador e link para a Agenda.
- Verificar as visualizações Dia, Semana, Mês e Ano em computador e celular.
