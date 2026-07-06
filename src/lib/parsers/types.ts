export interface ParsedTransaction {
  /** Data em ISO (yyyy-mm-dd) */
  date: string;
  description: string;
  /** Valor em centavos, com sinal: crédito positivo, débito negativo */
  amountCents: number;
  /** Identificador externo (id da transação no banco de origem), quando houver */
  externalId?: string;
  /** Compra parcelada: número da parcela atual (ex.: 6 de 10) */
  installmentNum?: number;
  /** Compra parcelada: total de parcelas */
  installmentTotal?: number;
}

/** Interpreta "06/10", "6/10" etc. como parcela atual/total. */
export function parseInstallment(raw: string | undefined | null): {
  installmentNum?: number;
  installmentTotal?: number;
} {
  if (!raw) return {};
  const m = raw.trim().match(/^(\d{1,2})\/(\d{1,2})$/);
  if (!m) return {};
  const num = Number(m[1]);
  const total = Number(m[2]);
  if (total < 2 || num < 1 || num > total) return {};
  return { installmentNum: num, installmentTotal: total };
}

export interface ParseResult {
  /** Identificador do formato detectado (ex.: "asaas-csv", "ofx", "pdf-ia") */
  source: string;
  /** Nome amigável do formato para exibição */
  sourceLabel: string;
  rows: ParsedTransaction[];
  warnings: string[];
}
