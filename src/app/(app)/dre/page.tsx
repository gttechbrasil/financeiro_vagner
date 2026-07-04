import Link from "next/link";
import { computeDre } from "@/lib/dre";
import { formatBRLPlain, MONTHS_PT_SHORT } from "@/lib/money";

export const dynamic = "force-dynamic";

function Cell({ value, bold }: { value: number; bold?: boolean }) {
  const cls = value < 0 ? "text-red-600" : value > 0 ? "text-slate-800" : "text-slate-300";
  return (
    <td className={`px-2 py-1 text-right whitespace-nowrap tabular-nums ${cls} ${bold ? "font-semibold" : ""}`}>
      {value === 0 ? "–" : formatBRLPlain(value)}
    </td>
  );
}

export default async function DrePage({
  searchParams,
}: {
  searchParams: Promise<{ ano?: string }>;
}) {
  const params = await searchParams;
  const year = Number(params.ano) || new Date().getFullYear();
  const dre = await computeDre(year);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">DRE Gerencial · {year}</h1>
        <div className="flex items-center gap-2 text-sm">
          {[year - 1, year, year + 1].map((y) => (
            <Link
              key={y}
              href={`/dre?ano=${y}`}
              className={`rounded-lg px-3 py-1.5 border ${
                y === year ? "bg-blue-600 text-white border-blue-600" : "border-slate-300 hover:bg-white"
              }`}
            >
              {y}
            </Link>
          ))}
        </div>
      </div>

      {dre.unclassifiedCount > 0 && (
        <p className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
          ⚠️ Existem <b>{dre.unclassifiedCount}</b> transações de {year} sem conta do DRE —{" "}
          elas não aparecem neste relatório.{" "}
          <Link className="underline font-medium" href={`/transacoes`}>
            Classificar agora
          </Link>
        </p>
      )}

      <div className="bg-white rounded-xl shadow overflow-x-auto">
        <table className="text-xs lg:text-sm w-full">
          <thead className="sticky top-0">
            <tr className="bg-slate-800 text-white text-right">
              <th className="px-3 py-2 text-left min-w-56">Conta</th>
              {MONTHS_PT_SHORT.map((m) => (
                <th key={m} className="px-2 py-2 font-medium">{m}</th>
              ))}
              <th className="px-2 py-2">Total</th>
              <th className="px-2 py-2">Média</th>
            </tr>
          </thead>
          <tbody>
            {dre.rows.map((row, i) => {
              if (row.kind === "group") {
                return (
                  <tr key={i} className="bg-slate-100 border-t border-slate-200">
                    <td colSpan={15} className="px-3 py-1.5 font-bold text-slate-700 uppercase text-xs tracking-wide">
                      {row.label}
                    </td>
                  </tr>
                );
              }
              if (row.kind === "subtotal") {
                return (
                  <tr key={i} className="bg-blue-50 border-y border-blue-100 font-semibold">
                    <td className="px-3 py-1.5 text-blue-900">{row.label}</td>
                    {row.months.map((v, j) => (
                      <Cell key={j} value={v} bold />
                    ))}
                    <Cell value={row.total} bold />
                    <Cell value={row.average} bold />
                  </tr>
                );
              }
              return (
                <tr key={i} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-3 py-1 pl-6 text-slate-600">
                    <span className="text-slate-400 mr-1.5">{row.code}</span>
                    {row.label}
                  </td>
                  {row.months.map((v, j) => (
                    <Cell key={j} value={v} />
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
        Valores em reais. Receitas positivas, despesas negativas. Subtotais em cascata:
        Receita Líquida, Resultado Bruto, EBITDA, Lucro Operacional e Resultado Líquido do Período.
      </p>
    </div>
  );
}
