export type ImmersionStatus = "realizada" | "planejada";

export type CityStop = {
  cityName: string;
  state: string;
  lat: number;
  lng: number;
  order: number;
  dayNumber?: number;
};

export type VisitedClient = {
  id: string;
  name: string;
  cityName: string;
  state: string;
  lat: number;
  lng: number;
  visitDate: string; // YYYY-MM-DD
  dayNumber?: number;
  // Ficha resumida do cliente
  scenario: string; // Cenário geral
  opportunities: string; // Oportunidades percebidas
  threats: string; // Ameaças ou riscos percebidos
  relevantPerceptions: string; // Percepções relevantes
  nextSteps: string; // Próximos passos
};

export type RepParticipant = {
  id: string;
  name: string;
  role: string;
  region: string;
  immersionRole?: string;
  perceptions?: string;
  keyInsights?: string;
  actionPoints?: string;
};

export type ImmersionItem = {
  id: string;
  title: string;
  status: ImmersionStatus;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  state: string; // Estado principal (ex: SP)
  cities: string[]; // Lista de cidades
  regionCovered: string; // Descrição da região percorrida/prevista
  cityStops: CityStop[];
  representatives: RepParticipant[];
  clients: VisitedClient[];
  objective: string;
  notes: string;
  createdAt: string;
};

export type TimeFilterOption = "all" | "6m" | "12m" | "2026";
