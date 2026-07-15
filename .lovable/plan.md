## Objetivo

Fazer o parser do modo "Relatório final" aceitar o cabeçalho `## Capítulo 00 — Sumário executivo` (formato que a IA está gerando), além do formato atual `## Sumário executivo`, sem quebrar relatórios antigos.

## Alterações

Arquivo: `src/lib/ingest-final-report.functions.ts`

1. **`parseSumarioExecutivo`** — ampliar o regex de detecção para casar qualquer uma destas variações do cabeçalho:
   - `## Sumário executivo`
   - `## Capítulo 00 — Sumário executivo` (com `—`, `-`, `–`, `.`, `:`)
   - `## Capítulo 0 — Sumário executivo`
   - `## 00. Sumário executivo` / `## 0 — Sumário executivo`
   
   Regex proposto: `/^\s*#{1,3}\s*(?:cap[ií]tulo\s+0+\s*[—\-–.:)]?\s*)?sum[aá]rio\s+executivo\s*$/im`.

2. **`stripSumarioBlock`** — usar o mesmo regex ampliado para remover o bloco inteiro do texto antes do parse de capítulos, evitando que ele seja tratado como capítulo 0.

3. **Guarda no loop de capítulos** — em `parseFinalReport`, quando `chapterHeaderRe` casar com `ordem === 0`, ignorar o cabeçalho (o bloco já foi tratado pelo sumário). Isso protege o caso de o strip falhar por qualquer motivo, evitando a falsa mensagem "capítulo não reconhecido: 0 — Sumário executivo".

## Resultado esperado

- Upload do arquivo `Relatorio_Final_Fabio_Bristotti_Com_Capitulo_00.md`:
  - some o aviso "1 capítulo(s) não reconhecido(s)";
  - sumário é gravado em `interviews.respostas.__sumario_executivo__`;
  - PDF passa a mostrar item 00 no índice, três cards no Panorama e a página dedicada.
- Relatórios antigos (`## Sumário executivo` ou sem sumário) continuam funcionando exatamente como hoje.

## Fora de escopo

Renderização do PDF e edição manual no `ChapterCapture` já foram implementadas em turnos anteriores; nada muda nelas.
