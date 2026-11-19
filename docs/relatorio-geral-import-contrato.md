# Relatório Geral — contrato de importação (JSON v1)

Importar relatório pronto recebe **dois arquivos do mesmo relatório**:

- **JSON** (`schema_version: 1`): alimenta os gráficos e quadros nativos da página.
- **PDF**: guardado como veio (bucket privado `general-reports`) e entregue por **Baixar PDF**, sem gerar outro.

A PoolFlux **só valida, formata e exibe**. Não chama IA, não lê o PDF e não recalcula diferença, percentual, cobertura nem posição. O exemplo válido está em `relatorio-geral-import-exemplo.json` (dados fictícios).

## Regras gerais

| Tema | Regra |
|---|---|
| Dinheiro | **centavos inteiros** (`57320016` = R$ 573.200,16). Decimal ou texto é erro. |
| Percentual | número em **pontos percentuais** (`-18.3` aparece como `−18,3%`). Exibido com 1 casa. |
| Valor ausente | **erro**; nunca é assumido como zero. |
| Relato comercial (`note`) | exibido **exatamente** como veio (ex.: `Dados ainda não inputados`); ausente aparece como `—`. |
| Ordem | a ordem dos blocos e das linhas é preservada. |
| Período | `label` (texto aprovado) **ou** `start`+`end` (`AAAA-MM-DD`, confirmadas). Datas nunca são deduzidas. |

## Raiz

```json
{
  "schema_version": 1,
  "report_id": "string",
  "title": "string",
  "representative_name": "string",
  "company": "string (opcional)",
  "period": { "label": "texto aprovado", "start": "2025-11-01", "end": "2026-10-31" },
  "blocks": [ ... ]
}
```

Todo bloco tem `type` e, opcionalmente, `title` (substitui o título padrão).

## Blocos (`type`)

| `type` | Campos | Exibição |
|---|---|---|
| `intro` | `subtitle?`, `themes: [{ headline, detail? }]` | Bloco azul; 1ª frase (`headline`) em destaque; o subtítulo cai no período se omitido. |
| `overall_result` | `previous_cents`, `current_cents`, `change_cents`, `change_pct` | Duas barras verticais com as médias acima; box lateral com variação líquida em % e R$ (vermelho = queda, verde = alta, neutro = estável). |
| `monthly_by_state` | `items: [{ uf, previous_cents, current_cents, change_cents, change_pct }]` | Duas barras por UF (azul = anterior, laranja = atual), valores acima, variação em R$ e % abaixo da UF. Ordem do JSON. |
| `loss_concentration` | `scope_gross_loss_cents`, `scope_share_pct`, `scope_records`, `rows: [{ position, account, uf, previous_cents, current_cents, change_cents, change_pct, note? }]` | Quadro único; mostra perda bruta, participação e nº de registros do recorte como informados. |
| `top10_growth` | `items: [{ account, uf, gain_cents }]`, `no_base?: [{ account, uf, current_cents }]` | Barras horizontais com o valor na ponta; `no_base` em faixa separada. |
| `top6_comparison` | `items: [{ account, uf, previous_cents, current_cents, gain_cents, gain_pct }]` | Duas barras horizontais por conta; ganho em R$ e % à direita. |
| `top6_reasons` | `items: [{ account, uf, previous_cents, current_cents, gain_cents, note? }]` | Quadro com as mesmas contas e ordem do comparativo. |

## Validações

- versão do contrato, campos obrigatórios, tipos e tipos de bloco reconhecidos;
- período válido (texto aprovado ou datas completas e coerentes);
- **Top 6**: `top6_comparison` e `top6_reasons` devem existir juntos, com as **mesmas contas (conta + UF) e na mesma ordem**. A divergência é informada com o bloco e a posição; os dados **não** são corrigidos sozinhos;
- presença dos dois anexos (o PDF precisa ter assinatura `%PDF-`; limites: JSON 5 MB, PDF 50 MB).

Cada erro indica o arquivo e o caminho do campo/bloco (ex.: `blocks[2].rows[0].current_cents`).

## Fora do escopo (de propósito)

Não há cartões de queda por UF, gráfico de Pareto, quadro separado de motivos de queda, "Próximos Passos Comerciais" nem "Lacunas e limitações".

## Armazenamento e acesso

Linha em `general_reports` (`source = 'importado'`, `import_data`, `import_pdf_path`, `import_pdf_name`, `import_pdf_sha256`), mesmo RLS (dono ou admin) e mesmo bucket privado. O SHA-256 do PDF é gravado na importação para conferir a identidade do arquivo. O PDF **não** é público: o **Link público** (opcional, desligado por padrão) mostra só os blocos.
