/** Converte um valor em texto (pt-BR ou en-US) para centavos inteiros. */
export function parseToCents(raw: string | number): number | null {
  if (typeof raw === "number") return Math.round(raw * 100);
  let s = raw.trim().replace(/R\$\s?/gi, "").replace(/\s/g, "");
  if (!s) return null;
  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  if (s.startsWith("-")) {
    negative = true;
    s = s.slice(1);
  }
  const hasComma = s.includes(",");
  const hasDot = s.includes(".");
  if (hasComma && hasDot) {
    // o separador decimal é o que aparece por último
    if (s.lastIndexOf(",") > s.lastIndexOf(".")) s = s.replace(/\./g, "").replace(",", ".");
    else s = s.replace(/,/g, "");
  } else if (hasComma) {
    s = s.replace(",", ".");
  } else if (hasDot) {
    // "1.234" com exatamente 3 dígitos após o ponto costuma ser milhar pt-BR,
    // mas em extratos (ex.: Sicredi XLS) "30992.23" é decimal — mantemos como decimal
    const parts = s.split(".");
    if (parts.length > 2) s = parts.slice(0, -1).join("") + "." + parts[parts.length - 1];
  }
  const n = Number(s);
  if (!isFinite(n)) return null;
  const cents = Math.round(n * 100);
  return negative ? -cents : cents;
}

export function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatBRLPlain(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Converte "dd/mm/aaaa" (ou dd/mm + ano de referência) para Date em UTC. */
export function parseDateBR(raw: string, refYear?: number): Date | null {
  const m = raw.trim().match(/^(\d{2})\/(\d{2})(?:\/(\d{4}))?$/);
  if (!m) return null;
  const year = m[3] ? Number(m[3]) : refYear;
  if (!year) return null;
  const month = Number(m[2]);
  const day = Number(m[1]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return new Date(Date.UTC(year, month - 1, day));
}

export const MONTHS_PT = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export const MONTHS_PT_SHORT = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];
