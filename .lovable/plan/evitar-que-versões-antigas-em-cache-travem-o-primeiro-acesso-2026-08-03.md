# Evitar que versões antigas em cache travem o primeiro acesso

## O que ficou confirmado

- O fluxo funciona: no celular (sem cache antigo) o login, a criação de senha e os aceites concluíram normalmente.
- No desktop o navegador continuava servindo uma versão antiga da aplicação, o que causava a tela branca e o loop nos aceites.
- Ou seja, não há correção pendente na lógica de autenticação; falta uma proteção contra versão desatualizada carregada no navegador do usuário.

## Implementação proposta

1. **Detecção de versão desatualizada**
   - Registrar a versão da build no momento da publicação e compará-la com a versão carregada no navegador.
   - Quando houver divergência, recarregar a aplicação uma única vez, de forma automática e silenciosa, sem loop de recarga.

2. **Recuperação amigável nas telas de acesso**
   - Nas etapas de login, criação de senha e aceites, se a tela falhar ao carregar, exibir uma mensagem curta com um botão "Atualizar aplicação" que força o recarregamento limpo em vez de deixar a tela em branco.

3. **Limpeza de estado local no logout e no primeiro acesso**
   - Ao sair e ao entrar por convite, limpar caches locais da aplicação para que o usuário nunca inicie o fluxo com dados antigos.

4. **Validação**
   - Simular navegador com versão antiga carregada e confirmar que a aplicação se atualiza sozinha uma vez e segue o fluxo até o painel.
   - Confirmar que não ocorre recarregamento repetido em nenhuma tela.

## Arquivos envolvidos

- `src/routes/__root.tsx`
- `src/routes/auth.tsx`
- `src/routes/definir-senha.tsx`
- `src/routes/_authenticated/route.tsx`
