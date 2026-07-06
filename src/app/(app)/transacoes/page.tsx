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
  recurring: boolean;
  installmentNum: number | null;
  installmentTotal: number | null;
  account: { code: string; name: string } | null;
  sector: { name: string } | null;
  unit: { name: string } | null;
  bankAccount: { name: string };
}

interface TxResponse {
  total: number;
  page: number;
  pageSize: number;
  inCents: number;
  outCents: number;
  sumCents: number;
  items: Tx[];
}

const currentYear = new Date().getFullYear();

const EMPTY_FILTERS = {
  year: String(currentYear),
  month: "",
  bankAccountId: "",
  accountId: "",
  sectorId: "",
  unitId: "",
  unclassified: false,
  q: "",
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">{label}</span>
      {children}
    </div>
  );
}

const selectCls =
  "border border-slate-300 rounded-lg px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500";

export default function TransacoesPage() {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [filters, setFilters] = useState({ ...EMPTY_FILTERS });
  const [data, setData] = useState<TxResponse | null>(null);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [allFiltered, setAllFiltered] = useState(false); // aplicar a TODOS os resultados do filtro
  const [bulk, setBulk] = useState({ accountId: "", sectorId: "", unitId: "", recurring: "" });
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState("");

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
    if (filters.sectorId) p.set("sectorId", filters.sectorId);
    if (filters.unitId) p.set("unitId", filters.unitId);
    if (filters.unclassified) p.set("unclassified", "1");
    if (filters.q) p.set("q", filters.q);
    p.set("page", String(page));
    const res = await fetch(`/api/transactions?${p}`);
    setData(await res.json());
    setSelected(new Set());
    setAllFiltered(false);
    setLoading(false);
  }, [filters, page]);

  function filterParams(): Record<string, string> {
    const f: Record<string, string> = {};
    if (filters.year) f.year = filters.year;
    if (filters.month) f.month = filters.month;
    if (filters.bankAccountId) f.bankAccountId = filters.bankAccountId;
    if (filters.accountId) f.accountId = filters.accountId;
    if (filters.sectorId) f.sectorId = filters.sectorId;
    if (filters.unitId) f.unitId = filters.unitId;
    if (filters.unclassified) f.unclassified = "1";
    if (filters.q) f.q = filters.q;
    return f;
  }

  useEffect(() => {
    load();
  }, [load]);

  function setFilter(patch: Partial<typeof filters>) {
    setFilters({ ...filters, ...patch });
    setPage(1);
  }

  const hasActiveFilters =
    JSON.stringify({ ...filters, year: "" }) !== JSON.stringify({ ...EMPTY_FILTERS, year: "" });

  function toggle(id: string) {
    const s = new Set(selected);
    if (s.has(id)) s.delete(id);
    else s.add(id);
    setSelected(s);
  }

  async function applyBulk() {
    if (selected.size === 0 && !allFiltered) return;
    const body: Record<string, unknown> = allFiltered
      ? { filter: filterParams() }
      : { ids: [...selected] };
    if (bulk.accountId) body.accountId = bulk.accountId;
    if (bulk.sectorId) body.sectorId = bulk.sectorId;
    if (bulk.unitId) body.unitId = bulk.unitId;
    if (bulk.recurring === "1") body.recurring = true;
    if (bulk.recurring === "0") body.recurring = false;
    if (!bulk.accountId && !bulk.sectorId && !bulk.unitId && !bulk.recurring) return;
    const res = await fetch("/api/transactions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const d = await res.json();
    setFeedback(res.ok ? `✅ ${d.updated} lançamentos atualizados.` : d.error ?? "Erro ao atualizar");
    setBulk({ accountId: "", sectorId: "", unitId: "", recurring: "" });
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
    <div className="space-y-4 max-w-7xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Transações</h1>
        <p className="text-sm text-slate-500">Classifique os lançamentos por conta do DRE, setor e unidade</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
          <Field label="Ano">
            <select className={selectCls} value={filters.year} onChange={(e) => setFilter({ year: e.target.value })}>
              {[currentYear + 1, currentYear, currentYear - 1, currentYear - 2].map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </Field>
          <Field label="Mês">
            <select className={selectCls} value={filters.month} onChange={(e) => setFilter({ month: e.target.value })}>
              <option value="">Todos</option>
              {MONTHS_PT.map((m, i) => (
                <option key={m} value={i + 1}>{m}</option>
              ))}
            </select>
          </Field>
          <Field label="Origem">
            <select className={selectCls} value={filters.bankAccountId} onChange={(e) => setFilter({ bankAccountId: e.target.value })}>
              <option value="">Todas</option>
              {meta?.bankAccounts.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Conta DRE">
            <select className={selectCls} value={filters.accountId} onChange={(e) => setFilter({ accountId: e.target.value })}>
              <option value="">Todas</option>
              {meta?.accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.code} {a.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Setor">
            <select className={selectCls} value={filters.sectorId} onChange={(e) => setFilter({ sectorId: e.target.value })}>
              <option value="">Todos</option>
              {meta?.sectors.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Unidade">
            <select className={selectCls} value={filters.unitId} onChange={(e) => setFilter({ unitId: e.target.value })}>
              <option value="">Todas</option>
              {meta?.units.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Descrição">
            <input
              className={selectCls}
              placeholder="contém o texto..."
              value={filters.q}
              onChange={(e) => setFilter({ q: e.target.value })}
            />
          </Field>
          <Field label="Situação">
            <label className="flex items-center gap-2 text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 bg-slate-50 cursor-pointer">
              <input
                type="checkbox"
                checked={filters.unclassified}
                onChange={(e) => setFilter({ unclassified: e.target.checked })}
              />
              Só pendentes
            </label>
          </Field>
        </div>
        {hasActiveFilters && (
          <button
            onClick={() => { setFilters({ ...EMPTY_FILTERS, year: filters.year }); setPage(1); }}
            className="mt-3 text-xs text-blue-600 hover:underline"
          >
            ✕ Limpar filtros
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 px-4 py-2.5">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide block">Transações</span>
          <span className="text-lg font-bold">{data?.total ?? 0}</span>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 px-4 py-2.5">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide block">Entradas</span>
          <span className="text-lg font-bold text-emerald-600">{formatBRL(data?.inCents ?? 0)}</span>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 px-4 py-2.5">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide block">Saídas</span>
          <span className="text-lg font-bold text-red-600">{formatBRL(data?.outCents ?? 0)}</span>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 px-4 py-2.5">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide block">Saldo do período</span>
          <span className={`text-lg font-bold ${(data?.sumCents ?? 0) < 0 ? "text-red-600" : "text-emerald-600"}`}>
            {formatBRL(data?.sumCents ?? 0)}
          </span>
        </div>
      </div>

      {feedback && (
        <p className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-sm text-emerald-800 flex items-center justify-between">
          {feedback}
          <button onClick={() => setFeedback("")} className="text-emerald-600 hover:text-emerald-900 px-2">✕</button>
        </p>
      )}

      {(selected.size > 0 || allFiltered) && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 space-y-2 text-sm sticky top-2 z-20 shadow">
          {selected.size === (data?.items.length ?? 0) && (data?.total ?? 0) > selected.size && !allFiltered && (
            <p className="text-blue-800">
              Os {selected.size} lançamentos desta página estão selecionados.{" "}
              <button onClick={() => setAllFiltered(true)} className="font-semibold underline">
                Selecionar todos os {data?.total} lançamentos do filtro
              </button>
            </p>
          )}
          {allFiltered && (
            <p className="text-blue-800">
              ⚡ A classificação será aplicada a <b>todos os {data?.total} lançamentos</b> que casam com o
              filtro atual (todas as páginas).{" "}
              <button onClick={() => setAllFiltered(false)} className="font-semibold underline">
                Voltar à seleção da página
              </button>
            </p>
          )}
          <div className="flex flex-wrap gap-3 items-center">
          <span className="font-semibold text-blue-900">
            {allFiltered ? `${data?.total ?? 0} do filtro →` : `${selected.size} selecionadas →`}
          </span>
          <select className={selectCls} value={bulk.accountId} onChange={(e) => setBulk({ ...bulk, accountId: e.target.value })}>
            <option value="">Conta DRE...</option>
            {meta?.accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.code} {a.name}</option>
            ))}
          </select>
          <select className={selectCls} value={bulk.sectorId} onChange={(e) => setBulk({ ...bulk, sectorId: e.target.value })}>
            <option value="">Setor...</option>
            {meta?.sectors.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <select className={selectCls} value={bulk.unitId} onChange={(e) => setBulk({ ...bulk, unitId: e.target.value })}>
            <option value="">Unidade...</option>
            {meta?.units.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
          <select className={selectCls} value={bulk.recurring} onChange={(e) => setBulk({ ...bulk, recurring: e.target.value })}>
            <option value="">Fixa mensal...</option>
            <option value="1">📌 Marcar como fixa</option>
            <option value="0">Desmarcar fixa</option>
          </select>
          <button onClick={applyBulk} className="bg-blue-600 text-white rounded-lg px-4 py-1.5 font-semibold hover:bg-blue-700">
            Aplicar
          </button>
          {!allFiltered && (
            <button onClick={deleteSelected} className="text-red-600 hover:underline">
              Excluir
            </button>
          )}
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4">
        <div className="flex justify-between items-center mb-3 text-sm text-slate-600">
          <span>
            {filters.unclassified ? "Mostrando apenas pendentes de classificação" : "Todos os lançamentos do filtro"}
          </span>
          <span className="flex items-center gap-1">
            Página {page} de {totalPages}
            <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="px-2 py-0.5 rounded hover:bg-slate-100 disabled:opacity-30">◀</button>
            <button disabled={page >= totalPages} onClick={() => setPage(page + 1)} className="px-2 py-0.5 rounded hover:bg-slate-100 disabled:opacity-30">▶</button>
          </span>
        </div>
        {loading ? (
          <p className="text-sm text-slate-500 py-10 text-center">Carregando...</p>
        ) : data?.items.length === 0 ? (
          <p className="text-sm text-slate-500 py-10 text-center">Nenhuma transação encontrada com esses filtros.</p>
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
                  <th className="py-2 pr-3" title="Despesa fixa mensal: projeta a média nos meses futuros do DRE">Fixa</th>
                  <th className="py-2 pr-3">Conta DRE</th>
                  <th className="py-2 pr-3">Setor</th>
                  <th className="py-2">Unidade</th>
                </tr>
              </thead>
              <tbody>
                {data?.items.map((t) => (
                  <tr key={t.id} className={`border-b last:border-0 hover:bg-slate-50 ${!t.accountId ? "bg-amber-50/60" : ""}`}>
                    <td className="py-1.5 pr-2">
                      <input type="checkbox" checked={selected.has(t.id)} onChange={() => toggle(t.id)} />
                    </td>
                    <td className="py-1.5 pr-3 whitespace-nowrap text-slate-600">
                      {new Date(t.date).toLocaleDateString("pt-BR", { timeZone: "UTC" })}
                    </td>
                    <td className="py-1.5 pr-3 max-w-sm truncate" title={t.description}>
                      {t.description}
                      {t.installmentNum != null && t.installmentTotal != null && (
                        <span className="ml-1.5 text-[10px] bg-sky-100 text-sky-700 rounded px-1 py-0.5 whitespace-nowrap">
                          parc. {t.installmentNum}/{t.installmentTotal}
                        </span>
                      )}
                    </td>
                    <td className="py-1.5 pr-3 text-xs text-slate-500 whitespace-nowrap">{t.bankAccount.name}</td>
                    <td className={`py-1.5 pr-3 text-right whitespace-nowrap font-medium tabular-nums ${t.amountCents < 0 ? "text-red-600" : "text-emerald-600"}`}>
                      {formatBRL(t.amountCents)}
                    </td>
                    <td className="py-1.5 pr-3">
                      <button
                        onClick={() => updateOne(t.id, { recurring: !t.recurring })}
                        title={t.recurring ? "Despesa fixa mensal (clique para desmarcar)" : "Marcar como despesa fixa mensal"}
                        className={`text-base leading-none rounded px-1 py-0.5 transition-all ${
                          t.recurring ? "" : "opacity-20 grayscale hover:opacity-60"
                        }`}
                      >
                        📌
                      </button>
                    </td>
                    <td className="py-1.5 pr-3">
                      <select
                        className="border border-slate-200 rounded px-1.5 py-1 text-xs max-w-44 bg-white"
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
                        className="border border-slate-200 rounded px-1.5 py-1 text-xs bg-white"
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
                        className="border border-slate-200 rounded px-1.5 py-1 text-xs bg-white"
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
