import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * Relatórios agregados.
 * GET /api/reports?by=account|supplier|sector|unit|bank|hierarchy&year=&month=
 * - account:   total por conta do DRE (categoria)
 * - supplier:  total por fornecedor
 * - sector:    total por setor
 * - unit:      total por unidade
 * - bank:      total por origem (conta bancária/cartão)
 * - hierarchy: Conta DRE → Fornecedor → totais (drill-down até os lançamentos)
 */
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const by = p.get("by") ?? "account";
  const year = Number(p.get("year")) || new Date().getFullYear();
  const month = Number(p.get("month")) || 0; // 1-12; 0 = ano inteiro

  const date =
    month > 0
      ? { gte: new Date(Date.UTC(year, month - 1, 1)), lt: new Date(Date.UTC(year, month, 1)) }
      : { gte: new Date(Date.UTC(year, 0, 1)), lt: new Date(Date.UTC(year + 1, 0, 1)) };

  if (by === "hierarchy") {
    const txs = await prisma.transaction.findMany({
      where: { date, accountId: { not: null } },
      select: { accountId: true, supplierId: true, amountCents: true },
    });
    const [accounts, suppliers] = await Promise.all([
      prisma.dreAccount.findMany({ orderBy: { sortOrder: "asc" } }),
      prisma.supplier.findMany(),
    ]);
    const accMap = new Map(accounts.map((a) => [a.id, a]));
    const supMap = new Map(suppliers.map((s) => [s.id, s]));
    // conta → fornecedor → {sum, count}
    const tree = new Map<string, Map<string, { sumCents: number; count: number }>>();
    for (const t of txs) {
      const inner = tree.get(t.accountId!) ?? new Map();
      const supKey = t.supplierId ?? "";
      const cur = inner.get(supKey) ?? { sumCents: 0, count: 0 };
      cur.sumCents += t.amountCents;
      cur.count += 1;
      inner.set(supKey, cur);
      tree.set(t.accountId!, inner);
    }
    const result = [...tree.entries()]
      .map(([accountId, supRows]) => {
        const acc = accMap.get(accountId);
        const rows = [...supRows.entries()]
          .map(([supplierId, v]) => ({
            supplierId: supplierId || null,
            supplierName: supplierId ? supMap.get(supplierId)?.name ?? "?" : "Sem fornecedor",
            ...v,
          }))
          .sort((a, b) => Math.abs(b.sumCents) - Math.abs(a.sumCents));
        return {
          accountId,
          code: acc?.code ?? "",
          name: acc?.name ?? "?",
          group: acc?.group ?? "",
          sortOrder: acc?.sortOrder ?? 999,
          sumCents: rows.reduce((s, r) => s + r.sumCents, 0),
          count: rows.reduce((s, r) => s + r.count, 0),
          suppliers: rows,
        };
      })
      .sort((a, b) => a.sortOrder - b.sortOrder);
    return NextResponse.json({ year, month, rows: result });
  }

  const field =
    by === "supplier"
      ? "supplierId"
      : by === "sector"
        ? "sectorId"
        : by === "unit"
          ? "unitId"
          : by === "bank"
            ? "bankAccountId"
            : "accountId";

  const grouped = await prisma.transaction.groupBy({
    by: [field as "accountId"],
    where: { date },
    _sum: { amountCents: true },
    _count: { _all: true },
  });

  // resolve nomes
  const ids = grouped.map((g) => g[field as "accountId"]).filter(Boolean) as string[];
  let names = new Map<string, string>();
  if (by === "supplier") {
    const rows = await prisma.supplier.findMany({ where: { id: { in: ids } } });
    names = new Map(rows.map((r) => [r.id, r.name]));
  } else if (by === "sector") {
    const rows = await prisma.sector.findMany({ where: { id: { in: ids } } });
    names = new Map(rows.map((r) => [r.id, r.name]));
  } else if (by === "unit") {
    const rows = await prisma.unit.findMany({ where: { id: { in: ids } } });
    names = new Map(rows.map((r) => [r.id, r.name]));
  } else if (by === "bank") {
    const rows = await prisma.bankAccount.findMany({ where: { id: { in: ids } } });
    names = new Map(rows.map((r) => [r.id, r.name]));
  } else {
    const rows = await prisma.dreAccount.findMany({ where: { id: { in: ids } } });
    names = new Map(rows.map((r) => [r.id, `${r.code} ${r.name}`]));
  }

  const result = grouped
    .map((g) => {
      const id = g[field as "accountId"] as string | null;
      return {
        id,
        name: id ? names.get(id) ?? "?" : by === "supplier" ? "Sem fornecedor" : "Sem classificação",
        sumCents: g._sum.amountCents ?? 0,
        count: g._count._all,
      };
    })
    .sort((a, b) => Math.abs(b.sumCents) - Math.abs(a.sumCents));

  return NextResponse.json({ year, month, by, rows: result });
}
