import Papa from "papaparse";
import { parseToCents, parseDateBR } from "@/lib/money";
import { ParseResult, ParsedTransaction } from "./types";

/**
 * Extrato do Asaas: CSV com todas as células entre aspas, separado por vírgula.
 * Colunas: Data, Transação, Tipo de transação, Transação estornada, Descrição,
 * Valor, Saldo, ... A primeira linha é o período; a segunda, o cabeçalho.
 */
export function isAsaasCsv(text: string): boolean {
  return text.slice(0, 2000).includes("Tipo de transação");
}

export function parseAsaasCsv(text: string): ParseResult {
  const parsed = Papa.parse<string[]>(text, { skipEmptyLines: true });
  const data = parsed.data;
  const headerIdx = data.findIndex((r) => r[0]?.trim() === "Data");
  const warnings: string[] = [];
  const rows: ParsedTransaction[] = [];
  if (headerIdx === -1) {
    return { source: "asaas-csv", sourceLabel: "Asaas (CSV)", rows, warnings: ["Cabeçalho não encontrado"] };
  }
  const header = data[headerIdx].map((h) => h.trim());
  const col = (name: string) => header.indexOf(name);
  const iData = col("Data");
  const iId = col("Transação");
  const iTipo = col("Tipo de transação");
  const iDesc = col("Descrição");
  const iValor = col("Valor");

  for (const r of data.slice(headerIdx + 1)) {
    const dateStr = r[iData]?.trim();
    if (!dateStr) continue; // saldo inicial/final
    const date = parseDateBR(dateStr);
    const cents = parseToCents(r[iValor] ?? "");
    if (!date || cents === null) {
      warnings.push(`Linha ignorada: ${r.slice(0, 6).join(", ")}`);
      continue;
    }
    const tipo = r[iTipo]?.trim() || undefined;
    const desc = r[iDesc]?.trim() || tipo || "Sem descrição";
    rows.push({
      date: date.toISOString().slice(0, 10),
      description: desc,
      amountCents: cents,
      externalId: r[iId]?.trim() || undefined,
      rawType: tipo,
    });
  }
  return { source: "asaas-csv", sourceLabel: "Asaas (CSV)", rows, warnings };
}
