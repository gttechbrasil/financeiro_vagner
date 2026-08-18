import { prisma } from "@/lib/db";

export interface Classification {
  accountId: string | null;
  sectorId: string | null;
  unitId: string | null;
  ruleId: string | null;
  supplierId: string | null;
  /** origem da classificação sugerida (para exibir na importação) */
  suggestedBy: "regra" | "fornecedor" | null;
}

/**
 * Carrega regras e fornecedores ativos e devolve uma função que classifica
 * pela descrição (e, quando houver, pelo tipo de transação do extrato — ex.:
 * "Taxa de boleto" do Asaas). Ordem: regra mais prioritária → classificação
 * padrão do fornecedor detectado.
 */
export async function buildClassifier() {
  const [rules, suppliers] = await Promise.all([
    prisma.rule.findMany({ where: { active: true }, orderBy: { priority: "desc" } }),
    prisma.supplier.findMany({ where: { active: true } }),
  ]);
  const preparedRules = rules.map((r) => ({ ...r, patternLower: r.pattern.toLowerCase() }));
  const preparedSuppliers = suppliers.map((s) => ({
    ...s,
    patternLower: (s.pattern || s.name).toLowerCase(),
  }));

  return function classify(description: string, rawType?: string): Classification {
    const desc = rawType ? `${description} ${rawType}`.toLowerCase() : description.toLowerCase();
    const supplier = preparedSuppliers.find((s) => desc.includes(s.patternLower)) ?? null;
    for (const r of preparedRules) {
      if (desc.includes(r.patternLower)) {
        return {
          accountId: r.accountId,
          sectorId: r.sectorId,
          unitId: r.unitId,
          ruleId: r.id,
          supplierId: supplier?.id ?? null,
          suggestedBy: "regra",
        };
      }
    }
    if (supplier?.defaultAccountId) {
      return {
        accountId: supplier.defaultAccountId,
        sectorId: supplier.defaultSectorId,
        unitId: supplier.defaultUnitId,
        ruleId: null,
        supplierId: supplier.id,
        suggestedBy: "fornecedor",
      };
    }
    return {
      accountId: null,
      sectorId: null,
      unitId: null,
      ruleId: null,
      supplierId: supplier?.id ?? null,
      suggestedBy: null,
    };
  };
}

export interface HistoryClassification {
  accountId: string;
  sectorId: string | null;
  unitId: string | null;
  supplierId: string | null;
}

/**
 * Classificação por histórico: para cada descrição, devolve a classificação
 * do lançamento mais recente com a MESMA descrição que já tenha conta do DRE.
 * Usado na importação para repetir a classificação de fornecedores já vistos.
 */
export async function classifyFromHistory(
  descriptions: string[]
): Promise<Map<string, HistoryClassification>> {
  const map = new Map<string, HistoryClassification>();
  const uniq = [...new Set(descriptions)].filter(Boolean);
  if (uniq.length === 0) return map;
  const txs = await prisma.transaction.findMany({
    where: { description: { in: uniq }, accountId: { not: null } },
    orderBy: { date: "desc" },
    select: { description: true, accountId: true, sectorId: true, unitId: true, supplierId: true },
  });
  for (const t of txs) {
    if (!map.has(t.description)) {
      map.set(t.description, {
        accountId: t.accountId!,
        sectorId: t.sectorId,
        unitId: t.unitId,
        supplierId: t.supplierId,
      });
    }
  }
  return map;
}
