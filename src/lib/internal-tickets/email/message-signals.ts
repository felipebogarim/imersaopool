export type MessageSignal = {
  type:
    | "resposta"
    | "duvida"
    | "progresso"
    | "impedimento"
    | "cobranca"
    | "entrega"
    | "provavel_conclusao"
    | "aprovacao";
  confidence: number;
};

/**
 * Conservative derived signals. They are analytics only: this module does not
 * know ticket statuses and therefore cannot conclude or mutate a ticket.
 */
export function deriveMessageSignals(text: string | null): MessageSignal[] {
  const value = (text || "").toLocaleLowerCase("pt-BR");
  const signals: MessageSignal[] = [{ type: "resposta", confidence: 1 }];
  const add = (type: MessageSignal["type"], pattern: RegExp, confidence: number) => {
    if (pattern.test(value)) signals.push({ type, confidence });
  };
  add("duvida", /\?|d[uú]vida|poderia esclarecer/, 0.7);
  add("progresso", /em andamento|estamos trabalhando|atualiza[cç][aã]o/, 0.65);
  add("impedimento", /bloquead|impediment|depend[eê]ncia|n[aã]o conseguimos/, 0.75);
  add("cobranca", /retorno|prazo|urgente|cobran[cç]a/, 0.6);
  add("entrega", /entregue|disponibilizad|publicad|anexo segue/, 0.75);
  add("provavel_conclusao", /conclu[ií]d|resolvid|finalizad/, 0.7);
  add("aprovacao", /aprovad|de acordo|pode seguir/, 0.7);
  return signals;
}
