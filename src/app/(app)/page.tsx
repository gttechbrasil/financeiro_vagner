import Link from "next/link";
import { computeDre } from "@/lib/dre";
import { formatBRL } from "@/lib/money";
import { ReceitaDespesaChart, ReceitaPorTipoChart } from "@/components/DashboardCharts";

export const dynamic = "force-dynamic";

function sum(a: number[]) {
  return a.reduce((s, v) => s + v, 0);
}

function pct(part: number, whole: number) {
  if (whole === 0) return "–";
  return ((part / whole) * 100).toFixed(1).replace(".", ",") + "%";
}

function Kpi({
  label,
  value,
  sub,
  negativeIsBad = true,
}: {
  label: string;
  value: string;
  sub?: string;
  negativeIsBad?: boolean;
}) {
  const isNeg = value.includes("-");
  return (
    <div className="bg-white rounded-xl shadow p-4">
      <p className="text-xs text-slate-500 uppercase tracking-wide">{label}</p>
      <p className={`text-xl font-bold mt-1 ${isNeg && negativeIsBad ? "text-red-600" : "text-slate-900"}`}>
        {value}
      </p>
      {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
    </div>
  );
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ ano?: string }>;
}) {
  const params = await searchParams;
  const year = Number(params.ano) || new Date().getFullYear();
  const dre = await computeDre(year);

  const receitaMonths = dre.totals["GRUPO:RECEITA"] ?? new Array(12).fill(0);
  const resultadoMonths = dre.totals["RESULTADO LÍQUIDO DO PERÍODO"] ?? new Array(12).fill(0);
  const despesaMonths = receitaMonths.map((r, i) => Math.max(0, r - resultadoMonths[i]));

  const receita = sum(receitaMonths);
  const receitaLiquida = sum(dre.totals["RECEITA LÍQUIDA"] ?? []);
  const ebitda = sum(dre.totals["EBITDA"] ?? []);
  const lucro = sum(resultadoMonths);
  const deducoes = sum(dre.totals["GRUPO:DEDUCAO"] ?? []);
  const financeiro = sum(dre.totals["GRUPO:FINANCEIRO"] ?? []);

  // somas por código de conta para os percentuais
  const byCode = new Map<string, number>();
  for (const row of dre.rows) {
    if (row.kind === "account" && row.code) byCode.set(row.code, row.total);
  }
  const sumCodes = (codes: string[]) => codes.reduce((s, c) => s + (byCode.get(c) ?? 0), 0);
  const marketing = sumCodes(["4.1", "4.2", "4.3", "4.4", "4.5"]);
  const equipeJuridica = sumCodes(["3.1", "3.2", "3.3", "3.4"]);

  const receitaPorTipo = dre.rows
    .filter((r) => r.kind === "account" && r.code?.startsWith("1."))
    .map((r) => ({ name: r.label, value: r.total }))
    .sort((a, b) => b.value - a.value);

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Dashboard · {year}</h1>
        <div className="flex items-center gap-2 text-sm">
          {[year - 1, year, year + 1].map((y) => (
            <Link
              key={y}
              href={`/?ano=${y}`}
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
          ⚠️ <b>{dre.unclassifiedCount}</b> transações de {year} ainda sem classificação.{" "}
          <Link className="underline font-medium" href="/transacoes">Classificar</Link>
        </p>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi label="Receita Operacional" value={formatBRL(receita)} />
        <Kpi label="Receita Líquida" value={formatBRL(receitaLiquida)} sub={`Deduções: ${formatBRL(deducoes)}`} />
        <Kpi label="EBITDA" value={formatBRL(ebitda)} sub={`Margem: ${pct(ebitda, receitaLiquida)}`} />
        <Kpi label="Resultado Líquido" value={formatBRL(lucro)} sub={`Margem: ${pct(lucro, receitaLiquida)}`} />
        <Kpi label="Marketing / Receita" value={pct(Math.abs(marketing), receita)} sub={formatBRL(marketing)} negativeIsBad={false} />
        <Kpi label="Equipe Jurídica / Receita" value={pct(Math.abs(equipeJuridica), receita)} sub={formatBRL(equipeJuridica)} negativeIsBad={false} />
        <Kpi label="Resultado Financeiro" value={formatBRL(financeiro)} />
        <Kpi label="Inadimplência / Deduções" value={pct(Math.abs(deducoes), receita)} sub="sobre a receita bruta" negativeIsBad={false} />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl shadow p-5">
          <h2 className="font-semibold mb-3">Receita × Despesas por mês</h2>
          <ReceitaDespesaChart receita={receitaMonths} despesa={despesaMonths} />
        </div>
        <div className="bg-white rounded-xl shadow p-5">
          <h2 className="font-semibold mb-3">Receita por tipo de serviço</h2>
          <ReceitaPorTipoChart data={receitaPorTipo} />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow p-5">
        <h2 className="font-semibold mb-2">Atalhos</h2>
        <div className="flex flex-wrap gap-3 text-sm">
          <Link href="/importar" className="border border-slate-300 rounded-lg px-3 py-2 hover:bg-slate-50">📥 Importar extrato</Link>
          <Link href="/transacoes" className="border border-slate-300 rounded-lg px-3 py-2 hover:bg-slate-50">💳 Classificar transações</Link>
          <Link href={`/dre?ano=${year}`} className="border border-slate-300 rounded-lg px-3 py-2 hover:bg-slate-50">📑 Ver DRE completo</Link>
        </div>
      </div>
    </div>
  );
}
