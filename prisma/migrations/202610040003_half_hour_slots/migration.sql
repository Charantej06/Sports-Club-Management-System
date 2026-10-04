-- Sessions last one hour and a new slot opens every half hour (configurable: 30 or 60 minutes).
ALTER TABLE "ClubSettings" ADD COLUMN "slotMinutes" INTEGER NOT NULL DEFAULT 30;
ALTER TABLE "ClubSettings" ADD CONSTRAINT "settings_slot_minutes" CHECK ("slotMinutes" IN (30, 60));
-- Reservations may now start on the hour or half hour (club time); the overlap exclusion constraint is unchanged.
ALTER TABLE "Reservation" DROP CONSTRAINT "reservation_hourly";
ALTER TABLE "Reservation" ADD CONSTRAINT "reservation_slot_start" CHECK (EXTRACT(MINUTE FROM "startsAt" AT TIME ZONE 'Asia/Kolkata') IN (0, 30) AND EXTRACT(SECOND FROM "startsAt" AT TIME ZONE 'Asia/Kolkata') = 0);
-- Idempotently keep the repayment integrity guard in place: a gateway repayment must reference a real intent.
ALTER TABLE "GatewayRepayment" DROP CONSTRAINT IF EXISTS "repayment_intent";
ALTER TABLE "GatewayRepayment" ADD CONSTRAINT "repayment_intent" FOREIGN KEY ("intentId") REFERENCES "GatewayIntent"(id);
