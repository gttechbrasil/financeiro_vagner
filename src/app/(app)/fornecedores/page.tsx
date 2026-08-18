"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

interface Meta {
  accounts: { id: string; code: string; name: string }[];
  sectors: { id: string; name: string }[];
  units: { id: string; name: string }[];
}

interface Supplier {
  id: string;
  name: string;
  pattern: string | null;
  defaultAccountId: string | null;
  defaultSectorId: string | null;
  defaultUnitId: string | null;
  active: boolean;
  defaultAccount: { code: string; name: string } | null;
  defaultSector: { name: string } | null;
  defaultUnit: { name: string } | null;
  _count: { transactions: number };
}

const selectCls = "border border-slate-200 rounded px-1.5 py-1 text-xs bg-white";

export default function FornecedoresPage() {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [form, setForm] = useState({ name: "", pattern: "", defaultAccountId: "", defaultSectorId: "", defaultUnitId: "" });
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const [applying, setApplying] = useState(false);

  const load = useCallback(() => {
    fetch("/api/suppliers").then((r) => r.json()).then(setSuppliers);
  }, []);

  useEffect(() => {
    fetch("/api/meta").then((r) => r.json()).then(setMeta);
    load();
  }, [load]);

  async function create() {
    setError("");
    const res = await fetch("/api/suppliers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (!res.ok) {
      const d = await res.json();
      setError(d.error ?? "Erro ao criar fornecedor");
      return;
    }
    setForm({ name: "", pattern: "", defaultAccountId: "", defaultSectorId: "", defaultUnitId: "" });
    load();
  }

  async function update(id: string, patch: Record<string, unknown>) {
    await fetch("/api/suppliers", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...patch }),
    });
    load();
  }

  async function remove(id: string) {
    if (!confirm("Excluir este fornecedor? Os lançamentos serão desvinculados (mas mantêm a conta DRE).")) return;
    await fetch("/api/suppliers", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    load();
  }

  async function applyAll() {
    setApplying(true);
    setFeedback("");
    const res = await fetch("/api/suppliers/apply", { method: "POST" });
    const d = await res.json();
    setApplying(false);
    setFeedback(
      `✅ ${d.linked} lançamentos vinculados a fornecedores · ${d.classified} pendentes classificados com a conta padrão.`
    );
    load();
  }

  return (
    <div className="space-y-5 max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Fornecedores</h1>
          <p className="text-sm text-slate-600 mt-1">
            Defina a <b>classificação padrão</b> de cada fornecedor (ex.: AWS → Tecnologia). Na
            importação, lançamentos que contêm o padrão na descrição são vinculados e classificados
            automaticamente — sem precisar classificar de novo.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/relatorios?por=hierarchy"
            className="text-sm bg-white border border-slate-200 shadow-sm rounded-lg px-3 py-1.5 hover:border-blue-400 hover:text-blue-700"
          >
            📊 Conta → Fornecedor → Lançamentos
          </Link>
          <button
            onClick={applyAll}
            disabled={applying}
            className="text-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg px-3 py-1.5 font-semibold"
            title="Vincula fornecedores e aplica a conta padrão aos lançamentos já importados"
          >
            {applying ? "Aplicando..." : "⚡ Aplicar aos lançamentos existentes"}
          </button>
        </div>
      </div>

      {feedback && (
        <p className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-sm text-emerald-800 flex items-center justify-between">
          {feedback}
          <button onClick={() => setFeedback("")} className="text-emerald-600 hover:text-emerald-900 px-2">✕</button>
        </p>
      )}

      <div className="bg-white rounded-xl shadow p-4 flex flex-wrap gap-3 items-end text-sm">
        <div className="flex-1 min-w-36">
          <label className="block text-xs text-slate-500 mb-1">Fornecedor</label>
          <input
            className="w-full border border-slate-300 rounded-lg px-2 py-1.5"
            placeholder="ex.: AWS"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </div>
        <div className="flex-1 min-w-36">
          <label className="block text-xs text-slate-500 mb-1">Descrição contém (opcional)</label>
          <input
            className="w-full border border-slate-300 rounded-lg px-2 py-1.5"
            placeholder="se vazio, usa o nome"
            value={form.pattern}
            onChange={(e) => setForm({ ...form, pattern: e.target.value })}
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Conta DRE padrão</label>
          <select
            className="border border-slate-300 rounded-lg px-2 py-1.5 max-w-52 bg-white"
            value={form.defaultAccountId}
            onChange={(e) => setForm({ ...form, defaultAccountId: e.target.value })}
          >
            <option value="">—</option>
            {meta?.accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.code} {a.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Setor padrão</label>
          <select
            className="border border-slate-300 rounded-lg px-2 py-1.5 bg-white"
            value={form.defaultSectorId}
            onChange={(e) => setForm({ ...form, defaultSectorId: e.target.value })}
          >
            <option value="">—</option>
            {meta?.sectors.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Unidade padrão</label>
          <select
            className="border border-slate-300 rounded-lg px-2 py-1.5 bg-white"
            value={form.defaultUnitId}
            onChange={(e) => setForm({ ...form, defaultUnitId: e.target.value })}
          >
            <option value="">—</option>
            {meta?.units.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        </div>
        <button
          onClick={create}
          disabled={!form.name}
          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg px-4 py-1.5 font-semibold"
        >
          Adicionar
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="bg-white rounded-xl shadow p-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500 border-b">
              <th className="py-2 pr-3">Fornecedor</th>
              <th className="py-2 pr-3">Descrição contém</th>
              <th className="py-2 pr-3">Conta DRE padrão</th>
              <th className="py-2 pr-3">Setor</th>
              <th className="py-2 pr-3">Unidade</th>
              <th className="py-2 pr-3 text-right">Lançamentos</th>
              <th className="py-2 pr-3">Ativo</th>
              <th className="py-2"></th>
            </tr>
          </thead>
          <tbody>
            {suppliers.map((s) => (
              <tr key={s.id} className={`border-b last:border-0 ${!s.active ? "opacity-50" : ""}`}>
                <td className="py-2 pr-3 font-medium">{s.name}</td>
                <td className="py-2 pr-3 font-mono text-xs">{s.pattern ?? s.name}</td>
                <td className="py-2 pr-3">
                  <select
                    className={`${selectCls} max-w-48`}
                    value={s.defaultAccountId ?? ""}
                    onChange={(e) => update(s.id, { defaultAccountId: e.target.value || null })}
                  >
                    <option value="">—</option>
                    {meta?.accounts.map((a) => (
                      <option key={a.id} value={a.id}>{a.code} {a.name}</option>
                    ))}
                  </select>
                </td>
                <td className="py-2 pr-3">
                  <select
                    className={selectCls}
                    value={s.defaultSectorId ?? ""}
                    onChange={(e) => update(s.id, { defaultSectorId: e.target.value || null })}
                  >
                    <option value="">—</option>
                    {meta?.sectors.map((x) => (
                      <option key={x.id} value={x.id}>{x.name}</option>
                    ))}
                  </select>
                </td>
                <td className="py-2 pr-3">
                  <select
                    className={selectCls}
                    value={s.defaultUnitId ?? ""}
                    onChange={(e) => update(s.id, { defaultUnitId: e.target.value || null })}
                  >
                    <option value="">—</option>
                    {meta?.units.map((x) => (
                      <option key={x.id} value={x.id}>{x.name}</option>
                    ))}
                  </select>
                </td>
                <td className="py-2 pr-3 text-right tabular-nums">{s._count.transactions}</td>
                <td className="py-2 pr-3">
                  <button onClick={() => update(s.id, { active: !s.active })} className="text-xs underline">
                    {s.active ? "Sim" : "Não"}
                  </button>
                </td>
                <td className="py-2 text-right">
                  <button onClick={() => remove(s.id)} className="text-red-600 hover:underline text-xs">
                    Excluir
                  </button>
                </td>
              </tr>
            ))}
            {suppliers.length === 0 && (
              <tr>
                <td colSpan={8} className="py-8 text-center text-slate-500">
                  Nenhum fornecedor cadastrado ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
