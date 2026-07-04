"use client";

import { useEffect, useState } from "react";

interface Meta {
  accounts: { id: string; code: string; name: string }[];
  sectors: { id: string; name: string }[];
  units: { id: string; name: string }[];
}

interface Rule {
  id: string;
  pattern: string;
  accountId: string;
  sectorId: string | null;
  unitId: string | null;
  priority: number;
  active: boolean;
  account: { code: string; name: string };
  sector: { name: string } | null;
  unit: { name: string } | null;
}

export default function RegrasPage() {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [rules, setRules] = useState<Rule[]>([]);
  const [form, setForm] = useState({ pattern: "", accountId: "", sectorId: "", unitId: "" });
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/meta").then((r) => r.json()).then(setMeta);
    load();
  }, []);

  function load() {
    fetch("/api/rules").then((r) => r.json()).then(setRules);
  }

  async function create() {
    setError("");
    const res = await fetch("/api/rules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pattern: form.pattern,
        accountId: form.accountId,
        sectorId: form.sectorId || null,
        unitId: form.unitId || null,
      }),
    });
    if (!res.ok) {
      const d = await res.json();
      setError(d.error ?? "Erro ao criar regra");
      return;
    }
    setForm({ pattern: "", accountId: "", sectorId: "", unitId: "" });
    load();
  }

  async function toggleActive(r: Rule) {
    await fetch("/api/rules", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: r.id, active: !r.active }),
    });
    load();
  }

  async function remove(id: string) {
    if (!confirm("Excluir esta regra?")) return;
    await fetch("/api/rules", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    load();
  }

  return (
    <div className="space-y-5 max-w-5xl">
      <h1 className="text-2xl font-bold">Regras de Classificação</h1>
      <p className="text-sm text-slate-600">
        Durante a importação, se a descrição do lançamento <b>contiver</b> o padrão (sem diferenciar
        maiúsculas), a conta do DRE, o setor e a unidade são aplicados automaticamente.
      </p>

      <div className="bg-white rounded-xl shadow p-4 flex flex-wrap gap-3 items-end text-sm">
        <div className="flex-1 min-w-40">
          <label className="block text-xs text-slate-500 mb-1">Se a descrição contém...</label>
          <input
            className="w-full border border-slate-300 rounded-lg px-2 py-1.5"
            placeholder="ex.: GOOGLE ADS"
            value={form.pattern}
            onChange={(e) => setForm({ ...form, pattern: e.target.value })}
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Conta DRE</label>
          <select
            className="border border-slate-300 rounded-lg px-2 py-1.5 max-w-52"
            value={form.accountId}
            onChange={(e) => setForm({ ...form, accountId: e.target.value })}
          >
            <option value="">Selecione...</option>
            {meta?.accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.code} {a.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Setor</label>
          <select
            className="border border-slate-300 rounded-lg px-2 py-1.5"
            value={form.sectorId}
            onChange={(e) => setForm({ ...form, sectorId: e.target.value })}
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
            className="border border-slate-300 rounded-lg px-2 py-1.5"
            value={form.unitId}
            onChange={(e) => setForm({ ...form, unitId: e.target.value })}
          >
            <option value="">—</option>
            {meta?.units.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        </div>
        <button
          onClick={create}
          disabled={!form.pattern || !form.accountId}
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
              <th className="py-2 pr-3">Padrão</th>
              <th className="py-2 pr-3">Conta DRE</th>
              <th className="py-2 pr-3">Setor</th>
              <th className="py-2 pr-3">Unidade</th>
              <th className="py-2 pr-3">Ativa</th>
              <th className="py-2"></th>
            </tr>
          </thead>
          <tbody>
            {rules.map((r) => (
              <tr key={r.id} className={`border-b last:border-0 ${!r.active ? "opacity-50" : ""}`}>
                <td className="py-2 pr-3 font-mono text-xs">{r.pattern}</td>
                <td className="py-2 pr-3">{r.account.code} {r.account.name}</td>
                <td className="py-2 pr-3">{r.sector?.name ?? "—"}</td>
                <td className="py-2 pr-3">{r.unit?.name ?? "—"}</td>
                <td className="py-2 pr-3">
                  <button onClick={() => toggleActive(r)} className="text-xs underline">
                    {r.active ? "Sim" : "Não"}
                  </button>
                </td>
                <td className="py-2 text-right">
                  <button onClick={() => remove(r.id)} className="text-red-600 hover:underline text-xs">
                    Excluir
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
