"use client";

import { useEffect, useState } from "react";

export default function ConfiguracoesPage() {
  const [form, setForm] = useState({ currentPassword: "", newPassword: "", confirm: "" });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (form.newPassword !== form.confirm) {
      setMsg({ ok: false, text: "A confirmação não confere com a nova senha." });
      return;
    }
    setLoading(true);
    const res = await fetch("/api/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: form.currentPassword, newPassword: form.newPassword }),
    });
    setLoading(false);
    const d = await res.json();
    if (res.ok) {
      setMsg({ ok: true, text: "Senha alterada com sucesso." });
      setForm({ currentPassword: "", newPassword: "", confirm: "" });
    } else {
      setMsg({ ok: false, text: d.error ?? "Erro ao alterar a senha." });
    }
  }

  return (
    <div className="space-y-6 max-w-lg">
      <h1 className="text-2xl font-bold">Configurações</h1>

      <form onSubmit={changePassword} className="bg-white rounded-xl shadow p-5 space-y-4">
        <h2 className="font-semibold">Alterar senha</h2>
        <div>
          <label className="block text-sm mb-1">Senha atual</label>
          <input
            type="password"
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
            value={form.currentPassword}
            onChange={(e) => setForm({ ...form, currentPassword: e.target.value })}
          />
        </div>
        <div>
          <label className="block text-sm mb-1">Nova senha (mín. 8 caracteres)</label>
          <input
            type="password"
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
            value={form.newPassword}
            onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
          />
        </div>
        <div>
          <label className="block text-sm mb-1">Confirmar nova senha</label>
          <input
            type="password"
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
            value={form.confirm}
            onChange={(e) => setForm({ ...form, confirm: e.target.value })}
          />
        </div>
        {msg && <p className={`text-sm ${msg.ok ? "text-green-700" : "text-red-600"}`}>{msg.text}</p>}
        <button
          type="submit"
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg px-4 py-2 text-sm font-semibold"
        >
          {loading ? "Salvando..." : "Alterar senha"}
        </button>
      </form>

      <div className="bg-white rounded-xl shadow p-5 text-sm space-y-2">
        <h2 className="font-semibold">Extração de PDFs escaneados por IA</h2>
        <p className="text-slate-600">
          Faturas em PDF sem texto (ex.: C6) são extraídas por IA usando a API da Anthropic. Para
          habilitar, defina <code className="bg-slate-100 px-1 rounded">ANTHROPIC_API_KEY</code> no
          arquivo <code className="bg-slate-100 px-1 rounded">.env</code> na raiz do sistema e
          reinicie o servidor.
        </p>
        <p className="text-slate-600">
          Status:{" "}
          <StatusIA />
        </p>
      </div>
    </div>
  );
}

function StatusIA() {
  const [status, setStatus] = useState<string>("verificando...");
  useEffect(() => {
    fetch("/api/ai-status")
      .then((r) => r.json())
      .then((d) => setStatus(d.available ? "✅ configurada" : "❌ não configurada"));
  }, []);
  return <b>{status}</b>;
}
