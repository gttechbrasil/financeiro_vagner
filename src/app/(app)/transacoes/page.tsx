"use client";

import { useCallback, useEffect, useState } from "react";
import { formatBRL, MONTHS_PT } from "@/lib/money";

interface Meta {
  accounts: { id: string; code: string; name: string }[];
  sectors: { id: string; name: string }[];
  units: { id: string; name: string }[];
  bankAccounts: { id: string; name: string }[];
}

interface Tx {
  id: string;
  date: string;
  description: string;
  amountCents: number;
  accountId: string | null;
  sectorId: string | null;
  unitId: string | null;
  account: { code: string; name: string } | null;
  sector: { name: string } | null;
  unit: { name: string } | null;
  bankAccount: { name: string };
}

const currentYear = new Date().getFullYear();

export default function TransacoesPage() {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [filters, setFilters] = useState({
    year: String(currentYear),
    month: "",
    bankAccountId: "",
    accountId: "",
    unclassified: false,
    q: "",
  });
  const [data, setData] = useState<{ total: number; page: number; pageSize: number; sumCents: number; items: Tx[] } | null>(null);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulk, setBulk] = useState({ accountId: "", sectorId: "", unitId: "" });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/meta").then((r) => r.json()).then(setMeta);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const p = new URLSearchParams();
    if (filters.year) p.set("year", filters.year);
    if (filters.month) p.set("month", filters.month);
    if (filters.bankAccountId) p.set("bankAccountId", filters.bankAccountId);
    if (filters.accountId) p.set("accountId", filters.accountId);
    if (filters.unclassified) p.set("unclassified", "1");
    if (filters.q) p.set("q", filters.q);
    p.set("page", String(page));
    const res = await fetch(`/api/transactions?${p}`);
    setData(await res.json());
    setSelected(new Set());
    setLoading(false);
  }, [filters, page]);

  useEffect(() => {
    load();
  }, [load]);

  function toggle(id: string) {
    const s = new Set(selected);
    if (s.has(id)) s.delete(id);
    else s.add(id);
    setSelected(s);
  }

  async function applyBulk() {
    if (selected.size === 0) return;
    const body: Record<string, unknown> = { ids: [...selected] };
    if (bulk.accountId) body.accountId = bulk.accountId;
    if (bulk.sectorId) body.sectorId = bulk.sectorId;
    if (bulk.unitId) body.unitId = bulk.unitId;
    if (Object.keys(body).length === 1) return;
    await fetch("/api/transactions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    load();
  }

  async function updateOne(id: string, patch: Record<string, unknown>) {
    await fetch("/api/transactions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [id], ...patch }),
    });
    load();
  }

  async function deleteSelected() {
    if (selected.size === 0) return;
    if (!confirm(`Excluir ${selected.size} transações?`)) return;
    await fetch("/api/transactions", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [...selected] }),
    });
    load();
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="space-y-5 max-w-7xl">
      <h1 className="text-2xl font-bold">Transações</h1>

      <div className="bg-white rounded-xl shadow p-4 flex flex-wrap gap-3 items-end text-sm">
        <div>
          <label className="block text-xs text-slate-500 mb-1">Ano</label>
          <select
            className="border border-slate-300 rounded-lg px-2 py-1.5"
            value={filters.year}
            onChange={(e) => { setFilters({ ...filters, year: e.target.value }); setPage(1); }}
          >
            {[currentYear + 1, currentYear, currentYear - 1, currentYear - 2].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Mês</label>
          <select
            className="border border-slate-300 rounded-lg px-2 py-1.5"
            value={filters.month}
            onChange={(e) => { setFilters({ ...filters, month: e.target.value }); setPage(1); }}
          >
            <option value="">Todos</option>
            {MONTHS_PT.map((m, i) => (
              <option key={m} value={i + 1}>{m}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Origem</label>
          <select
            className="border border-slate-300 rounded-lg px-2 py-1.5"
            value={filters.bankAccountId}
            onChange={(e) => { setFilters({ ...filters, bankAccountId: e.target.value }); setPage(1); }}
          >
            <option value="">Todas</option>
            {meta?.bankAccounts.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Conta DRE</label>
          <select
            className="border border-slate-300 rounded-lg px-2 py-1.5 max-w-48"
            value={filters.accountId}
            onChange={(e) => { setFilters({ ...filters, accountId: e.target.value }); setPage(1); }}
          >
            <option value="">Todas</option>
            {meta?.accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.code} {a.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Buscar</label>
          <input
            className="border border-slate-300 rounded-lg px-2 py-1.5"
            placeholder="descrição..."
            value={filters.q}
            onChange={(e) => { setFilters({ ...filters, q: e.target.value }); setPage(1); }}
          />
        </div>
        <label className="flex items-center gap-2 pb-1.5">
          <input
            type="checkbox"
            checked={filters.unclassified}
            onChange={(e) => { setFilters({ ...filters, unclassified: e.target.checked }); setPage(1); }}
          />
          Só não classificadas
        </label>
      </div>

      {selected.size > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex flex-wrap gap-3 items-center text-sm">
          <span className="font-medium">{selected.size} selecionadas:</span>
          <select
            className="border border-slate-300 rounded-lg px-2 py-1.5"
            value={bulk.accountId}
            onChange={(e) => setBulk({ ...bulk, accountId: e.target.value })}
          >
            <option value="">Conta DRE...</option>
            {meta?.accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.code} {a.name}</option>
            ))}
          </select>
          <select
            className="border border-slate-300 rounded-lg px-2 py-1.5"
            value={bulk.sectorId}
            onChange={(e) => setBulk({ ...bulk, sectorId: e.target.value })}
          >
            <option value="">Setor...</option>
            {meta?.sectors.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <select
            className="border border-slate-300 rounded-lg px-2 py-1.5"
            value={bulk.unitId}
            onChange={(e) => setBulk({ ...bulk, unitId: e.target.value })}
          >
            <option value="">Unidade...</option>
            {meta?.units.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
          <button onClick={applyBulk} className="bg-blue-600 text-white rounded-lg px-3 py-1.5 font-medium hover:bg-blue-700">
            Aplicar
          </button>
          <button onClick={deleteSelected} className="text-red-600 hover:underline">
            Excluir
          </button>
        </div>
      )}

      <div className="bg-white rounded-xl shadow p-4">
        <div className="flex justify-between items-center mb-3 text-sm text-slate-600">
          <span>
            {data?.total ?? 0} transações · Saldo:{" "}
            <span className={`font-semibold ${(data?.sumCents ?? 0) < 0 ? "text-red-600" : "text-green-700"}`}>
              {formatBRL(data?.sumCents ?? 0)}
            </span>
          </span>
          <span>
            Página {page} de {totalPages}{" "}
            <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="px-2 disabled:opacity-30">◀</button>
            <button disabled={page >= totalPages} onClick={() => setPage(page + 1)} className="px-2 disabled:opacity-30">▶</button>
          </span>
        </div>
        {loading ? (
          <p className="text-sm text-slate-500 py-8 text-center">Carregando...</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b">
                  <th className="py-2 pr-2">
                    <input
                      type="checkbox"
                      checked={!!data && data.items.length > 0 && selected.size === data.items.length}
                      onChange={(e) =>
                        setSelected(e.target.checked ? new Set(data?.items.map((t) => t.id)) : new Set())
                      }
                    />
                  </th>
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
                  <tr key={t.id} className={`border-b last:border-0 ${!t.accountId ? "bg-amber-50/50" : ""}`}>
                    <td className="py-1.5 pr-2">
                      <input type="checkbox" checked={selected.has(t.id)} onChange={() => toggle(t.id)} />
                    </td>
                    <td className="py-1.5 pr-3 whitespace-nowrap">
                      {new Date(t.date).toLocaleDateString("pt-BR", { timeZone: "UTC" })}
                    </td>
                    <td className="py-1.5 pr-3 max-w-sm truncate" title={t.description}>{t.description}</td>
                    <td className="py-1.5 pr-3 text-xs text-slate-500 whitespace-nowrap">{t.bankAccount.name}</td>
                    <td className={`py-1.5 pr-3 text-right whitespace-nowrap ${t.amountCents < 0 ? "text-red-600" : "text-green-700"}`}>
                      {formatBRL(t.amountCents)}
                    </td>
                    <td className="py-1.5 pr-3">
                      <select
                        className="border border-slate-200 rounded px-1.5 py-1 text-xs max-w-44"
                        value={t.accountId ?? ""}
                        onChange={(e) => updateOne(t.id, { accountId: e.target.value || null })}
                      >
                        <option value="">— classificar —</option>
                        {meta?.accounts.map((a) => (
                          <option key={a.id} value={a.id}>{a.code} {a.name}</option>
                        ))}
                      </select>
                    </td>
                    <td className="py-1.5 pr-3">
                      <select
                        className="border border-slate-200 rounded px-1.5 py-1 text-xs"
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
                        className="border border-slate-200 rounded px-1.5 py-1 text-xs"
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
    </div>
  );
}
