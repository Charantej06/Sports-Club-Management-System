-- AlterTable
ALTER TABLE "ClubSettings" ADD COLUMN     "payrollTaxBps" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "payrollTaxLabel" TEXT NOT NULL DEFAULT 'Configured withholding',
ADD COLUMN     "reminderHour" INTEGER NOT NULL DEFAULT 9;

-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "LeaveRequest" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "decidedBy" TEXT,
ADD COLUMN     "decisionReason" TEXT;

-- AlterTable
ALTER TABLE "MailMessage" ADD COLUMN     "membershipId" TEXT;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "actorId" TEXT,
ADD COLUMN     "cashShiftId" TEXT;

-- AlterTable
ALTER TABLE "Refund" ADD COLUMN     "cashShiftId" TEXT,
ADD COLUMN     "recordedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "CashPayout" (
    "id" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "amountPaise" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CashPayout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessQuote" (
    "id" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "customerEmail" TEXT NOT NULL,
    "department" "Department" NOT NULL,
    "lines" JSONB NOT NULL,
    "totalPaise" INTEGER NOT NULL,
    "validUntil" TIMESTAMPTZ(3) NOT NULL,
    "actorId" TEXT NOT NULL,
    "invoiceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BusinessQuote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BusinessQuote_invoiceId_key" ON "BusinessQuote"("invoiceId");

-- AddForeignKey
ALTER TABLE "CashPayout" ADD CONSTRAINT "CashPayout_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "CashShift"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Business constraints and immutable finalized snapshots.
ALTER TABLE "ClubSettings" ADD CONSTRAINT admin_settings CHECK ("reminderHour" BETWEEN 0 AND 23 AND "payrollTaxBps" BETWEEN 0 AND 10000);
ALTER TABLE "Employee" ADD CONSTRAINT employee_salary CHECK ("salaryPaise" BETWEEN 0 AND 100000000);
ALTER TABLE "Employee" ADD CONSTRAINT employee_user FOREIGN KEY ("userId") REFERENCES "User"(id);
ALTER TABLE "StaffShift" ADD CONSTRAINT shift_interval CHECK ("endsAt" > "startsAt");
ALTER TABLE "StaffShift" ADD CONSTRAINT shift_no_overlap EXCLUDE USING gist ("employeeId" WITH =, tsrange("startsAt", "endsAt", '[)') WITH &&);
ALTER TABLE "LeaveRequest" ADD CONSTRAINT leave_interval CHECK ("endsAt" > "startsAt" AND status IN ('PENDING', 'APPROVED', 'REJECTED'));
ALTER TABLE "CashShift" ADD CONSTRAINT cash_amounts CHECK ("openingPaise" >= 0 AND ("countedPaise" IS NULL OR "countedPaise" >= 0));
CREATE UNIQUE INDEX one_open_cash_shift ON "CashShift"("actorId") WHERE "closedAt" IS NULL;
ALTER TABLE "CashPayout" ADD CONSTRAINT payout_positive CHECK ("amountPaise" > 0);
ALTER TABLE "Payment" ADD CONSTRAINT payment_shift FOREIGN KEY ("cashShiftId") REFERENCES "CashShift"(id);
ALTER TABLE "Refund" ADD CONSTRAINT refund_shift FOREIGN KEY ("cashShiftId") REFERENCES "CashShift"(id);
CREATE INDEX payment_cash_shift ON "Payment"("cashShiftId");
CREATE INDEX refund_cash_shift ON "Refund"("cashShiftId");
CREATE INDEX membership_mail ON "MailMessage"("membershipId");
CREATE FUNCTION protect_finalized_admin() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_TABLE_NAME = 'Payslip' THEN
    IF OLD."finalizedAt" IS NOT NULL THEN RAISE EXCEPTION 'Finalized payslips are immutable'; END IF;
  ELSE
    IF OLD."closedAt" IS NOT NULL THEN RAISE EXCEPTION 'Closed cash shifts are immutable'; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER payslip_immutable BEFORE UPDATE ON "Payslip" FOR EACH ROW EXECUTE FUNCTION protect_finalized_admin();
CREATE TRIGGER cash_closed_immutable BEFORE UPDATE ON "CashShift" FOR EACH ROW EXECUTE FUNCTION protect_finalized_admin();
