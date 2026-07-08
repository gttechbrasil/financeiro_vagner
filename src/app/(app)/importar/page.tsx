"use client";

import { useCallback, useEffect, useState } from "react";
import { formatBRL } from "@/lib/money";
import QuickAdd from "@/components/QuickAdd";

interface Meta {
  accounts: { id: string; code: string; name: string }[];
  sectors: { id: string; name: string }[];
  units: { id: string; name: string }[];
  bankAccounts: { id: string; name: string }[];
}

interface PreviewRow {
  date: string;
  description: string;
  amountCents: number;
  externalId?: string;
  hash: string;
  duplicate: boolean;
  accountId: string | null;
  sectorId: string | null;
  unitId: string | null;
  selected?: boolean;
}

interface Batch {
  id: string;
  fileName: string;
  source: string;
  createdAt: string;
  _count: { transactions: number };
}

export default function ImportarPage() {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [bankAccountId, setBankAccountId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<{
    source: string;
    sourceLabel: string;
    fileName: string;
    warnings: string[];
    rows: PreviewRow[];
  } | null>(null);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [result, setResult] = useState<{ imported: number; skipped: number; batchId: string | null } | null>(null);

  const loadMeta = useCallback(() => {
    fetch("/api/meta").then((r) => r.json()).then(setMeta);
  }, []);

  useEffect(() => {
    loadMeta();
    loadBatches();
  }, [loadMeta]);

  function loadBatches() {
    fetch("/api/batches").then((r) => r.json()).then(setBatches);
  }

  async function handlePreview() {
    if (!file || !bankAccountId) {
      setError("Selecione a conta de origem e o arquivo.");
      return;
    }
    setError("");
    setResult(null);
    setLoading(true);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("bankAccountId", bankAccountId);
    const res = await fetch("/api/import/preview", { method: "POST", body: fd });
    setLoading(false);
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Falha ao processar o arquivo");
      return;
    }
    data.rows = data.rows.map((r: PreviewRow) => ({ ...r, selected: !r.duplicate }));
    setPreview(data);
  }

  function updateRow(i: number, patch: Partial<PreviewRow>) {
    if (!preview) return;
    const rows = [...preview.rows];
    rows[i] = { ...rows[i], ...patch };
    setPreview({ ...preview, rows });
  }

  function invertSigns() {
    if (!preview) return;
    setPreview({
      ...preview,
      rows: preview.rows.map((r) => ({ ...r, amountCents: -r.amountCents })),
    });
  }

  async function handleCommit() {
    if (!preview) return;
    const rows = preview.rows.filter((r) => r.selected);
    if (rows.length === 0) {
      setError("Nenhuma linha selecionada.");
      return;
    }
    setLoading(true);
    setError("");
    // multipart: linhas + arquivo original (guardado para consulta posterior)
    const fd = new FormData();
    fd.append(
      "payload",
      JSON.stringify({ bankAccountId, fileName: preview.fileName, source: preview.sourceLabel, rows })
    );
    if (file) fd.append("file", file);
    const res = await fetch("/api/import/commit", { method: "POST", body: fd });
    setLoading(false);
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Falha ao importar");
      return;
    }
    setResult(data);
    setPreview(null);
    setFile(null);
    loadBatches();
  }

  async function undoBatch(id: string) {
    if (!confirm("Desfazer esta importação? Todas as transações do lote serão excluídas.")) return;
    await fetch("/api/batches", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    loadBatches();
  }

  const selectedCount = preview?.rows.filter((r) => r.selected).length ?? 0;
  const selectedSum = preview?.rows.filter((r) => r.selected).reduce((s, r) => s + r.amountCents, 0) ?? 0;

  return (
    <div className="space-y-6 max-w-6xl">
      <h1 className="text-2xl font-bold">Importar Extratos</h1>
      <p className="text-sm text-slate-600">
        Formatos aceitos: CSV do Asaas, extrato/fatura Sicredi (XLS/CSV), OFX (Nubank), PDF de fatura
        (Porto Seguro, C6 via IA) e DOCX.
      </p>

      <div className="bg-white rounded-xl shadow p-5 space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Conta / cartão de origem</label>
            <select
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              value={bankAccountId}
              onChange={(e) => setBankAccountId(e.target.value)}
            >
              <option value="">Selecione...</option>
              {meta?.bankAccounts.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Arquivo</label>
            <input
              type="file"
              accept=".csv,.xls,.xlsx,.ofx,.pdf,.docx,.txt"
              className="w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:text-blue-700 file:text-sm hover:file:bg-blue-100"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>
        </div>
        <button
          onClick={handlePreview}
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg px-4 py-2 text-sm font-semibold"
        >
          {loading ? "Processando..." : "Analisar arquivo"}
        </button>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {result && (
          <div className="flex flex-wrap items-center gap-3 bg-green-50 border border-green-200 rounded-lg p-3">
            <p className="text-sm text-green-700 font-medium">
              ✅ {result.imported} transações importadas
              {result.skipped > 0 && ` (${result.skipped} ignoradas por duplicidade)`}.
            </p>
            {result.batchId && result.imported > 0 && (
              <button
                onClick={async () => {
                  if (!confirm("Cancelar esta importação? Todas as transações deste arquivo serão removidas.")) return;
                  await fetch("/api/batches", {
                    method: "DELETE",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ id: result.batchId }),
                  });
                  setResult(null);
                  loadBatches();
                }}
                className="text-sm border border-red-300 text-red-600 rounded-lg px-3 py-1.5 hover:bg-red-50 font-medium"
              >
                ↩️ Cancelar esta importação
              </button>
            )}
          </div>
        )}
      </div>

      {preview && (
        <div className="bg-white rounded-xl shadow p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold">
                {preview.fileName} <span className="text-slate-500 font-normal">— {preview.sourceLabel}</span>
              </h2>
              <p className="text-sm text-slate-600">
                {preview.rows.length} lançamentos · {selectedCount} selecionados ·{" "}
                <span className={selectedSum < 0 ? "text-red-600" : "text-green-700"}>
                  {formatBRL(selectedSum)}
                </span>
              </p>
            </div>
            <div className="flex gap-2">
              <button onClick={invertSigns} className="text-sm border border-slate-300 rounded-lg px-3 py-1.5 hover:bg-slate-50">
                Inverter sinais
              </button>
              <button
                onClick={handleCommit}
                disabled={loading || selectedCount === 0}
                className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg px-4 py-1.5 text-sm font-semibold"
              >
                Importar {selectedCount} lançamentos
              </button>
            </div>
          </div>

          {preview.warnings.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800 space-y-1">
              {preview.warnings.slice(0, 5).map((w, i) => (
                <p key={i}>⚠️ {w}</p>
              ))}
            </div>
          )}

          <div className="flex justify-end">
            <QuickAdd onCreated={loadMeta} />
          </div>

          <div className="overflow-x-auto -mx-5 px-5">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b">
                  <th className="py-2 pr-2">
                    <input
                      type="checkbox"
                      checked={selectedCount === preview.rows.length}
                      onChange={(e) =>
                        setPreview({
                          ...preview,
                          rows: preview.rows.map((r) => ({ ...r, selected: e.target.checked })),
                        })
                      }
                    />
                  </th>
                  <th className="py-2 pr-3">Data</th>
                  <th className="py-2 pr-3">Descrição</th>
                  <th className="py-2 pr-3 text-right">Valor</th>
                  <th className="py-2 pr-3">Conta DRE</th>
                  <th className="py-2 pr-3">Setor</th>
                  <th className="py-2">Unidade</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((r, i) => (
                  <tr key={r.hash + i} className={`border-b last:border-0 ${r.duplicate ? "opacity-50 bg-slate-50" : ""}`}>
                    <td className="py-1.5 pr-2">
                      <input
                        type="checkbox"
                        checked={!!r.selected}
                        onChange={(e) => updateRow(i, { selected: e.target.checked })}
                      />
                    </td>
                    <td className="py-1.5 pr-3 whitespace-nowrap">
                      {r.date.split("-").reverse().join("/")}
                    </td>
                    <td className="py-1.5 pr-3 max-w-xs truncate" title={r.description}>
                      {r.description}
                      {r.duplicate && <span className="ml-2 text-xs text-amber-600">(já importado)</span>}
                    </td>
                    <td className={`py-1.5 pr-3 text-right whitespace-nowrap ${r.amountCents < 0 ? "text-red-600" : "text-green-700"}`}>
                      {formatBRL(r.amountCents)}
                    </td>
                    <td className="py-1.5 pr-3">
                      <select
                        className="border border-slate-200 rounded px-1.5 py-1 text-xs max-w-40"
                        value={r.accountId ?? ""}
                        onChange={(e) => updateRow(i, { accountId: e.target.value || null })}
                      >
                        <option value="">— sem conta —</option>
                        {meta?.accounts.map((a) => (
                          <option key={a.id} value={a.id}>{a.code} {a.name}</option>
                        ))}
                      </select>
                    </td>
                    <td className="py-1.5 pr-3">
                      <select
                        className="border border-slate-200 rounded px-1.5 py-1 text-xs"
                        value={r.sectorId ?? ""}
                        onChange={(e) => updateRow(i, { sectorId: e.target.value || null })}
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
                        value={r.unitId ?? ""}
                        onChange={(e) => updateRow(i, { unitId: e.target.value || null })}
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
        </div>
      )}

      <div className="bg-white rounded-xl shadow p-5">
        <h2 className="font-semibold mb-3">Importações anteriores</h2>
        {batches.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhuma importação ainda.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b">
                <th className="py-2 pr-3">Data</th>
                <th className="py-2 pr-3">Arquivo</th>
                <th className="py-2 pr-3">Formato</th>
                <th className="py-2 pr-3 text-right">Transações</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {batches.map((b) => (
                <tr key={b.id} className="border-b last:border-0">
                  <td className="py-2 pr-3 whitespace-nowrap">
                    {new Date(b.createdAt).toLocaleString("pt-BR")}
                  </td>
                  <td className="py-2 pr-3">
                    <a href={`/api/batches/${b.id}/file`} className="hover:underline hover:text-blue-700" title="Baixar arquivo original">
                      {b.fileName}
                    </a>
                  </td>
                  <td className="py-2 pr-3">{b.source}</td>
                  <td className="py-2 pr-3 text-right">{b._count.transactions}</td>
                  <td className="py-2 text-right">
                    <button onClick={() => undoBatch(b.id)} className="text-red-600 hover:underline text-xs">
                      Desfazer
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
