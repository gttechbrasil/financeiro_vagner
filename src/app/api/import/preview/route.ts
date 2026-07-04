import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { detectAndParse } from "@/lib/parsers";
import { buildClassifier } from "@/lib/rules";
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

  const rows = result.rows.map((r, i) => {
    const c = classify(r.description);
    return {
      ...r,
      hash: hashes[i],
      duplicate: existingSet.has(hashes[i]),
      accountId: c.accountId,
      sectorId: c.sectorId,
      unitId: c.unitId,
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
