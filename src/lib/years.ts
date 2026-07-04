import { prisma } from "@/lib/db";

/** Anos com movimento no banco (sempre inclui o ano atual). */
export async function getAvailableYears(): Promise<number[]> {
  const [min, max] = await Promise.all([
    prisma.transaction.findFirst({ orderBy: { date: "asc" }, select: { date: true } }),
    prisma.transaction.findFirst({ orderBy: { date: "desc" }, select: { date: true } }),
  ]);
  const current = new Date().getFullYear();
  const start = min ? Math.min(min.date.getUTCFullYear(), current) : current;
  const end = max ? Math.max(max.date.getUTCFullYear(), current) : current;
  const years: number[] = [];
  for (let y = end; y >= start; y--) years.push(y);
  return years;
}
