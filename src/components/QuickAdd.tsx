"use client";

import { useState } from "react";

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
  { key: "PESSOAL", label: "10. Despesas Pessoais (fora do DRE)" },
];

/**
 * Botões "+ Conta DRE" e "+ Setor" para criar cadastros sem sair da tela.
 * Chama onCreated() após criar, para a tela recarregar o /api/meta.
 */
export default function QuickAdd({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState<"conta" | "setor" | null>(null);
  const [form, setForm] = useState({ code: "", name: "", group: "DESPESA" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    setError("");
    setSaving(true);
    const entity = open === "conta" ? "plano-de-contas" : "setores";
    const body =
      open === "conta"
        ? { code: form.code, name: form.name, group: form.group }
        : { name: form.name };
    const res = await fetch(`/api/cadastros/${entity}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSaving(false);
    if (!res.ok) {
      const d = await res.json();
      setError(d.error ?? "Erro ao criar");
      return;
    }
    setOpen(null);
    setForm({ code: "", name: "", group: "DESPESA" });
    onCreated();
  }

  return (
    <>
      <div className="flex gap-2 text-xs">
        <button
          onClick={() => { setOpen("conta"); setError(""); }}
          className="text-blue-600 hover:underline"
        >
          ＋ Nova conta DRE
        </button>
        <span className="text-slate-300">·</span>
        <button
          onClick={() => { setOpen("setor"); setError(""); }}
          className="text-blue-600 hover:underline"
        >
          ＋ Novo setor
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setOpen(null)}>
          <div className="bg-white rounded-xl shadow-xl p-5 w-full max-w-sm space-y-3" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold">{open === "conta" ? "Nova conta do DRE" : "Novo setor"}</h3>
            {open === "conta" && (
              <>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Código</label>
                  <input
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                    placeholder="ex.: 4.15"
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value })}
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Grupo</label>
                  <select
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
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
            <div>
              <label className="block text-xs text-slate-500 mb-1">Nome</label>
              <input
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                autoFocus={open === "setor"}
                onKeyDown={(e) => e.key === "Enter" && save()}
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setOpen(null)} className="text-sm px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50">
                Cancelar
              </button>
              <button
                onClick={save}
                disabled={saving || !form.name || (open === "conta" && !form.code)}
                className="text-sm px-4 py-1.5 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? "Salvando..." : "Criar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
