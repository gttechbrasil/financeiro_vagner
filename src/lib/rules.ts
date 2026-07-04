import { prisma } from "@/lib/db";

export interface Classification {
  accountId: string | null;
  sectorId: string | null;
  unitId: string | null;
  ruleId: string | null;
}

/** Carrega as regras ativas e devolve uma função que classifica pela descrição. */
export async function buildClassifier() {
  const rules = await prisma.rule.findMany({
    where: { active: true },
    orderBy: { priority: "desc" },
  });
  const prepared = rules.map((r) => ({ ...r, patternLower: r.pattern.toLowerCase() }));

  return function classify(description: string): Classification {
    const desc = description.toLowerCase();
    for (const r of prepared) {
      if (desc.includes(r.patternLower)) {
        return { accountId: r.accountId, sectorId: r.sectorId, unitId: r.unitId, ruleId: r.id };
      }
    }
    return { accountId: null, sectorId: null, unitId: null, ruleId: null };
  };
}
