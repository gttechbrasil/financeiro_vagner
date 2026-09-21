-- CreateTable
CREATE TABLE "Commitment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "description" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "dueDay" INTEGER NOT NULL,
    "startDate" DATETIME NOT NULL,
    "installments" INTEGER,
    "pattern" TEXT,
    "bankAccountId" TEXT,
    "accountId" TEXT,
    "supplierId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Commitment_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "BankAccount" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Commitment_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "DreAccount" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Commitment_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
