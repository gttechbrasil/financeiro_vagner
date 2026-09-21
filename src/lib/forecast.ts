import { prisma } from "@/lib/db";

/**
 * Agenda de contas a pagar e receber (projeção semanal).
 *
 * Junta três fontes e distribui as ocorrências por semana (segunda a domingo):
 *  1. FIXA     — lançamentos marcados como fixo/recorrente (📌). Cada série
 *                (mesma origem + mesmo fornecedor/descrição) repete o valor e o
 *                DIA do último lançamento nos meses seguintes ("todo dia 18").
 *  2. PARCELA  — compras parceladas de qualquer origem (cartão, Asaas, manual):
 *                a partir da última parcela conhecida (N/T), projeta as T−N
 *                restantes, uma por mês, no mesmo dia.
 *  3. PREVISTO — compromissos cadastrados na tela Contas a Pagar/Receber
 *                (aluguel dia 18, parcela de cliente dia 10 × 12...).
 *
 * Uma ocorrência é marcada como "realizada" quando já existe lançamento real da
 * mesma série no mês (ou, para previstos, um lançamento que case com o
 * fornecedor/padrão cadastrado). Só as ocorrências em aberto entram nos totais.
 */

export type ForecastKind = "FIXA" | "PARCELA" | "PREVISTO";

export interface ForecastItem {
  id: string;
  /** data prevista (yyyy-mm-dd) */
  date: string;
  description: string;
  /** centavos com sinal: a receber +, a pagar − */
  amountCents: number;
  kind: ForecastKind;
  /** ex.: "parcela 5/10", "todo dia 18" */
  detail: string;
  bankAccount: string | null;
  account: string | null;
  status: "previsto" | "realizado";
  realizedDate?: string;
  realizedCents?: number;
  commitmentId?: string;
}

export interface ForecastWeek {
  /** segunda-feira (yyyy-mm-dd) */
  start: string;
  /** domingo (yyyy-mm-dd) */
  end: string;
  label: string;
  /** totais apenas do que está em aberto (status previsto) */
  receberCents: number;
  pagarCents: number;
  saldoCents: number;
  items: ForecastItem[];
}

export interface InstallmentSeries {
  key: string;
  description: string;
  bankAccount: string;
  account: string | null;
  amountCents: number;
  currentNum: number;
  total: number;
  remaining: number;
  remainingCents: number;
  lastDate: string;
  nextDate: string;
}

export interface ForecastData {
  from: string;
  to: string;
  weeks: ForecastWeek[];
  receberCents: number;
  pagarCents: number;
  saldoCents: number;
  openInstallments: InstallmentSeries[];
}

/** Séries fixas cujo último lançamento é mais antigo que isso são consideradas encerradas. */
const RECURRING_LOOKBACK_MONTHS = 3;

// ---------------------------------------------------------------- datas (UTC)

const DAY = 86_400_000;

export const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Meia-noite UTC do dia civil de hoje (usa o calendário local do servidor). */
export function todayUTC(): Date {
  const n = new Date();
  return new Date(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()));
}

/** Segunda-feira da semana de `d` (UTC). */
export function weekStart(d: Date): Date {
  const dow = (d.getUTCDay() + 6) % 7; // 0 = segunda
  return new Date(d.getTime() - dow * DAY);
}

export function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * DAY);
}

/** Dia `day` do mês (y, m0), limitado ao último dia do mês. */
function dayInMonth(y: number, m0: number, day: number): Date {
  const last = new Date(Date.UTC(y, m0 + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m0, Math.min(day, last)));
}

const monthKey = (d: Date) => `${d.getUTCFullYear()}-${d.getUTCMonth()}`;
const monthsBetween = (a: Date, b: Date) =>
  (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth());

function fmtDayMonth(d: Date) {
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "UTC" });
}

export function weekLabel(start: Date, end: Date) {
  return `${fmtDayMonth(start)} a ${fmtDayMonth(end)}`;
}

/** Chave de série: ignora números, datas e pontuação da descrição. */
export function normalizeDescription(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[0-9]/g, "")
    .replace(/[^a-z ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ---------------------------------------------------------------- cálculo

type TxRow = {
  id: string;
  date: Date;
  description: string;
  amountCents: number;
  bankAccountId: string;
  supplierId: string | null;
  recurring: boolean;
  installmentNum: number | null;
  installmentTotal: number | null;
  bankAccount: { name: string };
  account: { code: string; name: string } | null;
};

const accLabel = (a: { code: string; name: string } | null) => (a ? `${a.code} ${a.name}` : null);

export async function computeForecast(from: Date, to: Date): Promise<ForecastData> {
  const items: ForecastItem[] = [];
  const fromMonth = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1));
  const toMonth = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), 1));
  const nMonths = monthsBetween(fromMonth, toMonth) + 1;
  const inRange = (d: Date) => d >= from && d <= to;

  const select = {
    id: true,
    date: true,
    description: true,
    amountCents: true,
    bankAccountId: true,
    supplierId: true,
    recurring: true,
    installmentNum: true,
    installmentTotal: true,
    bankAccount: { select: { name: true } },
    account: { select: { code: true, name: true } },
  } as const;

  const lookback = new Date(
    Date.UTC(from.getUTCFullYear(), from.getUTCMonth() - RECURRING_LOOKBACK_MONTHS, 1)
  );
  const [recurringTx, installmentTx, commitments, periodTx] = await Promise.all([
    prisma.transaction.findMany({
      where: { recurring: true, date: { gte: lookback, lte: to } },
      select,
      orderBy: { date: "desc" },
    }) as Promise<TxRow[]>,
    prisma.transaction.findMany({
      where: {
        installmentNum: { not: null },
        installmentTotal: { not: null },
        date: { gte: new Date(Date.UTC(from.getUTCFullYear() - 2, from.getUTCMonth(), 1)), lte: to },
      },
      select,
      orderBy: { date: "desc" },
    }) as Promise<TxRow[]>,
    prisma.commitment.findMany({
      where: { active: true, startDate: { lte: to } },
      include: {
        bankAccount: { select: { name: true } },
        account: { select: { code: true, name: true } },
        supplier: { select: { name: true, pattern: true } },
      },
    }),
    // lançamentos reais do período (para reconhecer previstos já realizados)
    prisma.transaction.findMany({
      where: { date: { gte: fromMonth, lte: to } },
      select: { id: true, date: true, description: true, amountCents: true, supplierId: true },
    }),
  ]);

  // ---- 1. fixas (📌): uma série por origem + fornecedor/descrição
  const fixedSeries = new Map<string, TxRow[]>();
  for (const t of recurringTx) {
    const key = `${t.bankAccountId}|${t.supplierId ?? normalizeDescription(t.description)}`;
    const arr = fixedSeries.get(key) ?? [];
    arr.push(t);
    fixedSeries.set(key, arr);
  }
  for (const [key, txs] of fixedSeries) {
    const latest = txs[0]; // ordenado por data desc
    if (latest.amountCents === 0) continue;
    const byMonth = new Map<string, TxRow>();
    for (const t of txs) if (!byMonth.has(monthKey(t.date))) byMonth.set(monthKey(t.date), t);
    const day = latest.date.getUTCDate();
    for (let k = 0; k < nMonths; k++) {
      const y = fromMonth.getUTCFullYear();
      const m0 = fromMonth.getUTCMonth() + k;
      const due = dayInMonth(y, m0, day);
      if (!inRange(due)) continue;
      const real = byMonth.get(monthKey(due));
      items.push({
        id: `fixa:${key}:${iso(due)}`,
        date: iso(due),
        description: latest.description,
        amountCents: latest.amountCents,
        kind: "FIXA",
        detail: `todo dia ${day}`,
        bankAccount: latest.bankAccount.name,
        account: accLabel(latest.account),
        status: real ? "realizado" : "previsto",
        realizedDate: real ? iso(real.date) : undefined,
        realizedCents: real?.amountCents,
      });
    }
  }

  // ---- 2. parceladas: uma série por origem + descrição + total de parcelas
  const instSeries = new Map<string, TxRow[]>();
  for (const t of installmentTx) {
    const key = `${t.bankAccountId}|${normalizeDescription(t.description)}|${t.installmentTotal}`;
    const arr = instSeries.get(key) ?? [];
    arr.push(t);
    instSeries.set(key, arr);
  }
  const openInstallments: InstallmentSeries[] = [];
  for (const [key, txs] of instSeries) {
    // última parcela conhecida = maior número (desempate pela data)
    const latest = [...txs].sort(
      (a, b) => (b.installmentNum! - a.installmentNum!) || (b.date.getTime() - a.date.getTime())
    )[0];
    const total = latest.installmentTotal!;
    const remaining = total - latest.installmentNum!;
    if (remaining <= 0) continue;
    const known = new Map<number, TxRow>();
    for (const t of txs) known.set(t.installmentNum!, t);
    const day = latest.date.getUTCDate();
    const nextDate = dayInMonth(latest.date.getUTCFullYear(), latest.date.getUTCMonth() + 1, day);
    openInstallments.push({
      key,
      description: latest.description,
      bankAccount: latest.bankAccount.name,
      account: accLabel(latest.account),
      amountCents: latest.amountCents,
      currentNum: latest.installmentNum!,
      total,
      remaining,
      remainingCents: latest.amountCents * remaining,
      lastDate: iso(latest.date),
      nextDate: iso(nextDate),
    });
    for (let k = 1; k <= remaining; k++) {
      const num = latest.installmentNum! + k;
      const due = dayInMonth(latest.date.getUTCFullYear(), latest.date.getUTCMonth() + k, day);
      if (!inRange(due)) continue;
      const real = known.get(num);
      items.push({
        id: `parc:${key}:${num}`,
        date: iso(due),
        description: latest.description,
        amountCents: latest.amountCents,
        kind: "PARCELA",
        detail: `parcela ${num}/${total}`,
        bankAccount: latest.bankAccount.name,
        account: accLabel(latest.account),
        status: real ? "realizado" : "previsto",
        realizedDate: real ? iso(real.date) : undefined,
        realizedCents: real?.amountCents,
      });
    }
  }
  openInstallments.sort((a, b) => a.nextDate.localeCompare(b.nextDate));

  // ---- 3. previstos cadastrados
  for (const c of commitments) {
    const pattern = (c.pattern ?? c.supplier?.pattern ?? c.supplier?.name ?? "").toLowerCase();
    const start = new Date(Date.UTC(c.startDate.getUTCFullYear(), c.startDate.getUTCMonth(), 1));
    for (let k = 0; k < nMonths; k++) {
      const y = fromMonth.getUTCFullYear();
      const m0 = fromMonth.getUTCMonth() + k;
      const month = new Date(Date.UTC(y, m0, 1));
      if (month < start) continue;
      const num = monthsBetween(start, month) + 1;
      if (c.installments != null && num > c.installments) continue;
      const due = dayInMonth(y, m0, c.dueDay);
      if (!inRange(due)) continue;
      const real = periodTx.find(
        (t) =>
          monthKey(t.date) === monthKey(due) &&
          Math.sign(t.amountCents) === Math.sign(c.amountCents) &&
          ((c.supplierId && t.supplierId === c.supplierId) ||
            (pattern && t.description.toLowerCase().includes(pattern)))
      );
      items.push({
        id: `prev:${c.id}:${iso(due)}`,
        date: iso(due),
        description: c.description,
        amountCents: c.amountCents,
        kind: "PREVISTO",
        detail: c.installments != null ? `parcela ${num}/${c.installments}` : `todo dia ${c.dueDay}`,
        bankAccount: c.bankAccount?.name ?? null,
        account: accLabel(c.account),
        status: real ? "realizado" : "previsto",
        realizedDate: real ? iso(real.date) : undefined,
        realizedCents: real?.amountCents,
        commitmentId: c.id,
      });
    }
  }

  // ---- agrupa por semana
  items.sort((a, b) => a.date.localeCompare(b.date) || a.amountCents - b.amountCents);
  const weeks: ForecastWeek[] = [];
  for (let ws = weekStart(from); ws <= to; ws = addDays(ws, 7)) {
    const we = addDays(ws, 6);
    const wsIso = iso(ws);
    const weIso = iso(we);
    const wItems = items.filter((i) => i.date >= wsIso && i.date <= weIso);
    const open = wItems.filter((i) => i.status === "previsto");
    const receberCents = open.filter((i) => i.amountCents > 0).reduce((s, i) => s + i.amountCents, 0);
    const pagarCents = open.filter((i) => i.amountCents < 0).reduce((s, i) => s + i.amountCents, 0);
    weeks.push({
      start: wsIso,
      end: weIso,
      label: weekLabel(ws, we),
      receberCents,
      pagarCents,
      saldoCents: receberCents + pagarCents,
      items: wItems,
    });
  }
  const receberCents = weeks.reduce((s, w) => s + w.receberCents, 0);
  const pagarCents = weeks.reduce((s, w) => s + w.pagarCents, 0);

  return {
    from: iso(from),
    to: iso(to),
    weeks,
    receberCents,
    pagarCents,
    saldoCents: receberCents + pagarCents,
    openInstallments,
  };
}

/** Intervalo padrão: da segunda-feira da semana atual até o domingo de `weeks` semanas. */
export function defaultRange(weeks = 4, startWeek?: Date): { from: Date; to: Date } {
  const from = weekStart(startWeek ?? todayUTC());
  return { from, to: addDays(from, weeks * 7 - 1) };
}
