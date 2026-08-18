"use client";

import { Fragment, Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { formatBRL, MONTHS_PT } from "@/lib/money";

const TABS = [
  { key: "hierarchy", label: "Conta → Fornecedor" },
  { key: "supplier", label: "Por Fornecedor" },
  { key: "account", label: "Por Categoria" },
  { key: "sector", label: "Por Setor" },
  { key: "unit", label: "Por Unidade" },
  { key: "bank", label: "Por Origem" },
];

interface FlatRow {
  id: string | null;
  name: string;
  sumCents: number;
  count: number;
}

interface SupplierRow {
  supplierId: string | null;
  supplierName: string;
  sumCents: number;
  count: number;
}

interface HierarchyRow {
  accountId: string;
  code: string;
  name: string;
  group: string;
  sumCents: number;
  count: number;
  suppliers: SupplierRow[];
}

interface Tx {
  id: string;
  date: string;
  description: string;
  amountCents: number;
  bankAccount: { name: string };
}

const currentYear = new Date().getFullYear();

function Content() {
  const params = useSearchParams();
  const [tab, setTab] = useState(params.get("por") ?? "hierarchy");
  const [year, setYear] = useState(String(currentYear));
  const [month, setMonth] = useState("");
  const [flat, setFlat] = useState<FlatRow[]>([]);
  const [tree, setTree] = useState<HierarchyRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [openAccounts, setOpenAccounts] = useState<Set<string>>(new Set());
  // lançamentos carregados por conta+fornecedor (drill final)
  const [txCache, setTxCache] = useState<Map<string, Tx[]>>(new Map());
  const [openTx, setOpenTx] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    const p = new URLSearchParams({ by: tab, year });
    if (month) p.set("month", month);
    const res = await fetch(`/api/reports?${p}`);
    const d = await res.json();
    if (tab === "hierarchy") setTree(d.rows);
    else setFlat(d.rows);
    setOpenAccounts(new Set());
    setOpenTx(new Set());
    setTxCache(new Map());
    setLoading(false);
  }, [tab, year, month]);

  useEffect(() => {
    load();
  }, [load]);

  function toggleAccount(id: string) {
    const s = new Set(openAccounts);
    if (s.has(id)) s.delete(id);
    else s.add(id);
    setOpenAccounts(s);
  }

  async function toggleTx(accountId: string, supplierId: string | null) {
    const key = `${accountId}:${supplierId ?? "none"}`;
    const s = new Set(openTx);
    if (s.has(key)) {
      s.delete(key);
      setOpenTx(s);
      return;
    }
    s.add(key);
    setOpenTx(s);
    if (!txCache.has(key)) {
      const p = new URLSearchParams({ year, accountId, supplierId: supplierId ?? "none" });
      if (month) p.set("month", month);
      const res = await fetch(`/api/transactions?${p}`);
      const d = await res.json();
      const cache = new Map(txCache);
      cache.set(key, d.items);
      setTxCache(cache);
    }
  }

  const grandTotal = (tab === "hierarchy" ? tree : flat).reduce(
    (s, r) => s + r.sumCents,
    0
  );

  return (
    <div className="space-y-4 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Relatórios</h1>
        <p className="text-sm text-slate-500">
          Totais por fornecedor, categoria, setor, unidade e origem — com drill-down até o lançamento
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`text-sm rounded-lg px-3 py-1.5 border shadow-sm transition-colors ${
              tab === t.key
                ? "bg-blue-600 border-blue-600 text-white font-semibold"
                : "bg-white border-slate-200 hover:border-blue-400"
            }`}
          >
            {t.label}
          </button>
        ))}
        <span className="flex-1" />
        <select
          className="border border-slate-300 rounded-lg px-2.5 py-1.5 text-sm bg-white"
          value={year}
          onChange={(e) => setYear(e.target.value)}
        >
          {[currentYear + 1, currentYear, currentYear - 1, currentYear - 2].map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        <select
          className="border border-slate-300 rounded-lg px-2.5 py-1.5 text-sm bg-white"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
        >
          <option value="">Ano inteiro</option>
          {MONTHS_PT.map((m, i) => (
            <option key={m} value={i + 1}>{m}</option>
          ))}
        </select>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4">
        {loading ? (
          <p className="text-sm text-slate-500 py-10 text-center">Carregando...</p>
        ) : tab === "hierarchy" ? (
          tree.length === 0 ? (
            <p className="text-sm text-slate-500 py-10 text-center">Nenhum lançamento classificado no período.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b">
                  <th className="py-2 pr-3">Conta DRE / Fornecedor</th>
                  <th className="py-2 pr-3 text-right">Lançamentos</th>
                  <th className="py-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {tree.map((acc) => (
                  <Fragment key={acc.accountId}>
                    <tr
                      className="border-b hover:bg-slate-50 cursor-pointer"
                      onClick={() => toggleAccount(acc.accountId)}
                    >
                      <td className="py-2 pr-3 font-medium">
                        <span className="inline-block w-4 text-slate-400">
                          {openAccounts.has(acc.accountId) ? "▾" : "▸"}
                        </span>
                        <span className="text-slate-400 mr-1.5">{acc.code}</span>
                        {acc.name}
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums text-slate-500">{acc.count}</td>
                      <td className={`py-2 text-right tabular-nums font-semibold ${acc.sumCents < 0 ? "text-red-600" : "text-emerald-700"}`}>
                        {formatBRL(acc.sumCents)}
                      </td>
                    </tr>
                    {openAccounts.has(acc.accountId) &&
                      acc.suppliers.map((sup) => {
                        const key = `${acc.accountId}:${sup.supplierId ?? "none"}`;
                        return (
                          <Fragment key={key}>
                            <tr
                              className="border-b bg-slate-50/60 hover:bg-slate-100 cursor-pointer"
                              onClick={() => toggleTx(acc.accountId, sup.supplierId)}
                            >
                              <td className="py-1.5 pr-3 pl-10">
                                <span className="inline-block w-4 text-slate-400">
                                  {openTx.has(key) ? "▾" : "▸"}
                                </span>
                                {sup.supplierName}
                              </td>
                              <td className="py-1.5 pr-3 text-right tabular-nums text-slate-500">{sup.count}</td>
                              <td className={`py-1.5 text-right tabular-nums ${sup.sumCents < 0 ? "text-red-600" : "text-emerald-700"}`}>
                                {formatBRL(sup.sumCents)}
                              </td>
                            </tr>
                            {openTx.has(key) &&
                              (txCache.get(key) ?? []).map((t) => (
                                <tr key={t.id} className="border-b bg-white text-xs text-slate-600">
                                  <td className="py-1 pr-3 pl-16">
                                    {new Date(t.date).toLocaleDateString("pt-BR", { timeZone: "UTC" })}
                                    {" · "}
                                    {t.description}
                                    <span className="text-slate-400"> · {t.bankAccount.name}</span>
                                  </td>
                                  <td />
                                  <td className={`py-1 text-right tabular-nums ${t.amountCents < 0 ? "text-red-600" : "text-emerald-700"}`}>
                                    {formatBRL(t.amountCents)}
                                  </td>
                                </tr>
                              ))}
                            {openTx.has(key) && !txCache.has(key) && (
                              <tr key={`${key}-loading`} className="text-xs text-slate-400">
                                <td className="py-1 pl-16" colSpan={3}>Carregando lançamentos...</td>
                              </tr>
                            )}
                          </Fragment>
                        );
                      })}
                  </Fragment>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-200 font-semibold">
                  <td className="py-2 pr-3">Total do período</td>
                  <td />
                  <td className={`py-2 text-right tabular-nums ${grandTotal < 0 ? "text-red-600" : "text-emerald-700"}`}>
                    {formatBRL(grandTotal)}
                  </td>
                </tr>
              </tfoot>
            </table>
          )
        ) : flat.length === 0 ? (
          <p className="text-sm text-slate-500 py-10 text-center">Nenhum lançamento no período.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b">
                <th className="py-2 pr-3">{TABS.find((t) => t.key === tab)?.label.replace("Por ", "")}</th>
                <th className="py-2 pr-3 text-right">Lançamentos</th>
                <th className="py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {flat.map((r) => (
                <tr key={r.id ?? "none"} className="border-b last:border-0 hover:bg-slate-50">
                  <td className={`py-2 pr-3 ${r.id ? "" : "text-slate-400 italic"}`}>{r.name}</td>
                  <td className="py-2 pr-3 text-right tabular-nums text-slate-500">{r.count}</td>
                  <td className={`py-2 text-right tabular-nums font-medium ${r.sumCents < 0 ? "text-red-600" : "text-emerald-700"}`}>
                    {formatBRL(r.sumCents)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-200 font-semibold">
                <td className="py-2 pr-3">Total do período</td>
                <td />
                <td className={`py-2 text-right tabular-nums ${grandTotal < 0 ? "text-red-600" : "text-emerald-700"}`}>
                  {formatBRL(grandTotal)}
                </td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
      <p className="text-xs text-slate-500">
        Na visão Conta → Fornecedor, clique na conta para ver os fornecedores e no fornecedor para
        ver os lançamentos. Valores com sinal: receitas positivas, despesas negativas.
      </p>
    </div>
  );
}

export default function RelatoriosPage() {
  return (
    <Suspense fallback={<p className="text-sm text-slate-500">Carregando...</p>}>
      <Content />
    </Suspense>
  );
}
