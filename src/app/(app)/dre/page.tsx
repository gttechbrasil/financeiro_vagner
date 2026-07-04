import Link from "next/link";
import { computeDre } from "@/lib/dre";
import { getAvailableYears } from "@/lib/years";
import { formatBRLPlain, MONTHS_PT_SHORT } from "@/lib/money";
import PeriodFilter from "@/components/PeriodFilter";

export const dynamic = "force-dynamic";

function Cell({ value, bold, highlight }: { value: number; bold?: boolean; highlight?: boolean }) {
  const cls = value < 0 ? "text-red-600" : value > 0 ? "text-slate-800" : "text-slate-300";
  return (
    <td
      className={`px-2 py-1 text-right whitespace-nowrap tabular-nums ${cls} ${bold ? "font-semibold" : ""} ${
        highlight ? "bg-blue-50/60" : ""
      }`}
    >
      {value === 0 ? "–" : formatBRLPlain(value)}
    </td>
  );
}

export default async function DrePage({
  searchParams,
}: {
  searchParams: Promise<{ ano?: string; mes?: string; zeradas?: string }>;
}) {
  const params = await searchParams;
  const year = Number(params.ano) || new Date().getFullYear();
  const month = Math.min(12, Math.max(0, Number(params.mes) || 0));
  const showZeros = params.zeradas === "1";
  const [dre, years] = await Promise.all([computeDre(year), getAvailableYears()]);

  const rows = showZeros ? dre.rows : dre.rows.filter((r) => r.kind !== "account" || r.total !== 0);

  const toggleHref = (() => {
    const p = new URLSearchParams();
    p.set("ano", String(year));
    if (month > 0) p.set("mes", String(month));
    if (!showZeros) p.set("zeradas", "1");
    return `/dre?${p.toString()}`;
  })();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">DRE Gerencial</h1>
          <p className="text-sm text-slate-500">Demonstração do resultado · {year}</p>
        </div>
        <Link
          href={toggleHref}
          className="text-sm bg-white border border-slate-200 shadow-sm rounded-lg px-3 py-1.5 hover:border-blue-400 hover:text-blue-700 transition-colors"
        >
          {showZeros ? "Ocultar contas sem movimento" : "Mostrar contas sem movimento"}
        </Link>
      </div>

      <PeriodFilter years={years} year={year} month={month} showMonths />

      {dre.unclassifiedCount > 0 && (
        <p className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800">
          ⚠️ Existem <b>{dre.unclassifiedCount}</b> transações de {year} sem conta do DRE — elas não
          aparecem neste relatório.{" "}
          <Link className="underline font-medium" href="/transacoes">Classificar agora</Link>
        </p>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-x-auto">
        <table className="text-xs lg:text-sm w-full">
          <thead>
            <tr className="bg-slate-800 text-white text-right">
              <th className="px-3 py-2.5 text-left min-w-56 sticky left-0 bg-slate-800 z-10">Conta</th>
              {MONTHS_PT_SHORT.map((m, i) => (
                <th key={m} className={`px-2 py-2.5 font-medium ${month === i + 1 ? "bg-blue-700" : ""}`}>{m}</th>
              ))}
              <th className="px-2 py-2.5">Total</th>
              <th className="px-2 py-2.5">Média</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              if (row.kind === "group") {
                return (
                  <tr key={i} className="bg-slate-100 border-t border-slate-200">
                    <td className="px-3 py-1.5 font-bold text-slate-700 uppercase text-xs tracking-wide sticky left-0 bg-slate-100 z-10">
                      {row.label}
                    </td>
                    <td colSpan={14}></td>
                  </tr>
                );
              }
              if (row.kind === "subtotal") {
                return (
                  <tr key={i} className="bg-blue-50 border-y border-blue-100 font-semibold">
                    <td className="px-3 py-1.5 text-blue-900 sticky left-0 bg-blue-50 z-10">{row.label}</td>
                    {row.months.map((v, j) => (
                      <Cell key={j} value={v} bold highlight={month === j + 1} />
                    ))}
                    <Cell value={row.total} bold />
                    <Cell value={row.average} bold />
                  </tr>
                );
              }
              return (
                <tr key={i} className="border-t border-slate-100 hover:bg-slate-50 group">
                  <td className="px-3 py-1 pl-6 text-slate-600 sticky left-0 bg-white group-hover:bg-slate-50 z-10">
                    <span className="text-slate-400 mr-1.5">{row.code}</span>
                    {row.label}
                  </td>
                  {row.months.map((v, j) => (
                    <Cell key={j} value={v} highlight={month === j + 1} />
                  ))}
                  <Cell value={row.total} />
                  <Cell value={row.average} />
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-500">
        Valores em reais. Receitas positivas, despesas negativas. Subtotais em cascata: Receita
        Líquida, Resultado Bruto, EBITDA, Lucro Operacional e Resultado Líquido do Período.
        {month > 0 && " Coluna do mês selecionado em destaque."}
      </p>
    </div>
  );
}
