-- AlterTable
ALTER TABLE "StaffShift" ADD COLUMN     "cancellationReason" TEXT,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'SCHEDULED';

ALTER TABLE "StaffShift" DROP CONSTRAINT shift_no_overlap;
ALTER TABLE "StaffShift" ADD CONSTRAINT shift_status CHECK (status IN ('SCHEDULED', 'CANCELLED'));
ALTER TABLE "StaffShift" ADD CONSTRAINT shift_no_overlap EXCLUDE USING gist ("employeeId" WITH =, tsrange("startsAt", "endsAt", '[)') WITH &&) WHERE (status = 'SCHEDULED');
ALTER TABLE "LeaveRequest" ADD CONSTRAINT leave_no_overlap EXCLUDE USING gist ("employeeId" WITH =, tsrange("startsAt", "endsAt", '[)') WITH &&) WHERE (status = 'APPROVED');
ALTER TABLE "GatewayIntent" ADD CONSTRAINT gateway_user FOREIGN KEY ("userId") REFERENCES "User"(id);
ALTER TABLE "GatewayIntent" ADD CONSTRAINT gateway_amount CHECK ("amountPaise" > 0);
CREATE FUNCTION cash_record_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE target text; finished timestamp;
BEGIN
  IF TG_TABLE_NAME = 'CashPayout' THEN target := NEW."shiftId"; ELSE target := NEW."cashShiftId"; END IF;
  IF target IS NULL THEN RETURN NEW; END IF;
  SELECT "closedAt" INTO finished FROM "CashShift" WHERE id=target FOR UPDATE;
  IF finished IS NOT NULL THEN RAISE EXCEPTION 'Cannot attach cash records to a closed shift'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER cash_payment_guard BEFORE INSERT OR UPDATE ON "Payment" FOR EACH ROW EXECUTE FUNCTION cash_record_guard();
CREATE TRIGGER cash_refund_guard BEFORE INSERT OR UPDATE ON "Refund" FOR EACH ROW EXECUTE FUNCTION cash_record_guard();
CREATE TRIGGER cash_payout_guard BEFORE INSERT OR UPDATE ON "CashPayout" FOR EACH ROW EXECUTE FUNCTION cash_record_guard();
