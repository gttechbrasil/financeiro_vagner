import { ParseResult } from "./types";
import { isAsaasCsv, parseAsaasCsv } from "./asaas";
import { parseSicrediXls, isSicrediCartaoCsv, parseSicrediCartaoCsv } from "./sicredi";
import { isOfx, parseOfx } from "./ofx";
import { extractPdfText, parseCardPdfText, parseGenericText } from "./pdf";
import { parseDocx } from "./docx";
import { parsePdfWithAI } from "./ai";

function decodeText(buf: Buffer): string {
  const utf8 = buf.toString("utf8");
  // se houver muitos caracteres de substituição, o arquivo é latin1
  const bad = (utf8.match(/�/g) ?? []).length;
  return bad > 2 ? buf.toString("latin1") : utf8.replace(/^﻿/, "");
}

/** Detecta o formato do arquivo e extrai os lançamentos. */
export async function detectAndParse(fileName: string, buf: Buffer): Promise<ParseResult> {
  const ext = fileName.toLowerCase().split(".").pop() ?? "";

  if (ext === "xls" || ext === "xlsx") {
    const result = parseSicrediXls(buf);
    if (result) return result;
    return {
      source: "xls",
      sourceLabel: "Planilha",
      rows: [],
      warnings: ["Formato de planilha não reconhecido. Esperado extrato/fatura Sicredi."],
    };
  }

  if (ext === "pdf") {
    const { text } = await extractPdfText(buf);
    if (text.replace(/\s/g, "").length < 50) {
      // PDF de imagem (escaneado) — tenta extração por IA
      return parsePdfWithAI(buf, fileName);
    }
    const isCard = /fatura|cart[ãa]o|pagamento m[íi]nimo/i.test(text);
    if (isCard) {
      const result = parseCardPdfText(text);
      if (result.rows.length > 0) return result;
    }
    const generic = parseGenericText(text, "PDF (texto)");
    if (generic.rows.length > 0) return generic;
    // texto existe mas nenhum padrão reconhecido — IA como último recurso
    return parsePdfWithAI(buf, fileName);
  }

  if (ext === "docx") {
    return parseDocx(buf);
  }

  // CSV, OFX, TXT ou sem extensão: decide pelo conteúdo
  const text = decodeText(buf);
  if (isOfx(text)) return parseOfx(text);
  if (isAsaasCsv(text)) return parseAsaasCsv(text);
  if (isSicrediCartaoCsv(text)) return parseSicrediCartaoCsv(text);

  const generic = parseGenericText(text, "Arquivo de texto");
  if (generic.rows.length > 0) return generic;

  return {
    source: "desconhecido",
    sourceLabel: "Desconhecido",
    rows: [],
    warnings: [
      "Formato não reconhecido. Formatos aceitos: CSV do Asaas, CSV/XLS Sicredi, OFX (Nubank), PDF de fatura, DOCX.",
    ],
  };
}
