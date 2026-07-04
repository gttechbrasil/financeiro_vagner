import mammoth from "mammoth";
import { ParseResult } from "./types";
import { parseGenericText } from "./pdf";

export async function parseDocx(buf: Buffer): Promise<ParseResult> {
  const { value } = await mammoth.extractRawText({ buffer: buf });
  const result = parseGenericText(value, "Documento Word (DOCX)");
  return { ...result, source: "docx" };
}
