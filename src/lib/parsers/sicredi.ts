import * as XLSX from "xlsx";
import { parseToCents, parseDateBR } from "@/lib/money";
import { ParseResult, ParsedTransaction, parseInstallment } from "./types";

/**
 * Extrato de conta corrente Sicredi (.xls): cabeçalho
 * ["Data","Descrição","Documento","Valor (R$)","Saldo (R$)"].
 * Fatura de cartão Sicredi (.xls): cabeçalho ["Data","Descrição","Parcela","Valor (R$)"]
 * (despesa positiva na fatura vira débito negativo no sistema).
 */
export function parseSicrediXls(buf: Buffer): ParseResult | null {
  const wb = XLSX.read(buf, { type: "buffer" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const grid: string[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: "" });

  const headerIdx = grid.findIndex(
    (r) => r[0]?.toString().trim() === "Data" && r[1]?.toString().includes("Descri")
  );
  if (headerIdx === -1) return null;

  const header = grid[headerIdx].map((h) => h?.toString().trim() ?? "");
  const isCard = header.some((h) => h.includes("Parcela"));
  const iValor = header.findIndex((h) => h.includes("Valor"));
  const iParcela = header.findIndex((h) => h.includes("Parcela"));

  const warnings: string[] = [];
  const rows: ParsedTransaction[] = [];

  for (const r of grid.slice(headerIdx + 1)) {
    const dateStr = r[0]?.toString().trim();
    if (!dateStr) continue;
    const date = parseDateBR(dateStr);
    if (!date) continue; // linhas de seção/saldo anterior
    const cents = parseToCents(r[iValor]?.toString() ?? "");
    if (cents === null) continue;
    let desc = r[1]?.toString().trim() ?? "";
    let installment = {};
    if (isCard && iParcela >= 0) {
      const parcela = r[iParcela]?.toString().trim();
      if (parcela && parcela !== "01/01") {
        desc += ` (parcela ${parcela})`;
        installment = parseInstallment(parcela);
      }
    }
    rows.push({
      date: date.toISOString().slice(0, 10),
      description: desc || "Sem descrição",
      amountCents: isCard ? -cents : cents,
      ...installment,
    });
  }

  return {
    source: isCard ? "sicredi-cartao-xls" : "sicredi-conta-xls",
    sourceLabel: isCard ? "Cartão Sicredi (XLS)" : "Conta Sicredi (XLS)",
    rows,
    warnings,
  };
}

/**
 * Fatura de cartão Sicredi em CSV (separado por ";", latin1):
 * data;descrição;(parcela);"R$ 1.234,56";;;portador
 */
export function isSicrediCartaoCsv(text: string): boolean {
  return /^\d{2}\/\d{2}\/\d{4};.*;"?R\$\s?-?[\d.,]+/m.test(text);
}

export function parseSicrediCartaoCsv(text: string): ParseResult {
  const rows: ParsedTransaction[] = [];
  const warnings: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^(\d{2}\/\d{2}\/\d{4});([^;]*);([^;]*);"?(R\$\s?-?[\d.,]+)"?/);
    if (!m) continue;
    const date = parseDateBR(m[1]);
    const cents = parseToCents(m[4]);
    if (!date || cents === null) continue;
    let desc = m[2].trim();
    const parcela = m[3].replace(/[()]/g, "").trim();
    if (parcela) desc += ` (parcela ${parcela})`;
    rows.push({
      date: date.toISOString().slice(0, 10),
      description: desc || "Sem descrição",
      amountCents: -cents, // fatura de cartão: despesa positiva vira débito
      ...parseInstallment(parcela),
    });
  }
  return { source: "sicredi-cartao-csv", sourceLabel: "Cartão Sicredi (CSV)", rows, warnings };
}
