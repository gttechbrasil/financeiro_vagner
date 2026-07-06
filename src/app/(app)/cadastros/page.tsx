"use client";

import { useCallback, useEffect, useState } from "react";

const TABS = [
  { key: "plano-de-contas", label: "Plano de Contas" },
  { key: "setores", label: "Setores" },
  { key: "unidades", label: "Unidades" },
  { key: "contas-bancarias", label: "Contas Bancárias" },
] as const;

const GROUPS = [
  { key: "RECEITA", label: "1. Receitas Operacionais" },
  { key: "DEDUCAO", label: "2. Deduções da Receita" },
  { key: "CUSTO", label: "3. Custos Diretos" },
  { key: "DESPESA", label: "4. Despesas Operacionais" },
  { key: "FINANCEIRO", label: "5. Resultado Financeiro" },
  { key: "NAO_OPERACIONAL", label: "6. Resultado Não Operacional" },
  { key: "PRO_LABORE", label: "7. Pró-Labore" },
  { key: "DISTRIBUICAO", label: "8. Distribuição de Lucros" },
  { key: "TRANSFERENCIA", label: "9. Transferências (fora do DRE)" },
];

const KINDS = [
  { key: "ASAAS", label: "Asaas" },
  { key: "CONTA_CORRENTE", label: "Conta corrente" },
  { key: "CARTAO_CREDITO", label: "Cartão de crédito" },
];

interface Item {
  id: string;
  name: string;
  code?: string;
  group?: string;
  kind?: string;
  active?: boolean;
}

export default function CadastrosPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("plano-de-contas");
  const [items, setItems] = useState<Item[]>([]);
  const [form, setForm] = useState({ name: "", code: "", group: "RECEITA", kind: "CONTA_CORRENTE" });
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const res = await fetch(`/api/cadastros/${tab}`);
    setItems(await res.json());
  }, [tab]);

  useEffect(() => {
    setForm({ name: "", code: "", group: "RECEITA", kind: "CONTA_CORRENTE" });
    setError("");
    load();
  }, [load]);

  async function create() {
    setError("");
    const body: Record<string, unknown> = { name: form.name };
    if (tab === "plano-de-contas") {
      body.code = form.code;
      body.group = form.group;
    }
    if (tab === "contas-bancarias") body.kind = form.kind;
    const res = await fetch(`/api/cadastros/${tab}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const d = await res.json();
      setError(d.error ?? "Erro ao criar");
      return;
    }
    setForm({ ...form, name: "", code: "" });
    load();
  }

  async function toggleActive(item: Item) {
    await fetch(`/api/cadastros/${tab}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: item.id, active: !item.active }),
    });
    load();
  }

  async function rename(item: Item) {
    const name = prompt("Novo nome:", item.name);
    if (!name || name === item.name) return;
    await fetch(`/api/cadastros/${tab}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: item.id, name }),
    });
    load();
  }

  async function remove(item: Item) {
    if (!confirm(`Excluir "${item.name}"?`)) return;
    const res = await fetch(`/api/cadastros/${tab}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: item.id }),
    });
    if (!res.ok) {
      const d = await res.json();
      setError(d.error ?? "Erro ao excluir");
      return;
    }
    load();
  }

  const hasActive = tab === "plano-de-contas" || tab === "contas-bancarias";

  return (
    <div className="space-y-5 max-w-4xl">
      <h1 className="text-2xl font-bold">Cadastros</h1>

      <div className="flex gap-2 flex-wrap">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`rounded-lg px-3 py-1.5 text-sm border ${
              tab === t.key ? "bg-blue-600 text-white border-blue-600" : "border-slate-300 bg-white hover:bg-slate-50"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow p-4 flex flex-wrap gap-3 items-end text-sm">
        {tab === "plano-de-contas" && (
          <>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Código</label>
              <input
                className="border border-slate-300 rounded-lg px-2 py-1.5 w-20"
                placeholder="4.15"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Grupo</label>
              <select
                className="border border-slate-300 rounded-lg px-2 py-1.5"
                value={form.group}
                onChange={(e) => setForm({ ...form, group: e.target.value })}
              >
                {GROUPS.map((g) => (
                  <option key={g.key} value={g.key}>{g.label}</option>
                ))}
              </select>
            </div>
          </>
        )}
        {tab === "contas-bancarias" && (
          <div>
            <label className="block text-xs text-slate-500 mb-1">Tipo</label>
            <select
              className="border border-slate-300 rounded-lg px-2 py-1.5"
              value={form.kind}
              onChange={(e) => setForm({ ...form, kind: e.target.value })}
            >
              {KINDS.map((k) => (
                <option key={k.key} value={k.key}>{k.label}</option>
              ))}
            </select>
          </div>
        )}
        <div className="flex-1 min-w-40">
          <label className="block text-xs text-slate-500 mb-1">Nome</label>
          <input
            className="w-full border border-slate-300 rounded-lg px-2 py-1.5"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </div>
        <button
          onClick={create}
          disabled={!form.name || (tab === "plano-de-contas" && !form.code)}
          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg px-4 py-1.5 font-semibold"
        >
          Adicionar
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="bg-white rounded-xl shadow p-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500 border-b">
              {tab === "plano-de-contas" && <th className="py-2 pr-3 w-16">Código</th>}
              <th className="py-2 pr-3">Nome</th>
              {tab === "plano-de-contas" && <th className="py-2 pr-3">Grupo</th>}
              {tab === "contas-bancarias" && <th className="py-2 pr-3">Tipo</th>}
              {hasActive && <th className="py-2 pr-3">Ativo</th>}
              <th className="py-2"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className={`border-b last:border-0 ${item.active === false ? "opacity-50" : ""}`}>
                {tab === "plano-de-contas" && <td className="py-2 pr-3 text-slate-500">{item.code}</td>}
                <td className="py-2 pr-3">{item.name}</td>
                {tab === "plano-de-contas" && (
                  <td className="py-2 pr-3 text-xs text-slate-500">
                    {GROUPS.find((g) => g.key === item.group)?.label ?? item.group}
                  </td>
                )}
                {tab === "contas-bancarias" && (
                  <td className="py-2 pr-3 text-xs text-slate-500">
                    {KINDS.find((k) => k.key === item.kind)?.label ?? item.kind}
                  </td>
                )}
                {hasActive && (
                  <td className="py-2 pr-3">
                    <button onClick={() => toggleActive(item)} className="text-xs underline">
                      {item.active !== false ? "Sim" : "Não"}
                    </button>
                  </td>
                )}
                <td className="py-2 text-right space-x-3 whitespace-nowrap">
                  <button onClick={() => rename(item)} className="text-blue-600 hover:underline text-xs">
                    Renomear
                  </button>
                  <button onClick={() => remove(item)} className="text-red-600 hover:underline text-xs">
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
