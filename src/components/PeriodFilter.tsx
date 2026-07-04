"use client";

import { usePathname, useRouter } from "next/navigation";
import { MONTHS_PT_SHORT } from "@/lib/money";

/**
 * Filtro de período compartilhado (Dashboard e DRE): seletor de ano e,
 * opcionalmente, chips de mês. Atualiza os parâmetros ?ano= e ?mes= da URL.
 */
export default function PeriodFilter({
  years,
  year,
  month = 0,
  showMonths = false,
}: {
  years: number[];
  year: number;
  /** 0 = ano inteiro, 1-12 = mês */
  month?: number;
  showMonths?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();

  function apply(y: number, m: number) {
    const p = new URLSearchParams();
    p.set("ano", String(y));
    if (m > 0) p.set("mes", String(m));
    router.push(`${pathname}?${p.toString()}`);
  }

  return (
    <div className="bg-white rounded-xl shadow p-3 flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Ano</span>
        <select
          className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm font-semibold bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={year}
          onChange={(e) => apply(Number(e.target.value), month)}
        >
          {years.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      {showMonths && (
        <div className="flex items-center gap-1 flex-wrap">
          <button
            onClick={() => apply(year, 0)}
            className={`rounded-lg px-2.5 py-1 text-xs font-medium border transition-colors ${
              month === 0
                ? "bg-blue-600 text-white border-blue-600"
                : "border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            Ano todo
          </button>
          {MONTHS_PT_SHORT.map((m, i) => (
            <button
              key={m}
              onClick={() => apply(year, i + 1)}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium border transition-colors ${
                month === i + 1
                  ? "bg-blue-600 text-white border-blue-600"
                  : "border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
