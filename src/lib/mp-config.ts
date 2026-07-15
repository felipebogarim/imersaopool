export type PacoteId = "completa" | "hospedagem" | "umdia";

export interface Pacote {
  id: PacoteId;
  titulo: string;
  valor: number;
  periodo: string;
  descricao: string;
}

export const PACOTES: Record<PacoteId, Pacote> = {
  completa: {
    id: "completa",
    titulo: "Experiência Completa",
    valor: 1050.0,
    periodo: "31/07 a 02/08",
    descricao: "2 diárias, todas as vivências, café, almoço e jantar de sábado, café da tarde e café da manhã de domingo.",
  },
  hospedagem: {
    id: "hospedagem",
    titulo: "Experiência com Hospedagem",
    valor: 795.0,
    periodo: "01/08 a 02/08",
    descricao: "1 diária, todas as vivências, almoço, café da tarde e jantar de sábado, café da manhã de domingo.",
  },
  umdia: {
    id: "umdia",
    titulo: "Experiência de Um Dia",
    valor: 435.0,
    periodo: "01/08",
    descricao: "Vivências e práticas ao longo do sábado, almoço e café da tarde.",
  },
};

export function isPacoteId(v: string): v is PacoteId {
  return v === "completa" || v === "hospedagem" || v === "umdia";
}
