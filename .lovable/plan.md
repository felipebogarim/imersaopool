# Corrigir definitivamente o fluxo de primeiro acesso e termos

## Diagnóstico confirmado

- O login de `poolbranding@gmail.com` foi concluído com sucesso pelo backend às 22:39 usando a senha cadastrada pelo usuário.
- A conta está ativa, com os perfis `admin` e `agente`, sem empresa ativa e sem aceite do termo de confidencialidade.
- A versão 1.1 dos Termos está ativa e exige aceite.
- Não existe registro de aceite dessa versão para a conta e não houve erro do procedimento de aceite no banco. Portanto, a ação não está chegando ao backend; a quebra ocorre antes, durante a navegação/renderização protegida no navegador.
- O código atualmente publicado ainda faz transições concorrentes no roteador: após login usa navegação interna; após o aceite limpa o gate, invalida o roteador e navega simultaneamente. Esse é o ponto concreto a eliminar.

## Implementação

1. **Tornar o pós-login determinístico**
   - Após autenticação bem-sucedida, confirmar a identidade com `getUser()`.
   - Encerrar o estado de carregamento e fazer uma única navegação completa do documento para a etapa calculada pelo gate, evitando a transição concorrente do roteador em memória.

2. **Corrigir a sequência dos aceites**
   - No aceite dos Termos, exigir que o procedimento retorne o identificador do registro criado.
   - Consultar novamente o status e só avançar quando o backend responder `aceito`.
   - Como esta conta ainda não aceitou o termo de confidencialidade, avançar diretamente para `/nda`; depois do NDA, direcionar para seleção de empresa ou painel conforme o estado real.
   - Remover a combinação atual de `router.invalidate()` + `navigate()` das páginas de aceite.

3. **Fortalecer o gate sem liberar acesso indevidamente**
   - Validar o usuário com `getUser()` em vez de confiar apenas na sessão local.
   - Remover o estado degradado que hoje libera a rota quando a leitura de termos/perfil falha; mostrar erro recuperável sem contornar etapas obrigatórias.
   - Manter um único redirecionamento por avaliação do gate.

4. **Validação objetiva**
   - Testar login normal, abertura dos Termos, criação do registro de aceite, avanço para NDA e saída do NDA.
   - Confirmar no banco os registros efetivamente gravados e verificar que não há tela branca, loop ou botão preso.
   - Não alterar nem redefinir a senha cadastrada pelo usuário.

## Arquivos envolvidos

- `src/routes/auth.tsx`
- `src/routes/_authenticated/route.tsx`
- `src/routes/_authenticated/aceite-termos.tsx`
- `src/routes/_authenticated/nda.tsx`
- `src/lib/auth-gate.ts`