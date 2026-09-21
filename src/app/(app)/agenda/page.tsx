"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { formatBRL } from "@/lib/money";
import type { ForecastData, ForecastWeek } from "@/lib/forecast";
import { WeekSummaryTable, WeekItemsTable, fmtDate } from "@/components/ForecastWeeks";

interface Meta {
  accounts: { id: string; code: string; name: string }[];
  bankAccounts: { id: string; name: string }[];
  suppliers: { id: string; name: string }[];
}

interface Commitment {
  id: string;
  description: string;
  amountCents: number;
  dueDay: number;
  startDate: string;
  installments: number | null;
  pattern: string | null;
  bankAccountId: string | null;
  accountId: string | null;
  supplierId: string | null;
  active: boolean;
  notes: string | null;
  bankAccount: { name: string } | null;
  account: { code: string; name: string } | null;
  supplier: { name: string } | null;
}

type Forecast = ForecastData & { weeksCount: number; today: string };

const EMPTY_FORM = {
  description: "",
  amount: "",
  direction: "pagar" as "pagar" | "receber",
  dueDay: "10",
  startDate: new Date().toISOString().slice(0, 7),
  installments: "",
  pattern: "",
  bankAccountId: "",
  accountId: "",
  supplierId: "",
  notes: "",
};

const inputCls = "w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm bg-white";

/** Texto do resumo semanal para colar no WhatsApp/e-mail. */
function buildSummaryText(data: Forecast): string {
  const lines: string[] = [];
  const first = data.weeks[0];
  const last = data.weeks[data.weeks.length - 1];
  lines.push(`*Contas a pagar e receber — ${fmtDate(first.start)} a ${fmtDate(last.end)}*`);
  lines.push(`A receber: ${formatBRL(data.receberCents)}`);
  lines.push(`A pagar: ${formatBRL(data.pagarCents)}`);
  lines.push(`Saldo previsto: ${formatBRL(data.saldoCents)}`);
  for (const w of data.weeks) {
    lines.push("");
    lines.push(`*Semana ${w.label}* — receber ${formatBRL(w.receberCents)} · pagar ${formatBRL(w.pagarCents)} · saldo ${formatBRL(w.saldoCents)}`);
    const open = w.items.filter((i) => i.status === "previsto");
    const receber = open.filter((i) => i.amountCents > 0);
    const pagar = open.filter((i) => i.amountCents < 0);
    if (open.length === 0) lines.push("  (nada em aberto)");
    if (receber.length > 0) {
      lines.push("  📥 A receber");
      for (const i of receber) lines.push(`  • ${fmtDate(i.date)} — ${i.description} (${i.detail}) — ${formatBRL(i.amountCents)}`);
    }
    if (pagar.length > 0) {
      lines.push("  📤 A pagar");
      for (const i of pagar) lines.push(`  • ${fmtDate(i.date)} — ${i.description} (${i.detail}) — ${formatBRL(Math.abs(i.amountCents))}`);
    }
    const done = w.items.filter((i) => i.status === "realizado");
    if (done.length > 0) lines.push(`  ✔ ${done.length} já ${done.length === 1 ? "realizado" : "realizados"}`);
  }
  return lines.join("\n");
}

function Content() {
  const params = useSearchParams();
  const router = useRouter();
  const inicio = params.get("inicio") ?? "";
  const semanas = params.get("semanas") ?? "4";

  const [data, setData] = useState<Forecast | null>(null);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [commitments, setCommitments] = useState<Commitment[]>([]);
  const [copied, setCopied] = useState(false);
  const [showCommitments, setShowCommitments] = useState(false);
  const [modal, setModal] = useState<{ id: string | null } | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const forecastUrl = useCallback(() => {
    const p = new URLSearchParams({ semanas });
    if (inicio) p.set("inicio", inicio);
    return `/api/forecast?${p}`;
  }, [inicio, semanas]);

  // recarregamentos após salvar/editar (chamados em handlers, não em efeitos)
  const loadForecast = useCallback(async () => {
    const res = await fetch(forecastUrl());
    setData(await res.json());
  }, [forecastUrl]);

  const loadCommitments = useCallback(async () => {
    const res = await fetch("/api/commitments");
    setCommitments(await res.json());
  }, []);

  useEffect(() => {
    fetch("/api/meta").then((r) => r.json()).then(setMeta);
    fetch("/api/commitments").then((r) => r.json()).then(setCommitments);
  }, []);

  useEffect(() => {
    let alive = true;
    fetch(forecastUrl())
      .then((r) => r.json())
      .then((d) => {
        if (alive) setData(d);
      });
    return () => {
      alive = false;
    };
  }, [forecastUrl]);

  function navigate(patch: { inicio?: string; semanas?: string }) {
    const p = new URLSearchParams();
    const i = patch.inicio ?? inicio;
    const s = patch.semanas ?? semanas;
    if (i) p.set("inicio", i);
    if (s !== "4") p.set("semanas", s);
    router.push(`/agenda${p.size ? `?${p}` : ""}`);
  }

  function shiftWeeks(n: number) {
    if (!data) return;
    const d = new Date(data.from + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() + n * 7);
    navigate({ inicio: d.toISOString().slice(0, 10) });
  }

  async function copySummary() {
    if (!data) return;
    await navigator.clipboard.writeText(buildSummaryText(data));
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  function openNew() {
    setForm({ ...EMPTY_FORM });
    setFormError("");
    setModal({ id: null });
  }

  function openEdit(id: string) {
    const c = commitments.find((x) => x.id === id);
    if (!c) return;
    setForm({
      description: c.description,
      amount: (Math.abs(c.amountCents) / 100).toFixed(2).replace(".", ","),
      direction: c.amountCents < 0 ? "pagar" : "receber",
      dueDay: String(c.dueDay),
      startDate: c.startDate.slice(0, 7),
      installments: c.installments != null ? String(c.installments) : "",
      pattern: c.pattern ?? "",
      bankAccountId: c.bankAccountId ?? "",
      accountId: c.accountId ?? "",
      supplierId: c.supplierId ?? "",
      notes: c.notes ?? "",
    });
    setFormError("");
    setModal({ id });
    setShowCommitments(true);
  }

  async function saveCommitment() {
    if (!modal) return;
    const cents = Math.round(Number(form.amount.replace(/\./g, "").replace(",", ".")) * 100);
    if (!form.description.trim()) return setFormError("Informe a descrição");
    if (!cents || Number.isNaN(cents)) return setFormError("Informe o valor");
    const body = {
      id: modal.id ?? undefined,
      description: form.description,
      amountCents: form.direction === "pagar" ? -Math.abs(cents) : Math.abs(cents),
      dueDay: Number(form.dueDay),
      startDate: form.startDate,
      installments: form.installments ? Number(form.installments) : null,
      pattern: form.pattern || null,
      bankAccountId: form.bankAccountId || null,
      accountId: form.accountId || null,
      supplierId: form.supplierId || null,
      notes: form.notes || null,
    };
    setSaving(true);
    const res = await fetch("/api/commitments", {
      method: modal.id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSaving(false);
    if (!res.ok) {
      const d = await res.json();
      setFormError(d.error ?? "Erro ao salvar");
      return;
    }
    setModal(null);
    await Promise.all([loadCommitments(), loadForecast()]);
  }

  async function toggleActive(c: Commitment) {
    await fetch("/api/commitments", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: c.id, active: !c.active }),
    });
    await Promise.all([loadCommitments(), loadForecast()]);
  }

  async function removeCommitment(c: Commitment) {
    if (!confirm(`Excluir o previsto "${c.description}"?`)) return;
    await fetch("/api/commitments", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: c.id }),
    });
    await Promise.all([loadCommitments(), loadForecast()]);
  }

  const today = data?.today ?? "";
  const isCurrent = (w: ForecastWeek) => today >= w.start && today <= w.end;

  return (
    <div className="space-y-5 max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Contas a Pagar e Receber</h1>
          <p className="text-sm text-slate-500">
            Projeção semanal
            {data && ` · ${fmtDate(data.from)} a ${fmtDate(data.to)}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 no-print">
          <button
            onClick={copySummary}
            className="text-sm bg-white border border-slate-200 shadow-sm rounded-lg px-3 py-1.5 hover:border-blue-400 hover:text-blue-700 transition-colors"
            title="Copia o resumo semanal em texto para colar no WhatsApp ou e-mail"
          >
            {copied ? "✅ Copiado!" : "📋 Copiar resumo"}
          </button>
          <button
            onClick={() => window.print()}
            className="text-sm bg-white border border-slate-200 shadow-sm rounded-lg px-3 py-1.5 hover:border-blue-400 hover:text-blue-700 transition-colors"
          >
            🖨️ Imprimir / PDF
          </button>
          <button
            onClick={openNew}
            className="text-sm bg-blue-600 text-white font-semibold rounded-lg px-3 py-1.5 hover:bg-blue-700 shadow-sm"
          >
            ＋ Novo previsto
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow p-3 flex flex-wrap items-center gap-3 no-print">
        <div className="flex items-center gap-1">
          <button onClick={() => shiftWeeks(-1)} className="px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-50 text-sm" title="Semana anterior">◀</button>
          <button
            onClick={() => navigate({ inicio: "" })}
            className={`px-3 py-1 rounded-lg border text-sm font-medium ${!inicio ? "bg-blue-600 text-white border-blue-600" : "border-slate-200 hover:bg-slate-50"}`}
          >
            Semana atual
          </button>
          <button onClick={() => shiftWeeks(1)} className="px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-50 text-sm" title="Semana seguinte">▶</button>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">A partir de</span>
          <input
            type="date"
            className="border border-slate-300 rounded-lg px-2 py-1 text-sm"
            value={inicio || data?.from || ""}
            onChange={(e) => navigate({ inicio: e.target.value })}
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Semanas</span>
          <select
            className="border border-slate-300 rounded-lg px-2 py-1 text-sm bg-white"
            value={semanas}
            onChange={(e) => navigate({ semanas: e.target.value })}
          >
            {[2, 4, 6, 8, 12].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>
      </div>

      {!data ? (
        <p className="text-sm text-slate-500 py-10 text-center">Carregando...</p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 border-l-4 border-l-emerald-500 px-4 py-2.5">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide block">A receber</span>
              <span className="text-lg font-bold text-emerald-600">{formatBRL(data.receberCents)}</span>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 border-l-4 border-l-red-500 px-4 py-2.5">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide block">A pagar</span>
              <span className="text-lg font-bold text-red-600">{formatBRL(data.pagarCents)}</span>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 border-l-4 border-l-blue-500 px-4 py-2.5">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide block">Saldo previsto</span>
              <span className={`text-lg font-bold ${data.saldoCents < 0 ? "text-red-600" : "text-emerald-600"}`}>
                {formatBRL(data.saldoCents)}
              </span>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
            <h2 className="font-semibold mb-3">Resumo por semana</h2>
            <WeekSummaryTable weeks={data.weeks} today={today} />
          </div>

          {data.weeks.map((w) => (
            <div
              key={w.start}
              className={`bg-white rounded-xl shadow-sm border p-5 ${isCurrent(w) ? "border-blue-300" : "border-slate-100"}`}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
                <h2 className="font-semibold">
                  Semana {w.label}
                  {isCurrent(w) && (
                    <span className="ml-2 text-[10px] font-bold uppercase bg-blue-600 text-white rounded px-1.5 py-0.5 align-middle">
                      esta semana
                    </span>
                  )}
                </h2>
                <span className="text-xs text-slate-500">
                  a receber <b className="text-emerald-700">{formatBRL(w.receberCents)}</b> · a pagar{" "}
                  <b className="text-red-600">{formatBRL(w.pagarCents)}</b> · saldo{" "}
                  <b className={w.saldoCents < 0 ? "text-red-600" : "text-emerald-700"}>{formatBRL(w.saldoCents)}</b>
                </span>
              </div>
              <WeekItemsTable items={w.items} today={today} onEditCommitment={openEdit} />
            </div>
          ))}

          <p className="text-xs text-slate-500">
            <b>📌 fixa</b>: lançamentos marcados como fixo/recorrente em{" "}
            <Link href="/transacoes" className="text-blue-600 hover:underline">Transações</Link> — repete o valor e o
            dia do último lançamento. <b>parcela</b>: parcelas restantes de compras parceladas (cartão, Asaas ou
            manual — o número da parcela pode ser ajustado no lançamento). <b>previsto</b>: compromissos
            cadastrados abaixo. Uma ocorrência aparece como <i>realizada</i> quando já existe lançamento
            correspondente no mês; só o que está em aberto entra nos totais.
          </p>

          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
            <h2 className="font-semibold mb-1">Parcelamentos em andamento</h2>
            <p className="text-xs text-slate-500 mb-3">
              Compras parceladas com parcelas ainda por vencer, de todas as origens.
            </p>
            {data.openInstallments.length === 0 ? (
              <p className="text-sm text-slate-500 py-4 text-center">Nenhum parcelamento em aberto.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-500 border-b">
                    <th className="py-1.5 pr-3">Descrição</th>
                    <th className="py-1.5 pr-3">Origem</th>
                    <th className="py-1.5 pr-3">Conta DRE</th>
                    <th className="py-1.5 pr-3 text-right">Parcela</th>
                    <th className="py-1.5 pr-3 text-right">Última</th>
                    <th className="py-1.5 pr-3 text-right">Próxima</th>
                    <th className="py-1.5 pr-3 text-right">Restam</th>
                    <th className="py-1.5 text-right">Saldo a vencer</th>
                  </tr>
                </thead>
                <tbody>
                  {data.openInstallments.map((s) => (
                    <tr key={s.key} className="border-b last:border-0 hover:bg-slate-50">
                      <td className="py-1.5 pr-3">{s.description}</td>
                      <td className="py-1.5 pr-3 text-xs text-slate-500 whitespace-nowrap">{s.bankAccount}</td>
                      <td className="py-1.5 pr-3 text-xs text-slate-500">{s.account ?? "–"}</td>
                      <td className="py-1.5 pr-3 text-right tabular-nums">{formatBRL(s.amountCents)}</td>
                      <td className="py-1.5 pr-3 text-right text-xs text-slate-500 whitespace-nowrap">
                        {s.currentNum}/{s.total} em {fmtDate(s.lastDate)}
                      </td>
                      <td className="py-1.5 pr-3 text-right text-xs whitespace-nowrap">{fmtDate(s.nextDate)}</td>
                      <td className="py-1.5 pr-3 text-right tabular-nums">{s.remaining}</td>
                      <td className={`py-1.5 text-right tabular-nums font-medium ${s.remainingCents < 0 ? "text-red-600" : "text-emerald-700"}`}>
                        {formatBRL(s.remainingCents)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 no-print">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
          <h2 className="font-semibold">Previstos cadastrados</h2>
          <div className="flex gap-2">
            <button onClick={() => setShowCommitments(!showCommitments)} className="text-sm text-blue-600 hover:underline">
              {showCommitments ? "Ocultar" : `Mostrar (${commitments.length})`}
            </button>
            <button onClick={openNew} className="text-sm text-blue-600 hover:underline">＋ Novo previsto</button>
          </div>
        </div>
        <p className="text-xs text-slate-500 mb-3">
          Contas a pagar ou receber que ainda não aparecem nos extratos: aluguel todo dia 18, parcela de
          cliente todo dia 10 (12×), honorários previstos... Se o lançamento já é importado todo mês, basta
          marcá-lo como fixo (📌) em Transações — não precisa cadastrar aqui.
        </p>
        {showCommitments &&
          (commitments.length === 0 ? (
            <p className="text-sm text-slate-500 py-4 text-center">Nenhum previsto cadastrado.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b">
                  <th className="py-1.5 pr-3">Descrição</th>
                  <th className="py-1.5 pr-3">Vencimento</th>
                  <th className="py-1.5 pr-3">Início</th>
                  <th className="py-1.5 pr-3">Parcelas</th>
                  <th className="py-1.5 pr-3">Origem / Conta</th>
                  <th className="py-1.5 pr-3 text-right">Valor</th>
                  <th className="py-1.5"></th>
                </tr>
              </thead>
              <tbody>
                {commitments.map((c) => (
                  <tr key={c.id} className={`border-b last:border-0 hover:bg-slate-50 ${c.active ? "" : "opacity-50"}`}>
                    <td className="py-1.5 pr-3">
                      {c.description}
                      {!c.active && <span className="ml-1.5 text-[10px] bg-slate-200 text-slate-600 rounded px-1 py-0.5">inativo</span>}
                      {c.supplier && <span className="ml-1.5 text-[10px] bg-violet-100 text-violet-700 rounded px-1 py-0.5">{c.supplier.name}</span>}
                    </td>
                    <td className="py-1.5 pr-3 whitespace-nowrap">dia {c.dueDay}</td>
                    <td className="py-1.5 pr-3 whitespace-nowrap text-slate-600">
                      {new Date(c.startDate).toLocaleDateString("pt-BR", { month: "short", year: "numeric", timeZone: "UTC" })}
                    </td>
                    <td className="py-1.5 pr-3">{c.installments != null ? `${c.installments}×` : "fixo"}</td>
                    <td className="py-1.5 pr-3 text-xs text-slate-500">
                      {[c.bankAccount?.name, c.account ? `${c.account.code} ${c.account.name}` : null].filter(Boolean).join(" · ") || "–"}
                    </td>
                    <td className={`py-1.5 pr-3 text-right tabular-nums font-medium ${c.amountCents < 0 ? "text-red-600" : "text-emerald-700"}`}>
                      {formatBRL(c.amountCents)}
                    </td>
                    <td className="py-1.5 text-right text-xs whitespace-nowrap">
                      <button onClick={() => openEdit(c.id)} className="text-blue-600 hover:underline mr-2">editar</button>
                      <button onClick={() => toggleActive(c)} className="text-slate-600 hover:underline mr-2">
                        {c.active ? "encerrar" : "reativar"}
                      </button>
                      <button onClick={() => removeCommitment(c)} className="text-red-600 hover:underline">excluir</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ))}
      </div>

      {modal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setModal(null)}>
          <div className="bg-white rounded-xl shadow-xl p-5 w-full max-w-lg space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-semibold">{modal.id ? "Editar previsto" : "Novo previsto"}</h3>
              <button onClick={() => setModal(null)} className="text-slate-400 hover:text-slate-700">✕</button>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="col-span-2">
                <label className="block text-xs text-slate-500 mb-1">Descrição</label>
                <input
                  className={inputCls}
                  placeholder="ex.: Aluguel do escritório · Parcela cliente Fulano"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Tipo</label>
                <div className="flex rounded-lg border border-slate-300 overflow-hidden">
                  {(["pagar", "receber"] as const).map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setForm({ ...form, direction: d })}
                      className={`flex-1 py-1.5 text-sm font-medium ${
                        form.direction === d
                          ? d === "pagar" ? "bg-red-600 text-white" : "bg-emerald-600 text-white"
                          : "bg-white text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {d === "pagar" ? "A pagar" : "A receber"}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Valor (R$)</label>
                <input
                  className={`${inputCls} text-right`}
                  placeholder="0,00"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Dia do vencimento</label>
                <input
                  type="number"
                  min={1}
                  max={31}
                  className={inputCls}
                  value={form.dueDay}
                  onChange={(e) => setForm({ ...form, dueDay: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Primeira ocorrência (mês)</label>
                <input
                  type="month"
                  className={inputCls}
                  value={form.startDate}
                  onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Nº de parcelas</label>
                <input
                  type="number"
                  min={1}
                  className={inputCls}
                  placeholder="vazio = todo mês, sem fim"
                  value={form.installments}
                  onChange={(e) => setForm({ ...form, installments: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Origem (conta/cartão)</label>
                <select className={inputCls} value={form.bankAccountId} onChange={(e) => setForm({ ...form, bankAccountId: e.target.value })}>
                  <option value="">—</option>
                  {meta?.bankAccounts.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Conta DRE</label>
                <select className={inputCls} value={form.accountId} onChange={(e) => setForm({ ...form, accountId: e.target.value })}>
                  <option value="">—</option>
                  {meta?.accounts.map((a) => (
                    <option key={a.id} value={a.id}>{a.code} {a.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Fornecedor</label>
                <select className={inputCls} value={form.supplierId} onChange={(e) => setForm({ ...form, supplierId: e.target.value })}>
                  <option value="">—</option>
                  {meta?.suppliers.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-slate-500 mb-1">
                  Texto que identifica o lançamento no extrato (opcional)
                </label>
                <input
                  className={inputCls}
                  placeholder="ex.: IMOBILIARIA — para marcar como realizado quando o lançamento for importado"
                  value={form.pattern}
                  onChange={(e) => setForm({ ...form, pattern: e.target.value })}
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-slate-500 mb-1">Observações</label>
                <input className={inputCls} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
            </div>
            {formError && <p className="text-sm text-red-600">{formError}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setModal(null)} className="text-sm px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50">
                Cancelar
              </button>
              <button
                onClick={saveCommitment}
                disabled={saving}
                className="text-sm px-4 py-1.5 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AgendaPage() {
  return (
    <Suspense fallback={<p className="text-sm text-slate-500">Carregando...</p>}>
      <Content />
    </Suspense>
  );
}
