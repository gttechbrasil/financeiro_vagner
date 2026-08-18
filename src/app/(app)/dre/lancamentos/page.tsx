"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { formatBRL, MONTHS_PT } from "@/lib/money";

interface Meta {
  accounts: { id: string; code: string; name: string; group: string }[];
  sectors: { id: string; name: string }[];
  units: { id: string; name: string }[];
  suppliers: { id: string; name: string }[];
}

interface Tx {
  id: string;
  date: string;
  description: string;
  amountCents: number;
  accountId: string | null;
  sectorId: string | null;
  unitId: string | null;
  supplierId: string | null;
  recurring: boolean;
  notes: string | null;
  installmentNum: number | null;
  installmentTotal: number | null;
  account: { code: string; name: string } | null;
  sector: { name: string } | null;
  unit: { name: string } | null;
  supplier: { name: string } | null;
  bankAccount: { name: string };
  importBatch: { id: string; fileName: string; source: string; createdAt: string } | null;
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

const GROUP_LABELS: Record<string, string> = {
  RECEITA: "1. Receitas Operacionais",
  DEDUCAO: "2. Deduções da Receita",
  CUSTO: "3. Custos Diretos",
  DESPESA: "4. Despesas Operacionais",
  FINANCEIRO: "5. Resultado Financeiro",
  NAO_OPERACIONAL: "6. Resultado Não Operacional",
  PRO_LABORE: "7. Pró-Labore",
  DISTRIBUICAO: "8. Distribuição de Lucros",
};

const selectCls = "border border-slate-200 rounded px-1.5 py-1 text-xs bg-white";

function Content() {
  const params = useSearchParams();
  const year = params.get("ano") ?? String(new Date().getFullYear());
  const month = params.get("mes") ?? "";
  const accountId = params.get("conta") ?? "";
  const group = params.get("grupo") ?? "";

  const [meta, setMeta] = useState<Meta | null>(null);
  const [data, setData] = useState<TxResponse | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [edit, setEdit] = useState<Tx | null>(null);
  const [editForm, setEditForm] = useState({
    date: "",
    description: "",
    amount: "",
    accountId: "",
    sectorId: "",
    unitId: "",
    supplierId: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/meta").then((r) => r.json()).then(setMeta);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const p = new URLSearchParams({ year, page: String(page) });
    if (month) p.set("month", month);
    if (accountId) p.set("accountId", accountId);
    if (group) p.set("group", group);
    const res = await fetch(`/api/transactions?${p}`);
    setData(await res.json());
    setLoading(false);
  }, [year, month, accountId, group, page]);

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
  }

  function openEdit(t: Tx) {
    setEdit(t);
    setEditForm({
      date: t.date.slice(0, 10),
      description: t.description,
      amount: (t.amountCents / 100).toFixed(2),
      accountId: t.accountId ?? "",
      sectorId: t.sectorId ?? "",
      unitId: t.unitId ?? "",
      supplierId: t.supplierId ?? "",
      notes: t.notes ?? "",
    });
  }

  async function saveEdit() {
    if (!edit) return;
    const cents = Math.round(Number(editForm.amount.replace(",", ".")) * 100);
    if (!editForm.date || !editForm.description || Number.isNaN(cents)) return;
    setSaving(true);
    await fetch("/api/transactions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ids: [edit.id],
        date: editForm.date,
        description: editForm.description,
        amountCents: cents,
        accountId: editForm.accountId || null,
        sectorId: editForm.sectorId || null,
        unitId: editForm.unitId || null,
        supplierId: editForm.supplierId || null,
        notes: editForm.notes || null,
      }),
    });
    setSaving(false);
    setEdit(null);
    load();
  }

  const account = meta?.accounts.find((a) => a.id === accountId);
  const title = account
    ? `${account.code} ${account.name}`
    : group
      ? GROUP_LABELS[group] ?? group
      : "Lançamentos";
  const period = month ? `${MONTHS_PT[Number(month) - 1]} de ${year}` : `Ano de ${year}`;
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="space-y-4 max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href={`/dre?ano=${year}`} className="text-sm text-blue-600 hover:underline">
            ← Voltar ao DRE
          </Link>
          <h1 className="text-2xl font-bold tracking-tight mt-1">{title}</h1>
          <p className="text-sm text-slate-500">
            Lançamentos que compõem o valor · {period}
          </p>
        </div>
        <div className="text-right">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide block">
            Total do período
          </span>
          <span className={`text-xl font-bold ${(data?.sumCents ?? 0) < 0 ? "text-red-600" : "text-emerald-600"}`}>
            {formatBRL(data?.sumCents ?? 0)}
          </span>
          <span className="block text-xs text-slate-500">{data?.total ?? 0} lançamentos</span>
        </div>
      </div>

      <p className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-sm text-blue-800">
        💡 Ajuste a <b>conta DRE</b>, o <b>setor</b> e a <b>unidade</b> direto na lista — sem voltar
        para Transações. Clique na descrição para abrir e editar o lançamento completo.
      </p>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4">
        <div className="flex justify-between items-center mb-3 text-sm text-slate-600">
          <span />
          <span className="flex items-center gap-1">
            Página {page} de {totalPages}
            <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="px-2 py-0.5 rounded hover:bg-slate-100 disabled:opacity-30">◀</button>
            <button disabled={page >= totalPages} onClick={() => setPage(page + 1)} className="px-2 py-0.5 rounded hover:bg-slate-100 disabled:opacity-30">▶</button>
          </span>
        </div>
        {loading ? (
          <p className="text-sm text-slate-500 py-10 text-center">Carregando...</p>
        ) : data?.items.length === 0 ? (
          <p className="text-sm text-slate-500 py-10 text-center">Nenhum lançamento neste período.</p>
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
                  <tr key={t.id} className="border-b last:border-0 hover:bg-slate-50">
                    <td className="py-1.5 pr-3 whitespace-nowrap text-slate-600">
                      {new Date(t.date).toLocaleDateString("pt-BR", { timeZone: "UTC" })}
                    </td>
                    <td className="py-1.5 pr-3 max-w-sm truncate">
                      <button
                        onClick={() => openEdit(t)}
                        className="hover:underline hover:text-blue-700 text-left truncate max-w-full"
                        title={`${t.description} — clique para editar o lançamento`}
                      >
                        {t.description}
                      </button>
                      {t.installmentNum != null && t.installmentTotal != null && (
                        <span className="ml-1.5 text-[10px] bg-sky-100 text-sky-700 rounded px-1 py-0.5 whitespace-nowrap">
                          parc. {t.installmentNum}/{t.installmentTotal}
                        </span>
                      )}
                      {t.supplier && (
                        <span className="ml-1.5 text-[10px] bg-violet-100 text-violet-700 rounded px-1 py-0.5 whitespace-nowrap">
                          {t.supplier.name}
                        </span>
                      )}
                    </td>
                    <td className="py-1.5 pr-3 text-xs text-slate-500 whitespace-nowrap">{t.bankAccount.name}</td>
                    <td className={`py-1.5 pr-3 text-right whitespace-nowrap font-medium tabular-nums ${t.amountCents < 0 ? "text-red-600" : "text-emerald-600"}`}>
                      {formatBRL(t.amountCents)}
                    </td>
                    <td className="py-1.5 pr-3">
                      <select
                        className={`${selectCls} max-w-44`}
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

      {edit && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setEdit(null)}>
          <div className="bg-white rounded-xl shadow-xl p-5 w-full max-w-lg space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-semibold leading-snug">Editar lançamento</h3>
              <button onClick={() => setEdit(null)} className="text-slate-400 hover:text-slate-700 shrink-0">✕</button>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Data</label>
                <input
                  type="date"
                  className="w-full border border-slate-300 rounded-lg px-2 py-1.5"
                  value={editForm.date}
                  onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Valor (R$, negativo = despesa)</label>
                <input
                  className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-right"
                  value={editForm.amount}
                  onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })}
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-slate-500 mb-1">Descrição</label>
                <input
                  className="w-full border border-slate-300 rounded-lg px-2 py-1.5"
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Conta DRE</label>
                <select
                  className="w-full border border-slate-300 rounded-lg px-2 py-1.5 bg-white"
                  value={editForm.accountId}
                  onChange={(e) => setEditForm({ ...editForm, accountId: e.target.value })}
                >
                  <option value="">— sem conta —</option>
                  {meta?.accounts.map((a) => (
                    <option key={a.id} value={a.id}>{a.code} {a.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Fornecedor</label>
                <select
                  className="w-full border border-slate-300 rounded-lg px-2 py-1.5 bg-white"
                  value={editForm.supplierId}
                  onChange={(e) => setEditForm({ ...editForm, supplierId: e.target.value })}
                >
                  <option value="">—</option>
                  {meta?.suppliers.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Setor</label>
                <select
                  className="w-full border border-slate-300 rounded-lg px-2 py-1.5 bg-white"
                  value={editForm.sectorId}
                  onChange={(e) => setEditForm({ ...editForm, sectorId: e.target.value })}
                >
                  <option value="">—</option>
                  {meta?.sectors.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Unidade</label>
                <select
                  className="w-full border border-slate-300 rounded-lg px-2 py-1.5 bg-white"
                  value={editForm.unitId}
                  onChange={(e) => setEditForm({ ...editForm, unitId: e.target.value })}
                >
                  <option value="">—</option>
                  {meta?.units.map((u) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-slate-500 mb-1">Observações</label>
                <textarea
                  className="w-full border border-slate-300 rounded-lg px-2 py-1.5"
                  rows={2}
                  value={editForm.notes}
                  onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                />
              </div>
            </div>
            <div className="flex items-center justify-between border-t border-slate-100 pt-3">
              <span className="text-xs text-slate-500">
                {edit.bankAccount.name}
                {edit.importBatch && (
                  <>
                    {" · "}
                    <a href={`/api/batches/${edit.importBatch.id}/file`} className="underline hover:text-blue-700">
                      arquivo original
                    </a>
                  </>
                )}
              </span>
              <div className="flex gap-2">
                <button onClick={() => setEdit(null)} className="text-sm px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50">
                  Cancelar
                </button>
                <button
                  onClick={saveEdit}
                  disabled={saving}
                  className="text-sm px-4 py-1.5 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? "Salvando..." : "Salvar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DreLancamentosPage() {
  return (
    <Suspense fallback={<p className="text-sm text-slate-500">Carregando...</p>}>
      <Content />
    </Suspense>
  );
}
