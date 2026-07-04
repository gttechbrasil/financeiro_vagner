import crypto from "crypto";

/** Hash de deduplicação de uma transação importada. */
export function txHash(
  bankAccountId: string,
  date: string,
  amountCents: number,
  description: string,
  externalId?: string | null
) {
  return crypto
    .createHash("sha256")
    .update([bankAccountId, date, amountCents, description, externalId ?? ""].join("|"))
    .digest("hex");
}
