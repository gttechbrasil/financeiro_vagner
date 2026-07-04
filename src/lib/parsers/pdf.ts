import { PDFParse } from "pdf-parse";
import { parseToCents } from "@/lib/money";
import { ParseResult, ParsedTransaction } from "./types";

export async function extractPdfText(buf: Buffer): Promise<{ text: string; numpages: number }> {
  const parser = new PDFParse({ data: new Uint8Array(buf) });
  try {
    const result = await parser.getText();
    return { text: result.text, numpages: result.total };
  } finally {
    await parser.destroy();
  }
}

/**
 * Faturas de cartão em PDF com camada de texto (ex.: Porto Seguro).
 * Linhas de lançamento no padrão "dd/mmDESCRIÇÃO ... 1.234,56", às vezes com
 * o valor negativo colado na descrição ("PAGAMENTO PIX-5.292,67").
 * O ano é inferido a partir da data de vencimento (primeiro dd/mm/aaaa do texto).
 */
export function parseCardPdfText(text: string): ParseResult {
  const warnings: string[] = [];
  const rows: ParsedTransaction[] = [];

  const refMatch = text.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  const refYear = refMatch ? Number(refMatch[3]) : new Date().getFullYear();
  const refMonth = refMatch ? Number(refMatch[2]) : 12;

  const lineRe = /^(\d{2})\/(\d{2})(?!\/\d)(.*?)(-?\s?[\d.]*\d,\d{2})\s*$/;
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    const m = line.match(lineRe);
    if (!m) continue;
    const day = Number(m[1]);
    const month = Number(m[2]);
    if (month < 1 || month > 12 || day < 1 || day > 31) continue;
    const cents = parseToCents(m[4]);
    if (cents === null) continue;
    // fatura fechada em junho pode conter compras de meses anteriores;
    // se o mês do lançamento for maior que o do vencimento, é do ano anterior
    const year = month > refMonth ? refYear - 1 : refYear;
    const desc = m[3].replace(/\s{2,}/g, " ").trim();
    if (!desc) continue;
    rows.push({
      date: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
      description: desc,
      amountCents: -cents, // fatura de cartão: despesa positiva vira débito
    });
  }
  if (rows.length === 0) warnings.push("Nenhum lançamento reconhecido no PDF.");
  return { source: "pdf-cartao", sourceLabel: "Fatura de cartão (PDF)", rows, warnings };
}

/**
 * Parser genérico para texto extraído de PDF/DOCX: procura linhas com data
 * dd/mm/aaaa e um valor monetário no final.
 */
export function parseGenericText(text: string, sourceLabel = "Documento (texto)"): ParseResult {
  const warnings: string[] = [];
  const rows: ParsedTransaction[] = [];
  const lineRe = /^(\d{2}\/\d{2}\/\d{4})\s+(.+?)\s+(-?\s?R?\$?\s?[\d.]*\d,\d{2})\s*$/;
  for (const raw of text.split("\n")) {
    const m = raw.trim().match(lineRe);
    if (!m) continue;
    const [dd, mm, yyyy] = m[1].split("/");
    const cents = parseToCents(m[3]);
    if (cents === null) continue;
    rows.push({
      date: `${yyyy}-${mm}-${dd}`,
      description: m[2].replace(/\s{2,}/g, " ").trim(),
      amountCents: cents,
    });
  }
  if (rows.length === 0) warnings.push("Nenhum lançamento reconhecido no documento.");
  return { source: "texto-generico", sourceLabel, rows, warnings };
}
