import { prisma } from "@/lib/db";

// subtotalScope: "running" = acumulado em cascata (Receita Líquida, EBITDA...);
// "group" = soma apenas do próprio grupo (Resultado Financeiro Líquido)
export const GROUPS = [
  { key: "RECEITA", title: "1. RECEITAS OPERACIONAIS", subtotal: "TOTAL RECEITAS OPERACIONAIS", subtotalScope: "group" },
  { key: "DEDUCAO", title: "2. DEDUÇÕES DA RECEITA", subtotal: "RECEITA LÍQUIDA", subtotalScope: "running" },
  { key: "CUSTO", title: "3. CUSTOS DIRETOS", subtotal: "RESULTADO BRUTO", subtotalScope: "running" },
  { key: "DESPESA", title: "4. DESPESAS OPERACIONAIS", subtotal: "EBITDA", subtotalScope: "running" },
  { key: "FINANCEIRO", title: "5. RESULTADO FINANCEIRO", subtotal: "RESULTADO FINANCEIRO LÍQUIDO", subtotalScope: "group" },
  { key: "NAO_OPERACIONAL", title: "6. RESULTADO NÃO OPERACIONAL", subtotal: "LUCRO OPERACIONAL", subtotalScope: "running" },
  { key: "PRO_LABORE", title: "7. PRÓ-LABORE", subtotal: null, subtotalScope: "running" },
  { key: "DISTRIBUICAO", title: "8. DISTRIBUIÇÃO DE LUCROS", subtotal: "RESULTADO LÍQUIDO DO PERÍODO", subtotalScope: "running" },
] as const;

export type DreRow = {
  kind: "group" | "account" | "subtotal";
  label: string;
  code?: string;
  /** id da conta do DRE (linhas de conta) — usado no drill-down */
  accountId?: string;
  /** chave do grupo (subtotais de grupo) — usado no drill-down */
  groupKey?: string;
  /** valores realizados por mês (0-11) em centavos */
  months: number[];
  /** previsão por mês (parcelas futuras + despesas fixas), em centavos */
  projected: number[];
  /** total do ano: realizado + previsão */
  total: number;
  average: number;
};

export interface DreData {
  year: number;
  rows: DreRow[];
  /** subtotais nomeados para os KPIs (apenas realizado) */
  totals: Record<string, number[]>;
  unclassifiedCount: number;
  /** primeiro mês (0-11) considerado "futuro"; 12 = nenhum mês futuro no ano */
  firstFutureMonth: number;
  hasProjections: boolean;
}

const zero = () => new Array(12).fill(0) as number[];
const add = (a: number[], b: number[]) => a.map((v, i) => v + b[i]);

/**
 * Calcula as previsões dos meses futuros do ano selecionado:
 * - Parceladas: para cada compra com "parcela N/T" (N < T), as parcelas
 *   restantes são lançadas nos meses seguintes com o mesmo valor. Se o mês
 *   futuro já tem lançamentos reais daquela conta bancária (fatura importada),
 *   a projeção daquele mês é pulada para não duplicar.
 * - Fixas: para cada conta do DRE, a média mensal dos lançamentos marcados
 *   como "fixa mensal" nos últimos 12 meses é repetida nos meses futuros.
 */
async function computeProjections(
  year: number,
  firstFutureMonth: number
): Promise<Map<string, number[]>> {
  const proj = new Map<string, number[]>();
  if (firstFutureMonth >= 12) return proj;
  const bump = (accountId: string, month: number, cents: number) => {
    const arr = proj.get(accountId) ?? zero();
    arr[month] += cents;
    proj.set(accountId, arr);
  };

  // meses do ano que já têm movimento real por conta bancária
  // (usado para não projetar parcela em fatura já importada)
  const realInYear = await prisma.transaction.findMany({
    where: {
      date: { gte: new Date(Date.UTC(year, 0, 1)), lt: new Date(Date.UTC(year + 1, 0, 1)) },
    },
    select: { bankAccountId: true, date: true },
  });
  const bankMonthHasData = new Set(
    realInYear.map((t) => `${t.bankAccountId}:${t.date.getUTCMonth()}`)
  );

  // ---- parceladas: compras dos últimos 24 meses com parcelas em aberto
  const installments = await prisma.transaction.findMany({
    where: {
      accountId: { not: null },
      installmentNum: { not: null },
      installmentTotal: { not: null },
      date: { gte: new Date(Date.UTC(year - 2, 0, 1)), lt: new Date(Date.UTC(year + 1, 0, 1)) },
    },
    select: {
      accountId: true,
      bankAccountId: true,
      date: true,
      amountCents: true,
      installmentNum: true,
      installmentTotal: true,
    },
  });
  for (const t of installments) {
    const remaining = (t.installmentTotal ?? 0) - (t.installmentNum ?? 0);
    if (remaining <= 0) continue;
    for (let k = 1; k <= remaining; k++) {
      const d = new Date(Date.UTC(t.date.getUTCFullYear(), t.date.getUTCMonth() + k, 1));
      if (d.getUTCFullYear() !== year) continue;
      const m = d.getUTCMonth();
      if (m < firstFutureMonth) continue; // mês fechado: vale o realizado
      if (bankMonthHasData.has(`${t.bankAccountId}:${m}`)) continue; // fatura já importada
      bump(t.accountId!, m, t.amountCents);
    }
  }

  // ---- fixas: média mensal dos lançamentos marcados nos últimos 12 meses
  const now = new Date();
  const lookbackStart = new Date(Date.UTC(now.getUTCFullYear() - 1, now.getUTCMonth(), 1));
  const recurring = await prisma.transaction.findMany({
    where: { recurring: true, accountId: { not: null }, date: { gte: lookbackStart } },
    select: { accountId: true, date: true, amountCents: true },
  });
  // soma por conta e por mês-calendário distinto
  const byAcc = new Map<string, Map<string, number>>();
  for (const t of recurring) {
    const key = `${t.date.getUTCFullYear()}-${t.date.getUTCMonth()}`;
    const inner = byAcc.get(t.accountId!) ?? new Map<string, number>();
    inner.set(key, (inner.get(key) ?? 0) + t.amountCents);
    byAcc.set(t.accountId!, inner);
  }
  for (const [accountId, monthsMap] of byAcc) {
    const values = [...monthsMap.values()];
    const avg = Math.round(values.reduce((s, v) => s + v, 0) / values.length);
    if (avg === 0) continue;
    for (let m = firstFutureMonth; m < 12; m++) {
      bump(accountId, m, avg);
    }
  }

  return proj;
}

export async function computeDre(
  year: number,
  opts: { projections?: boolean } = {}
): Promise<DreData> {
  const start = new Date(Date.UTC(year, 0, 1));
  const end = new Date(Date.UTC(year + 1, 0, 1));

  // primeiro mês "futuro" do ano selecionado (mês corrente ainda é considerado
  // em aberto/realizado; futuro = meses seguintes)
  const now = new Date();
  const currentYear = now.getUTCFullYear();
  const firstFutureMonth =
    year < currentYear ? 12 : year > currentYear ? 0 : now.getUTCMonth() + 1;

  const accounts = await prisma.dreAccount.findMany({
    where: { active: true },
    orderBy: { sortOrder: "asc" },
  });

  const tx = await prisma.transaction.findMany({
    where: { date: { gte: start, lt: end }, accountId: { not: null } },
    select: { accountId: true, date: true, amountCents: true },
  });

  const unclassifiedCount = await prisma.transaction.count({
    where: { date: { gte: start, lt: end }, accountId: null },
  });

  const projections = opts.projections
    ? await computeProjections(year, firstFutureMonth)
    : new Map<string, number[]>();

  // soma por conta/mês (realizado)
  const byAccount = new Map<string, number[]>();
  for (const t of tx) {
    const arr = byAccount.get(t.accountId!) ?? zero();
    arr[t.date.getUTCMonth()] += t.amountCents;
    byAccount.set(t.accountId!, arr);
  }

  const rows: DreRow[] = [];
  const totals: Record<string, number[]> = {};
  let running = zero();
  let runningProj = zero();
  const groupSums: Record<string, number[]> = {};

  const mkRow = (
    kind: DreRow["kind"],
    label: string,
    months: number[],
    projected: number[],
    code?: string,
    extra?: { accountId?: string; groupKey?: string }
  ): DreRow => {
    const total = months.reduce((s, v) => s + v, 0) + projected.reduce((s, v) => s + v, 0);
    return { kind, label, code, ...extra, months, projected, total, average: Math.round(total / 12) };
  };

  let hasProjections = false;
  for (const g of GROUPS) {
    const groupAccounts = accounts.filter((a) => a.group === g.key);
    let groupSum = zero();
    let groupProj = zero();
    rows.push(mkRow("group", g.title, zero(), zero()));
    for (const a of groupAccounts) {
      const months = byAccount.get(a.id) ?? zero();
      const projected = projections.get(a.id) ?? zero();
      if (projected.some((v) => v !== 0)) hasProjections = true;
      groupSum = add(groupSum, months);
      groupProj = add(groupProj, projected);
      rows.push(mkRow("account", a.name, months, projected, a.code, { accountId: a.id }));
    }
    groupSums[g.key] = groupSum;
    running = add(running, groupSum);
    runningProj = add(runningProj, groupProj);
    if (g.subtotal) {
      const values = g.subtotalScope === "group" ? [...groupSum] : [...running];
      const projValues = g.subtotalScope === "group" ? [...groupProj] : [...runningProj];
      rows.push(
        mkRow("subtotal", g.subtotal, values, projValues, undefined, {
          groupKey: g.subtotalScope === "group" ? g.key : undefined,
        })
      );
      totals[g.subtotal] = values;
    }
  }
  for (const [k, v] of Object.entries(groupSums)) totals[`GRUPO:${k}`] = v;

  return { year, rows, totals, unclassifiedCount, firstFutureMonth, hasProjections };
}
