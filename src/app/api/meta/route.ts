import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const [accounts, sectors, units, bankAccounts] = await Promise.all([
    prisma.dreAccount.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
    prisma.sector.findMany({ orderBy: { name: "asc" } }),
    prisma.unit.findMany({ orderBy: { name: "asc" } }),
    prisma.bankAccount.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);
  return NextResponse.json({ accounts, sectors, units, bankAccounts });
}
