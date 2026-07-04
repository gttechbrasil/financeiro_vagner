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
  /** valores por mês (0-11) em centavos */
  months: number[];
  total: number;
  average: number;
};

export interface DreData {
  year: number;
  rows: DreRow[];
  /** subtotais nomeados para os KPIs */
  totals: Record<string, number[]>;
  unclassifiedCount: number;
}

export async function computeDre(year: number): Promise<DreData> {
  const start = new Date(Date.UTC(year, 0, 1));
  const end = new Date(Date.UTC(year + 1, 0, 1));

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

  // soma por conta/mês
  const byAccount = new Map<string, number[]>();
  for (const t of tx) {
    const arr = byAccount.get(t.accountId!) ?? new Array(12).fill(0);
    arr[t.date.getUTCMonth()] += t.amountCents;
    byAccount.set(t.accountId!, arr);
  }

  const zero = () => new Array(12).fill(0) as number[];
  const add = (a: number[], b: number[]) => a.map((v, i) => v + b[i]);

  const rows: DreRow[] = [];
  const totals: Record<string, number[]> = {};
  let running = zero(); // acumulado que gera os subtotais em cascata
  const groupSums: Record<string, number[]> = {};

  const mkRow = (kind: DreRow["kind"], label: string, months: number[], code?: string): DreRow => {
    const total = months.reduce((s, v) => s + v, 0);
    return { kind, label, code, months, total, average: Math.round(total / 12) };
  };

  for (const g of GROUPS) {
    const groupAccounts = accounts.filter((a) => a.group === g.key);
    let groupSum = zero();
    rows.push(mkRow("group", g.title, zero()));
    for (const a of groupAccounts) {
      const months = byAccount.get(a.id) ?? zero();
      groupSum = add(groupSum, months);
      rows.push(mkRow("account", a.name, months, a.code));
    }
    groupSums[g.key] = groupSum;
    running = add(running, groupSum);
    if (g.subtotal) {
      const values = g.subtotalScope === "group" ? [...groupSum] : [...running];
      rows.push(mkRow("subtotal", g.subtotal, values));
      totals[g.subtotal] = values;
    }
  }
  for (const [k, v] of Object.entries(groupSums)) totals[`GRUPO:${k}`] = v;

  return { year, rows, totals, unclassifiedCount };
}
