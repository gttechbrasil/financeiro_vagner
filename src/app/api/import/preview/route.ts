import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { detectAndParse } from "@/lib/parsers";
import { buildClassifier, classifyFromHistory } from "@/lib/rules";
import { txHash } from "@/lib/hash";

export const runtime = "nodejs";
export const maxDuration = 300; // extração por IA pode demorar

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const file = form.get("file") as File | null;
  const bankAccountId = form.get("bankAccountId") as string | null;
  if (!file || !bankAccountId) {
    return NextResponse.json({ error: "Envie o arquivo e a conta de origem" }, { status: 400 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  let result;
  try {
    result = await detectAndParse(file.name, buf);
  } catch (e) {
    console.error("Erro ao processar arquivo:", e);
    return NextResponse.json(
      { error: `Erro ao processar o arquivo: ${e instanceof Error ? e.message : "desconhecido"}` },
      { status: 422 }
    );
  }

  const classify = await buildClassifier();

  // marca duplicados já existentes no banco
  const hashes = result.rows.map((r) =>
    txHash(bankAccountId, r.date, r.amountCents, r.description, r.externalId)
  );
  const existing = await prisma.transaction.findMany({
    where: { hash: { in: hashes } },
    select: { hash: true },
  });
  const existingSet = new Set(existing.map((e) => e.hash));

  // classificação por histórico: repete a classificação mais recente de
  // lançamentos com a mesma descrição (fornecedor já classificado antes)
  const history = await classifyFromHistory(result.rows.map((r) => r.description));

  const rows = result.rows.map((r, i) => {
    const c = classify(r.description, r.rawType);
    const h = c.accountId ? null : history.get(r.description) ?? null;
    return {
      ...r,
      hash: hashes[i],
      duplicate: existingSet.has(hashes[i]),
      accountId: c.accountId ?? h?.accountId ?? null,
      sectorId: c.sectorId ?? h?.sectorId ?? null,
      unitId: c.unitId ?? h?.unitId ?? null,
      supplierId: c.supplierId ?? h?.supplierId ?? null,
      suggestedBy: c.accountId ? c.suggestedBy : h ? "histórico" : null,
    };
  });

  return NextResponse.json({
    source: result.source,
    sourceLabel: result.sourceLabel,
    warnings: result.warnings,
    fileName: file.name,
    rows,
  });
}
