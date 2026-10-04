-- DropForeignKey
ALTER TABLE "GatewayRepayment" DROP CONSTRAINT "repayment_intent";

-- AlterTable
ALTER TABLE "MailMessage" ADD COLUMN     "html" TEXT;
