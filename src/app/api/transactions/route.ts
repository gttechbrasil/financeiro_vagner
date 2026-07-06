import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { txHash } from "@/lib/hash";

const PAGE_SIZE = 100;

/** Monta o where a partir dos filtros da tela (query string ou corpo). */
function buildWhere(get: (k: string) => string | null | undefined): Record<string, unknown> {
  const where: Record<string, unknown> = {};
  const year = get("year");
  const month = get("month"); // 1-12
  if (year) {
    const y = Number(year);
    if (month) {
      const m = Number(month) - 1;
      where.date = { gte: new Date(Date.UTC(y, m, 1)), lt: new Date(Date.UTC(y, m + 1, 1)) };
    } else {
      where.date = { gte: new Date(Date.UTC(y, 0, 1)), lt: new Date(Date.UTC(y + 1, 0, 1)) };
    }
  }
  if (get("bankAccountId")) where.bankAccountId = get("bankAccountId");
  if (get("accountId")) where.accountId = get("accountId");
  if (get("sectorId")) where.sectorId = get("sectorId");
  if (get("unitId")) where.unitId = get("unitId");
  if (get("unclassified") === "1") where.accountId = null;
  const q = get("q");
  if (q) where.description = { contains: q };
  return where;
}

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const where = buildWhere((k) => p.get(k));
  const page = Math.max(1, Number(p.get("page") ?? 1));
  const [total, items, sumIn, sumOut] = await Promise.all([
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
    prisma.transaction.aggregate({
      where: { ...where, amountCents: { gt: 0 } },
      _sum: { amountCents: true },
    }),
    prisma.transaction.aggregate({
      where: { ...where, amountCents: { lt: 0 } },
      _sum: { amountCents: true },
    }),
  ]);

  const inCents = sumIn._sum.amountCents ?? 0;
  const outCents = sumOut._sum.amountCents ?? 0;
  return NextResponse.json({
    total,
    page,
    pageSize: PAGE_SIZE,
    inCents,
    outCents,
    sumCents: inCents + outCents,
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

/** Atualização em lote (classificação) ou individual.
 *  Aceita `ids` (lista de transações) OU `filter` (aplica a TODOS os
 *  lançamentos que casam com os mesmos filtros da listagem). */
export async function PATCH(req: NextRequest) {
  const b = await req.json();
  const ids: string[] = b.ids ?? [];
  const filter = b.filter as Record<string, string> | undefined;
  if (ids.length === 0 && !filter) {
    return NextResponse.json({ error: "Informe ids ou filter" }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  for (const k of ["accountId", "sectorId", "unitId", "notes", "recurring"]) {
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

  const where =
    ids.length > 0 ? { id: { in: ids } } : buildWhere((k) => filter?.[k]);
  if (ids.length === 0 && Object.keys(where).length === 0) {
    return NextResponse.json(
      { error: "Filtro vazio: selecione ao menos um filtro para aplicar em massa" },
      { status: 400 }
    );
  }
  const r = await prisma.transaction.updateMany({ where, data });
  return NextResponse.json({ updated: r.count });
}

export async function DELETE(req: NextRequest) {
  const b = await req.json();
  const ids: string[] = b.ids ?? [];
  if (ids.length === 0) return NextResponse.json({ error: "Informe ids" }, { status: 400 });
  const r = await prisma.transaction.deleteMany({ where: { id: { in: ids } } });
  return NextResponse.json({ deleted: r.count });
}
