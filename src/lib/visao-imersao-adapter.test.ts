import { describe, it, expect } from 'vitest';
import { adapterImmersionToExecutive } from './visao-imersao-adapter';
import type { FieldImmersionDoc } from './field-store-visit';

describe('adapterImmersionToExecutive', () => {
  const mockDoc: FieldImmersionDoc = {
    meta: {
      cliente: "Loja Teste",
      local: "São Paulo",
      data_visita: "2026-08-07",
      consultor: "Felipe",
    },
    chapters: [
      {
        codigo: "C1",
        titulo: "Contexto e percepção",
        markdown: "# Headline C1\nEste é o resumo do contexto. \"Citação importante\".\n\nMais detalhes operacionais."
      },
      {
        codigo: "C7",
        titulo: "Síntese e ação",
        markdown: "- Sinal 1 importante\n- Sinal 2 relevante\n- Sinal 3 fundamental"
      }
    ]
  } as any;

  it('deve gerar exatamente 7 perspectivas', () => {
    const visao = adapterImmersionToExecutive(mockDoc);
    expect(visao.perspectives).toHaveLength(7);
    expect(visao.perspectives[0].perspective_title).toBe("Contexto e percepção");
  });

  it('deve extrair evidência corretamente', () => {
    const visao = adapterImmersionToExecutive(mockDoc);
    expect(visao.perspectives[0].source_quote).toBe("Citação importante");
  });

  it('deve gerar entre 3 e 5 sinais a partir do C7', () => {
    const visao = adapterImmersionToExecutive(mockDoc);
    expect(visao.executive_view.priority_signals.length).toBeGreaterThanOrEqual(3);
    expect(visao.executive_view.priority_signals.length).toBeLessThanOrEqual(5);
    expect(visao.executive_view.priority_signals[0].finding).toBe("Sinal 1 importante");
  });

  it('deve sumarizar o texto da perspectiva', () => {
    const visao = adapterImmersionToExecutive(mockDoc);
    expect(visao.perspectives[0].evidence?.length).toBeLessThan(mockDoc.chapters[0].markdown.length);
  });
});
