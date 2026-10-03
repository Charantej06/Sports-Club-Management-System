-- DropForeignKey
ALTER TABLE "GatewayIntent" DROP CONSTRAINT "gateway_user";

-- CreateTable
CREATE TABLE "GatewayRepayment" (
    "id" TEXT NOT NULL,
    "intentId" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "amountPaise" INTEGER NOT NULL,
    "department" "Department" NOT NULL,
    "actorId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GatewayRepayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GatewayRepayment_intentId_key" ON "GatewayRepayment"("intentId");

-- CreateIndex
CREATE UNIQUE INDEX "GatewayRepayment_reference_key" ON "GatewayRepayment"("reference");
ALTER TABLE "GatewayRepayment" ADD CONSTRAINT repayment_amount CHECK ("amountPaise" > 0);
ALTER TABLE "GatewayRepayment" ADD CONSTRAINT repayment_intent FOREIGN KEY ("intentId") REFERENCES "GatewayIntent"(id);
