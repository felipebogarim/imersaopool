import { describe, it, expect } from 'vitest';
import { adapterImmersionToExecutive } from './visao-imersao-adapter';
import type { FieldImmersionDoc } from './field-store-visit';

describe('adapterImmersionToExecutive', () => {
  const mockDoc: FieldImmersionDoc = {
    meta: {
      cliente: "Loja Teste",
      local: "São Paulo",
      data_visita: "2026-08-07",
      representante: "Felipe",
    },
    chapters: [
      {
        ordem: 1,
        codigo: "C1",
        key: "contexto",
        titulo: "Contexto",
        markdown: "# Título\nEsta é a síntese do C1. \"Citação C1\".\n\nSegundo parágrafo."
      },
      {
        ordem: 7,
        codigo: "C7",
        key: "sintese",
        titulo: "Síntese",
        markdown: "- Ponto 1 de sinal\n- Ponto 2 de sinal\n- Ponto 3 de sinal"
      }
    ]
  };

  it('deve gerar 7 perspectivas na ordem canônica', () => {
    const visao = adapterImmersionToExecutive(mockDoc);
    expect(visao.perspectives).toHaveLength(7);
    expect(visao.perspectives[0].perspective_title).toBe("Contexto e percepção");
    expect(visao.perspectives[6].perspective_title).toBe("Síntese e ação");
  });

  it('deve usar C1 para a Síntese Presidencial', () => {
    const visao = adapterImmersionToExecutive(mockDoc);
    expect(visao.executive_brief?.presidential_synthesis).toContain("Esta é a síntese do C1");
  });

  it('deve extrair sinais de C7', () => {
    const visao = adapterImmersionToExecutive(mockDoc);
    expect(visao.executive_view.priority_signals).toHaveLength(3);
    expect(visao.executive_view.priority_signals[0].finding).toBe("Ponto 1 de sinal");
  });

  it('deve extrair citações via extractEvidence', () => {
    const visao = adapterImmersionToExecutive(mockDoc);
    expect(visao.perspectives[0].source_quote).toBe("Citação C1");
  });

  it('deve limitar headline em 110 caracteres', () => {
    const longoDoc: FieldImmersionDoc = {
        ...mockDoc,
        chapters: [
            {
                ordem: 1,
                codigo: "C1",
                key: "c1",
                titulo: "T",
                markdown: "A".repeat(200) + "."
            }
        ]
    };
    const visao = adapterImmersionToExecutive(longoDoc);
    expect(visao.perspectives[0].executive_finding?.length).toBeLessThanOrEqual(110);
  });
});
