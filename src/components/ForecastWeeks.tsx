import { formatBRL } from "@/lib/money";
import type { ForecastItem, ForecastWeek } from "@/lib/forecast";

/**
 * Blocos de apresentação da agenda de contas a pagar/receber, compartilhados
 * pelo Dashboard (resumo) e pela tela Contas a Pagar/Receber (completa).
 * Sem estado — funcionam em componentes de servidor e de cliente.
 */

export const KIND_BADGE: Record<ForecastItem["kind"], { label: string; cls: string; title: string }> = {
  FIXA: { label: "📌 fixa", cls: "bg-amber-100 text-amber-800", title: "Lançamento fixo/recorrente (marcado com 📌 em Transações)" },
  PARCELA: { label: "parcela", cls: "bg-sky-100 text-sky-700", title: "Parcela restante de compra parcelada" },
  PREVISTO: { label: "previsto", cls: "bg-violet-100 text-violet-700", title: "Compromisso cadastrado em Contas a Pagar/Receber" },
};

export const fmtDate = (iso: string) =>
  new Date(iso + "T00:00:00Z").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "UTC" });

export const fmtWeekday = (iso: string) =>
  new Date(iso + "T00:00:00Z").toLocaleDateString("pt-BR", { weekday: "short", timeZone: "UTC" }).replace(".", "");

const money = (cents: number, cls?: string) => (
  <span className={`tabular-nums ${cls ?? (cents < 0 ? "text-red-600" : cents > 0 ? "text-emerald-700" : "text-slate-400")}`}>
    {cents === 0 ? "–" : formatBRL(cents)}
  </span>
);

/** Tabela-resumo: uma linha por semana com a receber / a pagar / saldo. */
export function WeekSummaryTable({
  weeks,
  today,
  hrefFor,
}: {
  weeks: ForecastWeek[];
  today: string;
  /** link da linha (ex.: agenda posicionada naquela semana) */
  hrefFor?: (w: ForecastWeek) => string;
}) {
  const totalIn = weeks.reduce((s, w) => s + w.receberCents, 0);
  const totalOut = weeks.reduce((s, w) => s + w.pagarCents, 0);
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-slate-500 border-b">
          <th className="py-2 pr-3">Semana</th>
          <th className="py-2 pr-3 text-right">A receber</th>
          <th className="py-2 pr-3 text-right">A pagar</th>
          <th className="py-2 text-right">Saldo</th>
        </tr>
      </thead>
      <tbody>
        {weeks.map((w) => {
          const isCurrent = today >= w.start && today <= w.end;
          const open = w.items.filter((i) => i.status === "previsto").length;
          const content = (
            <>
              <span className="font-medium">{w.label}</span>
              {isCurrent && (
                <span className="ml-2 text-[10px] font-bold uppercase bg-blue-600 text-white rounded px-1.5 py-0.5">
                  esta semana
                </span>
              )}
              <span className="block text-xs text-slate-500">
                {open === 0 ? "nada em aberto" : `${open} ${open === 1 ? "item" : "itens"} em aberto`}
              </span>
            </>
          );
          return (
            <tr key={w.start} className={`border-b last:border-0 ${isCurrent ? "bg-blue-50/60" : "hover:bg-slate-50"}`}>
              <td className="py-2 pr-3">
                {hrefFor ? (
                  <a href={hrefFor(w)} className="hover:text-blue-700">{content}</a>
                ) : (
                  content
                )}
              </td>
              <td className="py-2 pr-3 text-right">{money(w.receberCents)}</td>
              <td className="py-2 pr-3 text-right">{money(w.pagarCents)}</td>
              <td className="py-2 text-right font-semibold">{money(w.saldoCents)}</td>
            </tr>
          );
        })}
      </tbody>
      <tfoot>
        <tr className="border-t-2 border-slate-200 font-semibold">
          <td className="py-2 pr-3">Total do período</td>
          <td className="py-2 pr-3 text-right">{money(totalIn)}</td>
          <td className="py-2 pr-3 text-right">{money(totalOut)}</td>
          <td className="py-2 text-right">{money(totalIn + totalOut)}</td>
        </tr>
      </tfoot>
    </table>
  );
}

/** Lista dos itens de uma semana, dia a dia. */
export function WeekItemsTable({
  items,
  today,
  compact = false,
  onEditCommitment,
}: {
  items: ForecastItem[];
  today: string;
  compact?: boolean;
  onEditCommitment?: (id: string) => void;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-slate-500 py-4 text-center">Nenhum vencimento previsto nesta semana.</p>;
  }
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-slate-500 border-b">
          <th className="py-1.5 pr-3">Data</th>
          <th className="py-1.5 pr-3">Descrição</th>
          {!compact && <th className="py-1.5 pr-3">Origem</th>}
          {!compact && <th className="py-1.5 pr-3">Conta DRE</th>}
          <th className="py-1.5 pr-3 text-right">Valor</th>
          <th className="py-1.5">Situação</th>
        </tr>
      </thead>
      <tbody>
        {items.map((i) => {
          const done = i.status === "realizado";
          const overdue = !done && i.date < today;
          return (
            <tr key={i.id} className={`border-b last:border-0 ${done ? "opacity-50" : overdue ? "bg-red-50/60" : ""}`}>
              <td className="py-1.5 pr-3 whitespace-nowrap text-slate-600">
                {fmtDate(i.date)} <span className="text-xs text-slate-400">{fmtWeekday(i.date)}</span>
              </td>
              <td className="py-1.5 pr-3">
                <span className={done ? "line-through" : ""}>{i.description}</span>
                <span className={`ml-1.5 text-[10px] rounded px-1 py-0.5 whitespace-nowrap ${KIND_BADGE[i.kind].cls}`} title={KIND_BADGE[i.kind].title}>
                  {KIND_BADGE[i.kind].label}
                </span>
                <span className="ml-1.5 text-xs text-slate-400 whitespace-nowrap">{i.detail}</span>
                {compact && i.bankAccount && (
                  <span className="ml-1.5 text-xs text-slate-400 whitespace-nowrap">· {i.bankAccount}</span>
                )}
                {onEditCommitment && i.commitmentId && (
                  <button
                    onClick={() => onEditCommitment(i.commitmentId!)}
                    className="ml-1.5 text-xs text-blue-600 hover:underline"
                    title="Editar este previsto"
                  >
                    editar
                  </button>
                )}
              </td>
              {!compact && <td className="py-1.5 pr-3 text-xs text-slate-500 whitespace-nowrap">{i.bankAccount ?? "–"}</td>}
              {!compact && <td className="py-1.5 pr-3 text-xs text-slate-500">{i.account ?? "–"}</td>}
              <td className="py-1.5 pr-3 text-right whitespace-nowrap font-medium">{money(i.amountCents)}</td>
              <td className="py-1.5 text-xs whitespace-nowrap">
                {done ? (
                  <span className="text-emerald-700" title={i.realizedCents != null ? `Lançado: ${formatBRL(i.realizedCents)}` : undefined}>
                    ✔ realizado {i.realizedDate ? fmtDate(i.realizedDate) : ""}
                  </span>
                ) : overdue ? (
                  <span className="text-red-600 font-medium">em atraso / não lançado</span>
                ) : (
                  <span className="text-slate-500">previsto</span>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
