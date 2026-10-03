-- DropForeignKey
ALTER TABLE "Employee" DROP CONSTRAINT "employee_user";

-- DropForeignKey
ALTER TABLE "Payment" DROP CONSTRAINT "payment_shift";

-- DropForeignKey
ALTER TABLE "Refund" DROP CONSTRAINT "refund_shift";

-- DropIndex
DROP INDEX "membership_mail";

-- DropIndex
DROP INDEX "payment_cash_shift";

-- DropIndex
DROP INDEX "refund_cash_shift";

-- CreateTable
CREATE TABLE "GatewayIntent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "targetId" TEXT,
    "input" JSONB NOT NULL,
    "amountPaise" INTEGER NOT NULL,
    "orderId" TEXT,
    "paymentId" TEXT,
    "state" TEXT NOT NULL DEFAULT 'CREATING',
    "result" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GatewayIntent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GatewayIntent_orderId_key" ON "GatewayIntent"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "GatewayIntent_paymentId_key" ON "GatewayIntent"("paymentId");

-- CreateIndex
CREATE UNIQUE INDEX "GatewayIntent_userId_key_key" ON "GatewayIntent"("userId", "key");
