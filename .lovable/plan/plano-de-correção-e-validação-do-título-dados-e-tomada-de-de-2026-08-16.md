# Plano de Correção e Validação do Título "Dados e tomada de decisão."

O usuário relatou que o ponto final não está visível no front-end, apesar de ter sido adicionado no código. A inspeção inicial via browser revelou que o usuário está na tela de autenticação (`/auth`), onde o H1 exibe "Acessar plataforma", e não na Home real (`/_authenticated/home`), onde o título "Dados e tomada de decisão." reside.

## Ações Propostas

### 1. Garantir Persistência no Código
Embora o código lido (`src/routes/_authenticated/home.tsx` e `src/components/guia/GuiaGerencial.tsx`) já contenha o ponto final, realizarei uma re-escrita forçada das linhas afetadas para garantir que não haja caracteres invisíveis ou problemas de codificação impedindo a renderização correta.

### 2. Sincronizar Metadados de SEO
Atualizar o metadado `title` e `og:title` na rota de Home para refletir exatamente o texto com o ponto final, garantindo consistência entre o que o navegador exibe na aba e o que é renderizado na página.

### 3. Verificação em Tempo Real (Browser Use)
Após a aplicação, utilizarei o Playwright para:
- Acessar a aplicação.
- Realizar login automático (usando a sessão injetada ou gerada).
- Navegar até `/home`.
- Capturar um screenshot focado no H1 e ler o conteúdo textual exato via DOM para confirmar a presença do ponto final para o usuário.

## Detalhes Técnicos

- **Arquivos afetados:**
    - `src/routes/_authenticated/home.tsx`: H1 principal e tags de cabeçalho.
    - `src/components/guia/GuiaGerencial.tsx`: Título da seção de guia.
- **Validação:** Screenshot do elemento H1 em `http://localhost:8080/home`.
