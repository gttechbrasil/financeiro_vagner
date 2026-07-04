import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const rules = await prisma.rule.findMany({
    orderBy: [{ priority: "desc" }, { pattern: "asc" }],
    include: {
      account: { select: { code: true, name: true } },
      sector: { select: { name: true } },
      unit: { select: { name: true } },
    },
  });
  return NextResponse.json(rules);
}

export async function POST(req: NextRequest) {
  const b = await req.json();
  if (!b.pattern || !b.accountId) {
    return NextResponse.json({ error: "Informe o padrão e a conta do DRE" }, { status: 400 });
  }
  const rule = await prisma.rule.create({
    data: {
      pattern: b.pattern,
      accountId: b.accountId,
      sectorId: b.sectorId ?? null,
      unitId: b.unitId ?? null,
      priority: b.priority ?? 0,
    },
  });
  return NextResponse.json(rule);
}

export async function PATCH(req: NextRequest) {
  const b = await req.json();
  if (!b.id) return NextResponse.json({ error: "Informe id" }, { status: 400 });
  const data: Record<string, unknown> = {};
  for (const k of ["pattern", "accountId", "sectorId", "unitId", "priority", "active"]) {
    if (k in b) data[k] = b[k];
  }
  const rule = await prisma.rule.update({ where: { id: b.id }, data });
  return NextResponse.json(rule);
}

export async function DELETE(req: NextRequest) {
  const b = await req.json();
  if (!b.id) return NextResponse.json({ error: "Informe id" }, { status: 400 });
  await prisma.rule.delete({ where: { id: b.id } });
  return NextResponse.json({ ok: true });
}
