import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const batches = await prisma.importBatch.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { transactions: true } } },
  });
  return NextResponse.json(batches);
}

/** Desfaz uma importação (apaga o lote e suas transações em cascata). */
export async function DELETE(req: NextRequest) {
  const b = await req.json();
  if (!b.id) return NextResponse.json({ error: "Informe id" }, { status: 400 });
  await prisma.importBatch.delete({ where: { id: b.id } });
  return NextResponse.json({ ok: true });
}
