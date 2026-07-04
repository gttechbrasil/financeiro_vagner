import { ParseResult, ParsedTransaction } from "./types";

export function isOfx(text: string): boolean {
  const head = text.slice(0, 500).toUpperCase();
  return head.includes("OFXHEADER") || head.includes("<OFX>");
}

/** Extrai um campo SGML/XML: <TAG>valor (com ou sem tag de fechamento). */
function field(block: string, tag: string): string | undefined {
  const m = block.match(new RegExp(`<${tag}>([^<\r\n]*)`, "i"));
  return m?.[1]?.trim() || undefined;
}

export function parseOfx(text: string): ParseResult {
  const rows: ParsedTransaction[] = [];
  const warnings: string[] = [];
  const blocks = text.match(/<STMTTRN>[\s\S]*?(?=<STMTTRN>|<\/BANKTRANLIST>|<\/CCSTMTRS>|$)/gi) ?? [];
  for (const b of blocks) {
    const dt = field(b, "DTPOSTED");
    const amt = field(b, "TRNAMT");
    if (!dt || !amt) continue;
    const m = dt.match(/^(\d{4})(\d{2})(\d{2})/);
    if (!m) continue;
    const n = Number(amt.replace(",", "."));
    if (!isFinite(n)) {
      warnings.push(`Valor inválido: ${amt}`);
      continue;
    }
    rows.push({
      date: `${m[1]}-${m[2]}-${m[3]}`,
      description: field(b, "MEMO") ?? field(b, "NAME") ?? "Sem descrição",
      amountCents: Math.round(n * 100),
      externalId: field(b, "FITID"),
    });
  }
  return { source: "ofx", sourceLabel: "OFX (extrato bancário)", rows, warnings };
}
