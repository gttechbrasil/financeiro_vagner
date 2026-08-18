"use client";

import { useCallback, useEffect, useState } from "react";
import { formatBRL } from "@/lib/money";

interface Meta {
  accounts: { id: string; code: string; name: string }[];
  sectors: { id: string; name: string }[];
  units: { id: string; name: string }[];
  bankAccounts: { id: string; name: string }[];
}

interface Audit {
  unclassified: number;
  byYear: { year: number; count: number }[];
  byBank: { id: string; name: string; count: number }[];
}

interface Tx {
  id: string;
  date: string;
  description: string;
  amountCents: number;
  accountId: string | null;
  sectorId: string | null;
  unitId: string | null;
  bankAccount: { name: string };
}

interface TxResponse {
  total: number;
  page: number;
  pageSize: number;
  items: Tx[];
}

const selectCls = "border border-slate-200 rounded px-1.5 py-1 text-xs bg-white";

export default function AuditoriaPage() {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [audit, setAudit] = useState<Audit | null>(null);
  const [data, setData] = useState<TxResponse | null>(null);
  const [page, setPage] = useState(1);
  const [yearFilter, setYearFilter] = useState("");
  const [bankFilter, setBankFilter] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/meta").then((r) => r.json()).then(setMeta);
  }, []);

  const loadAudit = useCallback(() => {
    fetch("/api/audit").then((r) => r.json()).then(setAudit);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const p = new URLSearchParams({ unclassified: "1", page: String(page) });
    if (yearFilter) p.set("year", yearFilter);
    if (bankFilter) p.set("bankAccountId", bankFilter);
    const res = await fetch(`/api/transactions?${p}`);
    setData(await res.json());
    setLoading(false);
  }, [page, yearFilter, bankFilter]);

  useEffect(() => {
    loadAudit();
  }, [loadAudit]);

  useEffect(() => {
    load();
  }, [load]);

  async function updateOne(id: string, patch: Record<string, unknown>) {
    await fetch("/api/transactions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [id], ...patch }),
    });
    load();
    loadAudit();
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const ok = (audit?.unclassified ?? 0) === 0;

  return (
    <div className="space-y-4 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Auditoria</h1>
        <p className="text-sm text-slate-500">Lançamentos ainda sem conta do DRE — eles não aparecem em nenhum relatório</p>
      </div>

      {ok ? (
        <p className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-sm text-emerald-800">
          ✅ Tudo classificado! Nenhum lançamento pendente de conta do DRE.
        </p>
      ) : (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 space-y-2">
          <p>
            ⚠️ Existem <b>{audit?.unclassified}</b> lançamentos sem conta do DRE. Enquanto houver
            pendências, o DRE e os relatórios ficam incompletos.
          </p>
          <div className="flex flex-wrap gap-2 text-xs">
            {audit?.byYear.map((y) => (
              <button
                key={y.year}
                onClick={() => { setYearFilter(yearFilter === String(y.year) ? "" : String(y.year)); setPage(1); }}
                className={`rounded-full border px-2.5 py-1 ${
                  yearFilter === String(y.year)
                    ? "bg-amber-600 border-amber-600 text-white"
                    : "border-amber-300 bg-white hover:bg-amber-100"
                }`}
              >
                {y.year}: {y.count}
              </button>
            ))}
            {audit?.byBank.map((b) => (
              <button
                key={b.id}
                onClick={() => { setBankFilter(bankFilter === b.id ? "" : b.id); setPage(1); }}
                className={`rounded-full border px-2.5 py-1 ${
                  bankFilter === b.id
                    ? "bg-amber-600 border-amber-600 text-white"
                    : "border-amber-300 bg-white hover:bg-amber-100"
                }`}
              >
                {b.name}: {b.count}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4">
        <div className="flex justify-between items-center mb-3 text-sm text-slate-600">
          <span>{data?.total ?? 0} pendentes {yearFilter && `em ${yearFilter}`}</span>
          <span className="flex items-center gap-1">
            Página {page} de {totalPages}
            <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="px-2 py-0.5 rounded hover:bg-slate-100 disabled:opacity-30">◀</button>
            <button disabled={page >= totalPages} onClick={() => setPage(page + 1)} className="px-2 py-0.5 rounded hover:bg-slate-100 disabled:opacity-30">▶</button>
          </span>
        </div>
        {loading ? (
          <p className="text-sm text-slate-500 py-10 text-center">Carregando...</p>
        ) : data?.items.length === 0 ? (
          <p className="text-sm text-slate-500 py-10 text-center">Nenhuma pendência com esses filtros. 🎉</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b">
                  <th className="py-2 pr-3">Data</th>
                  <th className="py-2 pr-3">Descrição</th>
                  <th className="py-2 pr-3">Origem</th>
                  <th className="py-2 pr-3 text-right">Valor</th>
                  <th className="py-2 pr-3">Conta DRE</th>
                  <th className="py-2 pr-3">Setor</th>
                  <th className="py-2">Unidade</th>
                </tr>
              </thead>
              <tbody>
                {data?.items.map((t) => (
                  <tr key={t.id} className="border-b last:border-0 bg-amber-50/40 hover:bg-amber-50">
                    <td className="py-1.5 pr-3 whitespace-nowrap text-slate-600">
                      {new Date(t.date).toLocaleDateString("pt-BR", { timeZone: "UTC" })}
                    </td>
                    <td className="py-1.5 pr-3 max-w-sm truncate" title={t.description}>
                      {t.description}
                    </td>
                    <td className="py-1.5 pr-3 text-xs text-slate-500 whitespace-nowrap">{t.bankAccount.name}</td>
                    <td className={`py-1.5 pr-3 text-right whitespace-nowrap font-medium tabular-nums ${t.amountCents < 0 ? "text-red-600" : "text-emerald-600"}`}>
                      {formatBRL(t.amountCents)}
                    </td>
                    <td className="py-1.5 pr-3">
                      <select
                        className={`${selectCls} max-w-44`}
                        value=""
                        onChange={(e) => e.target.value && updateOne(t.id, { accountId: e.target.value })}
                      >
                        <option value="">— classificar —</option>
                        {meta?.accounts.map((a) => (
                          <option key={a.id} value={a.id}>{a.code} {a.name}</option>
                        ))}
                      </select>
                    </td>
                    <td className="py-1.5 pr-3">
                      <select
                        className={selectCls}
                        value={t.sectorId ?? ""}
                        onChange={(e) => updateOne(t.id, { sectorId: e.target.value || null })}
                      >
                        <option value="">—</option>
                        {meta?.sectors.map((s) => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    </td>
                    <td className="py-1.5">
                      <select
                        className={selectCls}
                        value={t.unitId ?? ""}
                        onChange={(e) => updateOne(t.id, { unitId: e.target.value || null })}
                      >
                        <option value="">—</option>
                        {meta?.units.map((u) => (
                          <option key={u.id} value={u.id}>{u.name}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <p className="text-xs text-slate-500">
        💡 Dica: crie <b>regras</b> ou defina a <b>conta padrão do fornecedor</b> para que esses
        lançamentos sejam classificados automaticamente nas próximas importações.
      </p>
    </div>
  );
}
