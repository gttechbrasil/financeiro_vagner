import { NextRequest, NextResponse } from "next/server";
import { computeForecast, defaultRange, todayUTC, weekStart } from "@/lib/forecast";

/**
 * Agenda de contas a pagar e receber por semana.
 * GET /api/forecast?inicio=yyyy-mm-dd&semanas=4
 * - inicio: qualquer dia; a agenda começa na segunda-feira daquela semana
 *   (padrão: semana atual)
 * - semanas: quantidade de semanas (1-26, padrão 4)
 */
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const weeks = Math.min(26, Math.max(1, Number(p.get("semanas")) || 4));
  const inicio = p.get("inicio");
  const start = inicio && /^\d{4}-\d{2}-\d{2}$/.test(inicio) ? new Date(inicio + "T00:00:00Z") : todayUTC();
  const { from, to } = defaultRange(weeks, weekStart(start));
  const data = await computeForecast(from, to);
  return NextResponse.json({ ...data, weeksCount: weeks, today: todayUTC().toISOString().slice(0, 10) });
}
