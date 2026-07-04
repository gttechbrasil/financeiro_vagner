export interface ParsedTransaction {
  /** Data em ISO (yyyy-mm-dd) */
  date: string;
  description: string;
  /** Valor em centavos, com sinal: crédito positivo, débito negativo */
  amountCents: number;
  /** Identificador externo (id da transação no banco de origem), quando houver */
  externalId?: string;
}

export interface ParseResult {
  /** Identificador do formato detectado (ex.: "asaas-csv", "ofx", "pdf-ia") */
  source: string;
  /** Nome amigável do formato para exibição */
  sourceLabel: string;
  rows: ParsedTransaction[];
  warnings: string[];
}
