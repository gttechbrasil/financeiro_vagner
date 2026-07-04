/* Teste manual dos parsers com os arquivos de exemplo.
   Uso: npx tsx scripts/test-parsers.ts */
import fs from "fs";
import path from "path";
import { detectAndParse } from "../src/lib/parsers";

const DIR = "C:/Users/gustavo/Desktop/exemplodoc";
const FILES = [
  "Extrato_Asaas.csv",
  "Conta Sicredi PJ.xls",
  "Cartão Sicredi Visa PJ.xls",
  "Cartão_Sicredi_PF.csv",
  "Nubank PF",
  "Cartão_Porto_Seguro_PF.pdf",
  "Cartão_C6_PJ.pdf",
];

async function main() {
  for (const f of FILES) {
    const buf = fs.readFileSync(path.join(DIR, f));
    try {
      const r = await detectAndParse(f, buf);
      const sum = r.rows.reduce((s, x) => s + x.amountCents, 0);
      console.log(`\n=== ${f}`);
      console.log(`   formato: ${r.sourceLabel} | linhas: ${r.rows.length} | soma: R$ ${(sum / 100).toFixed(2)}`);
      if (r.warnings.length) console.log(`   avisos: ${r.warnings.slice(0, 2).join(" | ")}`);
      for (const row of r.rows.slice(0, 3)) {
        console.log(`   ${row.date}  ${(row.amountCents / 100).toFixed(2).padStart(12)}  ${row.description.slice(0, 50)}`);
      }
    } catch (e) {
      console.log(`\n=== ${f}\n   ERRO: ${e instanceof Error ? e.message : e}`);
    }
  }
}

main();
