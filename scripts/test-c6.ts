import fs from "fs";
import dotenv from "dotenv";
dotenv.config();
import { detectAndParse } from "../src/lib/parsers";

async function main() {
  const buf = fs.readFileSync("C:/Users/gustavo/Desktop/exemplodoc/Cartão_C6_PJ.pdf");
  console.log("Enviando fatura C6 (7 páginas, imagem) para extração por IA...");
  const t0 = Date.now();
  const r = await detectAndParse("Cartão_C6_PJ.pdf", buf);
  console.log(`\nFormato: ${r.sourceLabel} | tempo: ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  console.log(`Lançamentos extraídos: ${r.rows.length}`);
  if (r.warnings.length) console.log("Avisos:", r.warnings.join(" | "));
  const sum = r.rows.reduce((s, x) => s + x.amountCents, 0);
  const despesas = r.rows.filter((x) => x.amountCents < 0).reduce((s, x) => s + x.amountCents, 0);
  const creditos = r.rows.filter((x) => x.amountCents > 0).reduce((s, x) => s + x.amountCents, 0);
  console.log(`Despesas: R$ ${(-despesas / 100).toFixed(2)} | Créditos: R$ ${(creditos / 100).toFixed(2)} | Líquido: R$ ${(sum / 100).toFixed(2)}`);
  console.log("\nPrimeiros lançamentos:");
  for (const row of r.rows.slice(0, 10)) {
    console.log(`  ${row.date}  ${(row.amountCents / 100).toFixed(2).padStart(12)}  ${row.description.slice(0, 55)}`);
  }
}
main().catch((e) => { console.error("ERRO:", e.message); process.exit(1); });
