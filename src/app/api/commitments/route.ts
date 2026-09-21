import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * Previstos (compromissos de contas a pagar/receber).
 * GET    /api/commitments            → lista (ativos primeiro)
 * POST   /api/commitments            → cria
 * PATCH  /api/commitments  { id, ...campos }
 * DELETE /api/commitments  { id }
 */

const include = {
  bankAccount: { select: { name: true } },
  account: { select: { code: true, name: true } },
  supplier: { select: { name: true } },
};

export async function GET() {
  const rows = await prisma.commitment.findMany({
    include,
    orderBy: [{ active: "desc" }, { dueDay: "asc" }, { description: "asc" }],
  });
  return NextResponse.json(rows);
}

type Body = {
  id?: string;
  description?: string;
  amountCents?: number;
  dueDay?: number;
  /** yyyy-mm (mês da primeira ocorrência) ou yyyy-mm-dd */
  startDate?: string;
  installments?: number | null;
  pattern?: string | null;
  bankAccountId?: string | null;
  accountId?: string | null;
  supplierId?: string | null;
  active?: boolean;
  notes?: string | null;
};

function parseStart(raw: string | undefined): Date | null | undefined {
  if (raw === undefined) return undefined;
  const m = raw.match(/^(\d{4})-(\d{2})/);
  if (!m) return null;
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, 1));
}

function validate(b: Body, partial: boolean): string | null {
  if (!partial || "description" in b) {
    if (!b.description?.trim()) return "Informe a descrição";
  }
  if (!partial || "amountCents" in b) {
    if (typeof b.amountCents !== "number" || !Number.isInteger(b.amountCents) || b.amountCents === 0) {
      return "Informe o valor (negativo = a pagar, positivo = a receber)";
    }
  }
  if (!partial || "dueDay" in b) {
    if (typeof b.dueDay !== "number" || b.dueDay < 1 || b.dueDay > 31) return "Dia do vencimento deve ser de 1 a 31";
  }
  if (!partial || "startDate" in b) {
    if (parseStart(b.startDate) === null || (!partial && !b.startDate)) return "Informe o mês da primeira ocorrência";
  }
  if ("installments" in b && b.installments != null) {
    if (!Number.isInteger(b.installments) || b.installments < 1) return "Nº de parcelas inválido";
  }
  return null;
}

function toData(b: Body) {
  const data: Record<string, unknown> = {};
  if ("description" in b) data.description = b.description!.trim();
  if ("amountCents" in b) data.amountCents = b.amountCents;
  if ("dueDay" in b) data.dueDay = b.dueDay;
  if ("startDate" in b) data.startDate = parseStart(b.startDate);
  if ("installments" in b) data.installments = b.installments ?? null;
  if ("pattern" in b) data.pattern = b.pattern?.trim() || null;
  if ("bankAccountId" in b) data.bankAccountId = b.bankAccountId || null;
  if ("accountId" in b) data.accountId = b.accountId || null;
  if ("supplierId" in b) data.supplierId = b.supplierId || null;
  if ("active" in b) data.active = !!b.active;
  if ("notes" in b) data.notes = b.notes?.trim() || null;
  return data;
}

export async function POST(req: NextRequest) {
  const b = (await req.json()) as Body;
  const err = validate(b, false);
  if (err) return NextResponse.json({ error: err }, { status: 400 });
  const row = await prisma.commitment.create({
    data: toData(b) as Parameters<typeof prisma.commitment.create>[0]["data"],
    include,
  });
  return NextResponse.json(row);
}

export async function PATCH(req: NextRequest) {
  const b = (await req.json()) as Body;
  if (!b.id) return NextResponse.json({ error: "Informe o id" }, { status: 400 });
  const err = validate(b, true);
  if (err) return NextResponse.json({ error: err }, { status: 400 });
  const row = await prisma.commitment.update({ where: { id: b.id }, data: toData(b), include });
  return NextResponse.json(row);
}

export async function DELETE(req: NextRequest) {
  const b = (await req.json()) as Body;
  if (!b.id) return NextResponse.json({ error: "Informe o id" }, { status: 400 });
  await prisma.commitment.delete({ where: { id: b.id } });
  return NextResponse.json({ ok: true });
}
