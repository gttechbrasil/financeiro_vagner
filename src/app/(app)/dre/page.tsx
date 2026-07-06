import Link from "next/link";
import { computeDre } from "@/lib/dre";
import { getAvailableYears } from "@/lib/years";
import { formatBRLPlain, MONTHS_PT_SHORT } from "@/lib/money";
import PeriodFilter from "@/components/PeriodFilter";

export const dynamic = "force-dynamic";

function Cell({
  value,
  proj = 0,
  bold,
  highlight,
}: {
  value: number;
  proj?: number;
  bold?: boolean;
  highlight?: boolean;
}) {
  const total = value + proj;
  const isProj = proj !== 0;
  const cls = isProj
    ? "text-sky-600 italic"
    : total < 0
      ? "text-red-600"
      : total > 0
        ? "text-slate-800"
        : "text-slate-300";
  return (
    <td
      className={`px-2 py-1 text-right whitespace-nowrap tabular-nums ${cls} ${bold ? "font-semibold" : ""} ${
        highlight ? "bg-blue-50/60" : ""
      }`}
      title={isProj ? "Inclui previsão (parcelas futuras / despesas fixas)" : undefined}
    >
      {total === 0 ? "–" : formatBRLPlain(total)}
    </td>
  );
}

export default async function DrePage({
  searchParams,
}: {
  searchParams: Promise<{ ano?: string; mes?: string; zeradas?: string; prev?: string }>;
}) {
  const params = await searchParams;
  const year = Number(params.ano) || new Date().getFullYear();
  const month = Math.min(12, Math.max(0, Number(params.mes) || 0));
  const showZeros = params.zeradas === "1";
  const showProjections = params.prev !== "0";
  const [dre, years] = await Promise.all([
    computeDre(year, { projections: showProjections }),
    getAvailableYears(),
  ]);

  const rows = showZeros ? dre.rows : dre.rows.filter((r) => r.kind !== "account" || r.total !== 0);

  const href = (patch: Record<string, string | null>) => {
    const p = new URLSearchParams();
    p.set("ano", String(year));
    if (month > 0) p.set("mes", String(month));
    if (showZeros) p.set("zeradas", "1");
    if (!showProjections) p.set("prev", "0");
    for (const [k, v] of Object.entries(patch)) {
      if (v === null) p.delete(k);
      else p.set(k, v);
    }
    return `/dre?${p.toString()}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">DRE Gerencial</h1>
          <p className="text-sm text-slate-500">Demonstração do resultado · {year}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={href({ prev: showProjections ? "0" : null })}
            className={`text-sm border shadow-sm rounded-lg px-3 py-1.5 transition-colors ${
              showProjections
                ? "bg-sky-50 border-sky-300 text-sky-800"
                : "bg-white border-slate-200 hover:border-blue-400"
            }`}
          >
            {showProjections ? "🔮 Com previsão" : "Só realizado"}
          </Link>
          <Link
            href={href({ zeradas: showZeros ? null : "1" })}
            className="text-sm bg-white border border-slate-200 shadow-sm rounded-lg px-3 py-1.5 hover:border-blue-400 hover:text-blue-700 transition-colors"
          >
            {showZeros ? "Ocultar contas sem movimento" : "Mostrar contas sem movimento"}
          </Link>
        </div>
      </div>

      <PeriodFilter years={years} year={year} month={month} showMonths />

      {dre.unclassifiedCount > 0 && (
        <p className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800">
          ⚠️ Existem <b>{dre.unclassifiedCount}</b> transações de {year} sem conta do DRE — elas não
          aparecem neste relatório.{" "}
          <Link className="underline font-medium" href="/transacoes">Classificar agora</Link>
        </p>
      )}

      {showProjections && dre.hasProjections && (
        <p className="bg-sky-50 border border-sky-200 rounded-xl p-3 text-sm text-sky-800">
          🔮 Valores em <i className="text-sky-600">azul itálico</i> são <b>previsão</b> dos meses
          futuros: parcelas restantes de compras parceladas + média das despesas marcadas como{" "}
          <b>fixa mensal</b> (📌 na tela de Transações). Meses já fechados mostram apenas o realizado.
        </p>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-x-auto">
        <table className="text-xs lg:text-sm w-full">
          <thead>
            <tr className="bg-slate-800 text-white text-right">
              <th className="px-3 py-2.5 text-left min-w-56 sticky left-0 bg-slate-800 z-10">Conta</th>
              {MONTHS_PT_SHORT.map((m, i) => (
                <th key={m} className={`px-2 py-2.5 font-medium ${month === i + 1 ? "bg-blue-700" : ""}`}>
                  {m}
                  {showProjections && i >= dre.firstFutureMonth && (
                    <span className="block text-[9px] font-normal text-sky-300">prev.</span>
                  )}
                </th>
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
                      <Cell key={j} value={v} proj={row.projected[j]} bold highlight={month === j + 1} />
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
                    <Cell key={j} value={v} proj={row.projected[j]} highlight={month === j + 1} />
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
        {showProjections && " O Total e a Média do ano incluem a previsão dos meses futuros."}
        {month > 0 && " Coluna do mês selecionado em destaque."}
      </p>
    </div>
  );
}
