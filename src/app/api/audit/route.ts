import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/** Resumo de auditoria: lançamentos sem conta do DRE (todos os anos). */
export async function GET() {
  const pending = await prisma.transaction.findMany({
    where: { accountId: null },
    select: { date: true, bankAccountId: true },
  });
  const banks = await prisma.bankAccount.findMany({ select: { id: true, name: true } });
  const bankNames = new Map(banks.map((b) => [b.id, b.name]));

  const byYear = new Map<number, number>();
  const byBank = new Map<string, number>();
  for (const t of pending) {
    const y = t.date.getUTCFullYear();
    byYear.set(y, (byYear.get(y) ?? 0) + 1);
    byBank.set(t.bankAccountId, (byBank.get(t.bankAccountId) ?? 0) + 1);
  }

  return NextResponse.json({
    unclassified: pending.length,
    byYear: [...byYear.entries()]
      .map(([year, count]) => ({ year, count }))
      .sort((a, b) => b.year - a.year),
    byBank: [...byBank.entries()]
      .map(([id, count]) => ({ id, name: bankNames.get(id) ?? "?", count }))
      .sort((a, b) => b.count - a.count),
  });
}
