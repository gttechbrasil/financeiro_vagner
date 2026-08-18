import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * Aplica os fornecedores retroativamente:
 * 1. vincula ao fornecedor os lançamentos cuja descrição contém o padrão;
 * 2. classifica com a conta/setor/unidade padrão do fornecedor os lançamentos
 *    vinculados que ainda estão sem conta do DRE.
 */
export async function POST() {
  const suppliers = await prisma.supplier.findMany({ where: { active: true } });
  let linked = 0;
  let classified = 0;
  for (const s of suppliers) {
    const pattern = s.pattern || s.name;
    const r = await prisma.transaction.updateMany({
      where: { supplierId: null, description: { contains: pattern } },
      data: { supplierId: s.id },
    });
    linked += r.count;
    if (s.defaultAccountId) {
      const data: Record<string, unknown> = { accountId: s.defaultAccountId };
      if (s.defaultSectorId) data.sectorId = s.defaultSectorId;
      if (s.defaultUnitId) data.unitId = s.defaultUnitId;
      const c = await prisma.transaction.updateMany({
        where: { supplierId: s.id, accountId: null },
        data,
      });
      classified += c.count;
    }
  }
  return NextResponse.json({ linked, classified });
}
