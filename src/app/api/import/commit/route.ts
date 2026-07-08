import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { txHash } from "@/lib/hash";

export const runtime = "nodejs";

interface CommitRow {
  date: string;
  description: string;
  amountCents: number;
  externalId?: string;
  accountId?: string | null;
  sectorId?: string | null;
  unitId?: string | null;
  installmentNum?: number | null;
  installmentTotal?: number | null;
}

export async function POST(req: NextRequest) {
  // multipart (payload JSON + arquivo original) ou JSON puro (compatibilidade)
  let body: { bankAccountId: string; fileName: string; source: string; rows: CommitRow[] };
  let fileData: Uint8Array<ArrayBuffer> | null = null;
  let fileMime: string | null = null;
  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    body = JSON.parse(form.get("payload") as string);
    const file = form.get("file") as File | null;
    if (file) {
      fileData = new Uint8Array(await file.arrayBuffer());
      fileMime = file.type || "application/octet-stream";
    }
  } else {
    body = await req.json();
  }
  if (!body.bankAccountId || !Array.isArray(body.rows) || body.rows.length === 0) {
    return NextResponse.json({ error: "Nada para importar" }, { status: 400 });
  }

  const hashes = body.rows.map((r) =>
    txHash(body.bankAccountId, r.date, r.amountCents, r.description, r.externalId)
  );
  const existing = await prisma.transaction.findMany({
    where: { hash: { in: hashes } },
    select: { hash: true },
  });
  const existingSet = new Set(existing.map((e) => e.hash));

  const batch = await prisma.importBatch.create({
    data: { fileName: body.fileName, source: body.source, fileData, fileMime },
  });

  let imported = 0;
  let skipped = 0;
  const data: {
    date: Date;
    description: string;
    amountCents: number;
    bankAccountId: string;
    accountId: string | null;
    sectorId: string | null;
    unitId: string | null;
    importBatchId: string;
    externalId: string | null;
    hash: string;
    installmentNum: number | null;
    installmentTotal: number | null;
  }[] = [];

  const seen = new Set<string>();
  body.rows.forEach((r, i) => {
    const h = hashes[i];
    if (existingSet.has(h) || seen.has(h)) {
      skipped++;
      return;
    }
    seen.add(h);
    data.push({
      date: new Date(r.date + "T00:00:00Z"),
      description: r.description,
      amountCents: r.amountCents,
      bankAccountId: body.bankAccountId,
      accountId: r.accountId ?? null,
      sectorId: r.sectorId ?? null,
      unitId: r.unitId ?? null,
      importBatchId: batch.id,
      externalId: r.externalId ?? null,
      hash: h,
      installmentNum: r.installmentNum ?? null,
      installmentTotal: r.installmentTotal ?? null,
    });
    imported++;
  });

  if (data.length > 0) {
    await prisma.transaction.createMany({ data });
  } else {
    await prisma.importBatch.delete({ where: { id: batch.id } });
  }

  return NextResponse.json({ imported, skipped, batchId: data.length > 0 ? batch.id : null });
}
