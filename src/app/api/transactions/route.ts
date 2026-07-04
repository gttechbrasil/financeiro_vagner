import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { txHash } from "@/lib/hash";

const PAGE_SIZE = 100;

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const where: Record<string, unknown> = {};

  const year = p.get("year");
  const month = p.get("month"); // 1-12
  if (year) {
    const y = Number(year);
    if (month) {
      const m = Number(month) - 1;
      where.date = { gte: new Date(Date.UTC(y, m, 1)), lt: new Date(Date.UTC(y, m + 1, 1)) };
    } else {
      where.date = { gte: new Date(Date.UTC(y, 0, 1)), lt: new Date(Date.UTC(y + 1, 0, 1)) };
    }
  }
  if (p.get("bankAccountId")) where.bankAccountId = p.get("bankAccountId");
  if (p.get("accountId")) where.accountId = p.get("accountId");
  if (p.get("sectorId")) where.sectorId = p.get("sectorId");
  if (p.get("unitId")) where.unitId = p.get("unitId");
  if (p.get("unclassified") === "1") where.accountId = null;
  const q = p.get("q");
  if (q) where.description = { contains: q };

  const page = Math.max(1, Number(p.get("page") ?? 1));
  const [total, items, sum] = await Promise.all([
    prisma.transaction.count({ where }),
    prisma.transaction.findMany({
      where,
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        account: { select: { code: true, name: true } },
        sector: { select: { name: true } },
        unit: { select: { name: true } },
        bankAccount: { select: { name: true } },
      },
    }),
    prisma.transaction.aggregate({ where, _sum: { amountCents: true } }),
  ]);

  return NextResponse.json({
    total,
    page,
    pageSize: PAGE_SIZE,
    sumCents: sum._sum.amountCents ?? 0,
    items,
  });
}

/** Lançamento manual */
export async function POST(req: NextRequest) {
  const b = await req.json();
  if (!b.date || !b.description || typeof b.amountCents !== "number" || !b.bankAccountId) {
    return NextResponse.json({ error: "Campos obrigatórios: data, descrição, valor, conta" }, { status: 400 });
  }
  const hash = txHash(b.bankAccountId, b.date, b.amountCents, b.description, `manual-${Date.now()}`);
  const tx = await prisma.transaction.create({
    data: {
      date: new Date(b.date + "T00:00:00Z"),
      description: b.description,
      amountCents: b.amountCents,
      bankAccountId: b.bankAccountId,
      accountId: b.accountId ?? null,
      sectorId: b.sectorId ?? null,
      unitId: b.unitId ?? null,
      notes: b.notes ?? null,
      hash,
    },
  });
  return NextResponse.json(tx);
}

/** Atualização em lote (classificação) ou individual */
export async function PATCH(req: NextRequest) {
  const b = await req.json();
  const ids: string[] = b.ids ?? [];
  if (ids.length === 0) return NextResponse.json({ error: "Informe ids" }, { status: 400 });

  const data: Record<string, unknown> = {};
  for (const k of ["accountId", "sectorId", "unitId", "notes"]) {
    if (k in b) data[k] = b[k];
  }
  if (ids.length === 1) {
    if ("description" in b) data.description = b.description;
    if ("amountCents" in b) data.amountCents = b.amountCents;
    if ("date" in b) data.date = new Date(b.date + "T00:00:00Z");
  }
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nada para atualizar" }, { status: 400 });
  }
  const r = await prisma.transaction.updateMany({ where: { id: { in: ids } }, data });
  return NextResponse.json({ updated: r.count });
}

export async function DELETE(req: NextRequest) {
  const b = await req.json();
  const ids: string[] = b.ids ?? [];
  if (ids.length === 0) return NextResponse.json({ error: "Informe ids" }, { status: 400 });
  const r = await prisma.transaction.deleteMany({ where: { id: { in: ids } } });
  return NextResponse.json({ deleted: r.count });
}
