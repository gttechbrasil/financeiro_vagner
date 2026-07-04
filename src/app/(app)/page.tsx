import Link from "next/link";
import { computeDre } from "@/lib/dre";
import { getAvailableYears } from "@/lib/years";
import { formatBRL, MONTHS_PT } from "@/lib/money";
import PeriodFilter from "@/components/PeriodFilter";
import { ReceitaDespesaChart, ReceitaPorTipoChart } from "@/components/DashboardCharts";

export const dynamic = "force-dynamic";

function pct(part: number, whole: number) {
  if (whole === 0) return "–";
  return ((part / whole) * 100).toFixed(1).replace(".", ",") + "%";
}

const ACCENTS = {
  blue: "border-l-blue-500 bg-blue-50/40",
  green: "border-l-emerald-500 bg-emerald-50/40",
  amber: "border-l-amber-500 bg-amber-50/40",
  violet: "border-l-violet-500 bg-violet-50/40",
} as const;

function Kpi({
  label,
  value,
  sub,
  icon,
  accent = "blue",
  negativeIsBad = true,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: string;
  accent?: keyof typeof ACCENTS;
  negativeIsBad?: boolean;
}) {
  const isNeg = value.includes("-");
  return (
    <div className={`bg-white rounded-xl shadow-sm border border-slate-100 border-l-4 p-4 ${ACCENTS[accent]}`}>
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{label}</p>
        <span className="text-lg opacity-70">{icon}</span>
      </div>
      <p className={`text-2xl font-bold mt-1.5 tracking-tight ${isNeg && negativeIsBad ? "text-red-600" : "text-slate-900"}`}>
        {value}
      </p>
      {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
    </div>
  );
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ ano?: string; mes?: string }>;
}) {
  const params = await searchParams;
  const year = Number(params.ano) || new Date().getFullYear();
  const month = Math.min(12, Math.max(0, Number(params.mes) || 0)); // 0 = ano todo
  const [dre, years] = await Promise.all([computeDre(year), getAvailableYears()]);

  const zero = new Array(12).fill(0);
  const pick = (arr?: number[]) => {
    const a = arr ?? zero;
    return month > 0 ? a[month - 1] : a.reduce((s, v) => s + v, 0);
  };

  const receitaMonths = dre.totals["GRUPO:RECEITA"] ?? zero;
  const resultadoMonths = dre.totals["RESULTADO LÍQUIDO DO PERÍODO"] ?? zero;
  const despesaMonths = receitaMonths.map((r, i) => Math.max(0, r - resultadoMonths[i]));

  const receita = pick(receitaMonths);
  const receitaLiquida = pick(dre.totals["RECEITA LÍQUIDA"]);
  const ebitda = pick(dre.totals["EBITDA"]);
  const lucro = pick(resultadoMonths);
  const deducoes = pick(dre.totals["GRUPO:DEDUCAO"]);
  const financeiro = pick(dre.totals["GRUPO:FINANCEIRO"]);

  const byCode = new Map<string, number>();
  for (const row of dre.rows) {
    if (row.kind === "account" && row.code) {
      byCode.set(row.code, month > 0 ? row.months[month - 1] : row.total);
    }
  }
  const sumCodes = (codes: string[]) => codes.reduce((s, c) => s + (byCode.get(c) ?? 0), 0);
  const marketing = sumCodes(["4.1", "4.2", "4.3", "4.4", "4.5"]);
  const equipeJuridica = sumCodes(["3.1", "3.2", "3.3", "3.4"]);

  const receitaPorTipo = dre.rows
    .filter((r) => r.kind === "account" && r.code?.startsWith("1."))
    .map((r) => ({ name: r.label, value: month > 0 ? r.months[month - 1] : r.total }))
    .sort((a, b) => b.value - a.value);

  const periodo = month > 0 ? `${MONTHS_PT[month - 1]} de ${year}` : `${year}`;

  return (
    <div className="space-y-5 max-w-7xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-slate-500">Visão executiva · {periodo}</p>
        </div>
      </div>

      <PeriodFilter years={years} year={year} month={month} showMonths />

      {dre.unclassifiedCount > 0 && (
        <p className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800">
          ⚠️ <b>{dre.unclassifiedCount}</b> transações de {year} ainda sem classificação — os números
          abaixo não as incluem.{" "}
          <Link className="underline font-medium" href="/transacoes">Classificar agora</Link>
        </p>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi label="Receita Operacional" value={formatBRL(receita)} icon="💰" accent="blue" />
        <Kpi label="Receita Líquida" value={formatBRL(receitaLiquida)} sub={`Deduções: ${formatBRL(deducoes)}`} icon="🧾" accent="blue" />
        <Kpi label="EBITDA" value={formatBRL(ebitda)} sub={`Margem: ${pct(ebitda, receitaLiquida)}`} icon="📈" accent="green" />
        <Kpi label="Resultado Líquido" value={formatBRL(lucro)} sub={`Margem: ${pct(lucro, receitaLiquida)}`} icon="🏦" accent="green" />
        <Kpi label="Marketing / Receita" value={pct(Math.abs(marketing), receita)} sub={formatBRL(marketing)} icon="📣" accent="amber" negativeIsBad={false} />
        <Kpi label="Equipe Jurídica / Receita" value={pct(Math.abs(equipeJuridica), receita)} sub={formatBRL(equipeJuridica)} icon="⚖️" accent="amber" negativeIsBad={false} />
        <Kpi label="Resultado Financeiro" value={formatBRL(financeiro)} icon="💱" accent="violet" />
        <Kpi label="Inadimplência / Deduções" value={pct(Math.abs(deducoes), receita)} sub="sobre a receita bruta" icon="📉" accent="violet" negativeIsBad={false} />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="font-semibold">Receita × Despesas por mês</h2>
            {month > 0 && <span className="text-xs text-slate-500">{MONTHS_PT[month - 1]} em destaque</span>}
          </div>
          <ReceitaDespesaChart receita={receitaMonths} despesa={despesaMonths} highlightMonth={month} />
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
          <h2 className="font-semibold mb-3">Receita por tipo de serviço · {periodo}</h2>
          <ReceitaPorTipoChart data={receitaPorTipo} />
        </div>
      </div>

      <div className="flex flex-wrap gap-3 text-sm">
        <Link href="/importar" className="bg-white border border-slate-200 shadow-sm rounded-xl px-4 py-2.5 hover:border-blue-400 hover:text-blue-700 transition-colors">
          📥 Importar extrato
        </Link>
        <Link href="/transacoes" className="bg-white border border-slate-200 shadow-sm rounded-xl px-4 py-2.5 hover:border-blue-400 hover:text-blue-700 transition-colors">
          💳 Classificar transações
        </Link>
        <Link href={`/dre?ano=${year}`} className="bg-white border border-slate-200 shadow-sm rounded-xl px-4 py-2.5 hover:border-blue-400 hover:text-blue-700 transition-colors">
          📑 Ver DRE completo
        </Link>
      </div>
    </div>
  );
}
