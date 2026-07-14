import Anthropic from "@anthropic-ai/sdk";
import { ParseResult, ParsedTransaction } from "./types";

/**
 * Extração de transações por IA (API da Anthropic) para PDFs sem camada de
 * texto — ex.: fatura do C6, que é 100% imagem. Envia o PDF em base64 e pede
 * um JSON estruturado com os lançamentos.
 * Requer ANTHROPIC_API_KEY no .env.
 */

const SCHEMA = {
  type: "object" as const,
  properties: {
    documento: {
      type: "string",
      description: "Tipo do documento, ex.: 'fatura de cartão de crédito', 'extrato bancário'",
    },
    transactions: {
      type: "array",
      items: {
        type: "object" as const,
        properties: {
          date: { type: "string", format: "date", description: "Data do lançamento (ISO yyyy-mm-dd)" },
          description: { type: "string", description: "Descrição do lançamento" },
          amount: {
            type: "number",
            description:
              "Valor em reais. Em fatura de cartão: despesa NEGATIVA, pagamento/estorno POSITIVO. Em extrato de conta: crédito positivo, débito negativo.",
          },
          installment_current: {
            type: "integer",
            description: "Se a compra é parcelada (ex.: 'Parcela 4/12'), o número da parcela atual (4). Use 0 se não for parcelada.",
          },
          installment_total: {
            type: "integer",
            description: "Se a compra é parcelada, o total de parcelas (12). Use 0 se não for parcelada.",
          },
        },
        required: ["date", "description", "amount", "installment_current", "installment_total"],
        additionalProperties: false,
      },
    },
  },
  required: ["documento", "transactions"],
  additionalProperties: false,
};

export function aiAvailable(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export async function parsePdfWithAI(buf: Buffer, fileName: string): Promise<ParseResult> {
  if (!aiAvailable()) {
    return {
      source: "pdf-imagem",
      sourceLabel: "PDF escaneado (imagem)",
      rows: [],
      warnings: [
        "Este PDF não tem texto extraível (é digitalizado/imagem). " +
          "Configure ANTHROPIC_API_KEY no arquivo .env para extrair os lançamentos automaticamente por IA.",
      ],
    };
  }

  const client = new Anthropic();

  const stream = client.messages.stream({
    model: "claude-opus-4-8",
    max_tokens: 64000,
    thinking: { type: "adaptive" },
    output_config: { format: { type: "json_schema", schema: SCHEMA } },
    messages: [
      {
        role: "user",
        content: [
          {
            type: "document",
            source: {
              type: "base64",
              media_type: "application/pdf",
              data: buf.toString("base64"),
            },
          },
          {
            type: "text",
            text:
              `Extraia TODOS os lançamentos financeiros deste documento (${fileName}). ` +
              "Inclua cada transação individual com data completa (deduza o ano pelo contexto do documento, " +
              "como a data de vencimento), descrição e valor. " +
              "Não inclua subtotais, saldos, limites ou linhas de resumo — apenas lançamentos. " +
              "Convenção de sinal: em fatura de cartão, despesas são negativas e pagamentos/estornos positivos; " +
              "em extrato de conta, créditos positivos e débitos negativos.",
          },
        ],
      },
    ],
  });

  let message;
  try {
    message = await stream.finalMessage();
  } catch (e) {
    if (e instanceof Anthropic.APIError) {
      let friendly = `Erro na API de IA (${e.status}). Tente novamente em instantes.`;
      if (String(e.message).includes("credit balance")) {
        friendly =
          "A conta da Anthropic está sem créditos para a extração por IA. " +
          "Adicione créditos em console.anthropic.com (Plans & Billing) e tente de novo.";
      } else if (e.status === 401) {
        friendly =
          "A ANTHROPIC_API_KEY configurada no .env é inválida ou foi revogada. " +
          "Gere uma nova em console.anthropic.com e atualize o .env.";
      } else if (e.status === 429) {
        friendly = "Limite de uso da API de IA atingido. Aguarde alguns minutos e tente de novo.";
      }
      return { source: "pdf-ia", sourceLabel: "PDF via IA", rows: [], warnings: [friendly] };
    }
    throw e;
  }

  if (message.stop_reason === "refusal") {
    return {
      source: "pdf-ia",
      sourceLabel: "PDF via IA",
      rows: [],
      warnings: ["A extração por IA foi recusada para este documento. Tente importar em outro formato (CSV/OFX)."],
    };
  }

  const textBlock = message.content.find((b) => b.type === "text");
  const warnings: string[] = [];
  const rows: ParsedTransaction[] = [];
  if (!textBlock || textBlock.type !== "text") {
    return { source: "pdf-ia", sourceLabel: "PDF via IA", rows, warnings: ["A IA não retornou dados."] };
  }

  try {
    const data = JSON.parse(textBlock.text) as {
      documento: string;
      transactions: {
        date: string;
        description: string;
        amount: number;
        installment_current: number;
        installment_total: number;
      }[];
    };
    for (const t of data.transactions) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(t.date)) continue;
      const isInstallment =
        t.installment_total >= 2 && t.installment_current >= 1 && t.installment_current <= t.installment_total;
      rows.push({
        date: t.date,
        description: t.description,
        amountCents: Math.round(t.amount * 100),
        ...(isInstallment
          ? { installmentNum: t.installment_current, installmentTotal: t.installment_total }
          : {}),
      });
    }
    if (message.stop_reason === "max_tokens") {
      warnings.push("O documento é muito longo e a extração pode estar incompleta.");
    }
  } catch {
    warnings.push("Não foi possível interpretar a resposta da IA.");
  }

  return { source: "pdf-ia", sourceLabel: "PDF via IA (documento escaneado)", rows, warnings };
}
