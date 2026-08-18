import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const suppliers = await prisma.supplier.findMany({
    orderBy: { name: "asc" },
    include: {
      defaultAccount: { select: { code: true, name: true } },
      defaultSector: { select: { name: true } },
      defaultUnit: { select: { name: true } },
      _count: { select: { transactions: true } },
    },
  });
  return NextResponse.json(suppliers);
}

export async function POST(req: NextRequest) {
  const b = await req.json();
  if (!b.name) return NextResponse.json({ error: "Informe o nome do fornecedor" }, { status: 400 });
  try {
    const supplier = await prisma.supplier.create({
      data: {
        name: b.name,
        pattern: b.pattern || null,
        defaultAccountId: b.defaultAccountId || null,
        defaultSectorId: b.defaultSectorId || null,
        defaultUnitId: b.defaultUnitId || null,
      },
    });
    return NextResponse.json(supplier);
  } catch {
    return NextResponse.json({ error: "Já existe um fornecedor com esse nome" }, { status: 409 });
  }
}

export async function PATCH(req: NextRequest) {
  const b = await req.json();
  if (!b.id) return NextResponse.json({ error: "Informe id" }, { status: 400 });
  const data: Record<string, unknown> = {};
  for (const k of ["name", "pattern", "defaultAccountId", "defaultSectorId", "defaultUnitId", "active"]) {
    if (k in b) data[k] = b[k] === "" ? null : b[k];
  }
  const supplier = await prisma.supplier.update({ where: { id: b.id }, data });
  return NextResponse.json(supplier);
}

export async function DELETE(req: NextRequest) {
  const b = await req.json();
  if (!b.id) return NextResponse.json({ error: "Informe id" }, { status: 400 });
  // desvincula as transações antes de excluir
  await prisma.transaction.updateMany({ where: { supplierId: b.id }, data: { supplierId: null } });
  await prisma.supplier.delete({ where: { id: b.id } });
  return NextResponse.json({ ok: true });
}
