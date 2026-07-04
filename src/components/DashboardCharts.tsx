"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatBRL, MONTHS_PT_SHORT } from "@/lib/money";

// Paleta de referência validada (dataviz): slot 1 azul, slot 6 vermelho
const C = {
  receita: "#2a78d6",
  despesa: "#e34948",
  seq: "#2a78d6",
  grid: "#e1e0d9",
  axis: "#898781",
  ink: "#0b0b0b",
};

const fmtShort = (v: number) =>
  (v / 100).toLocaleString("pt-BR", { notation: "compact", maximumFractionDigits: 1 });

export function ReceitaDespesaChart({
  receita,
  despesa,
}: {
  receita: number[];
  despesa: number[];
}) {
  const data = MONTHS_PT_SHORT.map((m, i) => ({
    mes: m,
    Receita: receita[i],
    Despesas: despesa[i],
  }));
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }} barGap={2}>
        <CartesianGrid vertical={false} stroke={C.grid} strokeWidth={1} />
        <XAxis dataKey="mes" tick={{ fill: C.axis, fontSize: 12 }} axisLine={{ stroke: C.grid }} tickLine={false} />
        <YAxis tickFormatter={fmtShort} tick={{ fill: C.axis, fontSize: 12 }} axisLine={false} tickLine={false} width={52} />
        <Tooltip
          formatter={(v) => formatBRL(Number(v))}
          contentStyle={{ fontSize: 13, borderRadius: 8, border: "1px solid #e1e0d9" }}
        />
        <Legend wrapperStyle={{ fontSize: 13 }} />
        <Bar dataKey="Receita" fill={C.receita} radius={[4, 4, 0, 0]} maxBarSize={22} />
        <Bar dataKey="Despesas" fill={C.despesa} radius={[4, 4, 0, 0]} maxBarSize={22} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function ReceitaPorTipoChart({
  data,
}: {
  data: { name: string; value: number }[];
}) {
  const items = data.filter((d) => d.value !== 0);
  if (items.length === 0) {
    return <p className="text-sm text-slate-500 py-10 text-center">Sem receitas classificadas no período.</p>;
  }
  return (
    <ResponsiveContainer width="100%" height={Math.max(180, items.length * 38)}>
      <BarChart data={items} layout="vertical" margin={{ top: 4, right: 70, left: 8, bottom: 4 }}>
        <CartesianGrid horizontal={false} stroke={C.grid} strokeWidth={1} />
        <XAxis type="number" tickFormatter={fmtShort} tick={{ fill: C.axis, fontSize: 12 }} axisLine={false} tickLine={false} />
        <YAxis
          type="category"
          dataKey="name"
          width={190}
          tick={{ fill: C.ink, fontSize: 12 }}
          axisLine={{ stroke: C.grid }}
          tickLine={false}
        />
        <Tooltip
          formatter={(v) => formatBRL(Number(v))}
          contentStyle={{ fontSize: 13, borderRadius: 8, border: "1px solid #e1e0d9" }}
        />
        <Bar
          dataKey="value"
          name="Receita"
          fill={C.seq}
          radius={[0, 4, 4, 0]}
          maxBarSize={20}
          label={{
            position: "right",
            fill: C.axis,
            fontSize: 11,
            formatter: (v) => (typeof v === "number" ? fmtShort(v) : String(v ?? "")),
          }}
        >
          {items.map((_, i) => (
            <Cell key={i} fill={C.seq} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
