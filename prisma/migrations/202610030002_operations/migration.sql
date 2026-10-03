-- DropForeignKey
ALTER TABLE "Invoice" DROP CONSTRAINT "Invoice_userId_fkey";

-- DropForeignKey
ALTER TABLE "Payment" DROP CONSTRAINT "Payment_userId_fkey";

-- DropForeignKey
ALTER TABLE "Reservation" DROP CONSTRAINT "Reservation_userId_fkey";

-- DropForeignKey
ALTER TABLE "ShopOrder" DROP CONSTRAINT "ShopOrder_userId_fkey";

-- AlterTable
ALTER TABLE "ClubSettings" ADD COLUMN     "deliveryFeePaise" INTEGER NOT NULL DEFAULT 10000,
ADD COLUMN     "socialPricePaise" INTEGER NOT NULL DEFAULT 30000,
ADD COLUMN     "tabDueDays" INTEGER NOT NULL DEFAULT 7,
ADD COLUMN     "trialDiscountBps" INTEGER NOT NULL DEFAULT 5000;

-- AlterTable
ALTER TABLE "CourtClosure" ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Credit" ADD COLUMN     "originId" TEXT;

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "dueAt" TIMESTAMPTZ(3),
ALTER COLUMN "userId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "KitchenOrder" ADD COLUMN     "ageConfirmed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "closedAt" TIMESTAMP(3),
ADD COLUMN     "guestName" TEXT,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'OPEN',
ADD COLUMN     "tabEnabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Payment" ALTER COLUMN "userId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Reservation" ADD COLUMN     "cancellationReason" TEXT,
ADD COLUMN     "guestEmail" TEXT,
ADD COLUMN     "guestName" TEXT,
ADD COLUMN     "invoiceId" TEXT,
ADD COLUMN     "kind" TEXT NOT NULL DEFAULT 'STANDARD',
ADD COLUMN     "priceSnapshot" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "trial" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "userId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "ShopOrder" ADD COLUMN     "channel" TEXT NOT NULL DEFAULT 'ONLINE',
ADD COLUMN     "fulfilledAt" TIMESTAMP(3),
ADD COLUMN     "guestEmail" TEXT,
ADD COLUMN     "guestName" TEXT,
ADD COLUMN     "holdUntil" TIMESTAMPTZ(3),
ADD COLUMN     "invoiceId" TEXT,
ADD COLUMN     "priceSnapshot" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "totalPaise" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "tracking" TEXT,
ALTER COLUMN "userId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "SocialEvent" ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "pricePaise" INTEGER NOT NULL DEFAULT 30000,
ADD COLUMN     "title" TEXT NOT NULL DEFAULT 'Friday social play';

-- AlterTable
ALTER TABLE "SocialParticipant" ADD COLUMN     "checkedInAt" TIMESTAMP(3),
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "holdUntil" TIMESTAMPTZ(3),
ADD COLUMN     "invoiceId" TEXT,
ADD COLUMN     "pricePaise" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "priceSnapshot" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'CONFIRMED';

-- AlterTable
ALTER TABLE "StaffNotification" ADD COLUMN     "dedupeKey" TEXT;

-- AlterTable
ALTER TABLE "WaitlistEntry" ADD COLUMN     "eventId" TEXT,
ADD COLUMN     "participantId" TEXT,
ADD COLUMN     "reservationId" TEXT;

-- CreateTable
CREATE TABLE "ShopOrderLine" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPaise" INTEGER NOT NULL,
    "discountPaise" INTEGER NOT NULL,
    "totalPaise" INTEGER NOT NULL,
    "returned" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ShopOrderLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Refund" (
    "id" TEXT NOT NULL,
    "creditId" TEXT NOT NULL,
    "amountPaise" INTEGER NOT NULL,
    "method" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RECORDED',
    "actorId" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Refund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KitchenTicket" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "preparation" TEXT NOT NULL DEFAULT 'INCOMING',
    "version" INTEGER NOT NULL DEFAULT 1,
    "invoiceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KitchenTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KitchenLine" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "menuId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPaise" INTEGER NOT NULL,
    "discountPaise" INTEGER NOT NULL,
    "totalPaise" INTEGER NOT NULL,
    "note" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "KitchenLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadQuote" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "totalPaise" INTEGER NOT NULL,
    "validUntil" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadQuote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ShopOrderLine_orderId_variantId_key" ON "ShopOrderLine"("orderId", "variantId");

-- CreateIndex
CREATE UNIQUE INDEX "Refund_creditId_key" ON "Refund"("creditId");

-- CreateIndex
CREATE UNIQUE INDEX "Refund_reference_key" ON "Refund"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "KitchenTicket_invoiceId_key" ON "KitchenTicket"("invoiceId");

-- CreateIndex
CREATE INDEX "KitchenTicket_preparation_createdAt_idx" ON "KitchenTicket"("preparation", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "KitchenTicket_orderId_revision_key" ON "KitchenTicket"("orderId", "revision");

-- CreateIndex
CREATE UNIQUE INDEX "Credit_originId_key" ON "Credit"("originId");

-- CreateIndex
CREATE UNIQUE INDEX "Reservation_invoiceId_key" ON "Reservation"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "ShopOrder_invoiceId_key" ON "ShopOrder"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "SocialParticipant_invoiceId_key" ON "SocialParticipant"("invoiceId");

-- CreateIndex
CREATE INDEX "SocialParticipant_userId_status_idx" ON "SocialParticipant"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "StaffNotification_dedupeKey_key" ON "StaffNotification"("dedupeKey");

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaitlistEntry" ADD CONSTRAINT "WaitlistEntry_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "SocialEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopOrder" ADD CONSTRAINT "ShopOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KitchenOrder" ADD CONSTRAINT "KitchenOrder_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopOrderLine" ADD CONSTRAINT "ShopOrderLine_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "ShopOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopOrderLine" ADD CONSTRAINT "ShopOrderLine_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_creditId_fkey" FOREIGN KEY ("creditId") REFERENCES "Credit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KitchenTicket" ADD CONSTRAINT "KitchenTicket_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "KitchenOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KitchenLine" ADD CONSTRAINT "KitchenLine_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "KitchenTicket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadQuote" ADD CONSTRAINT "LeadQuote_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- Operational invariants also protect direct/concurrent database writes.
ALTER TABLE "Reservation" ADD CONSTRAINT "reservation_hourly" CHECK (EXTRACT(MINUTE FROM "startsAt" AT TIME ZONE 'Asia/Kolkata')=0 AND EXTRACT(SECOND FROM "startsAt" AT TIME ZONE 'Asia/Kolkata')=0);
ALTER TABLE "Reservation" ADD CONSTRAINT "reservation_identity" CHECK (kind IN ('STANDARD','SOCIAL') AND (kind='SOCIAL' OR "userId" IS NOT NULL OR LENGTH("guestName")>=2));
ALTER TABLE "Reservation" ADD CONSTRAINT "social_friday" CHECK (kind<>'SOCIAL' OR EXTRACT(ISODOW FROM "startsAt" AT TIME ZONE 'Asia/Kolkata')=5);
ALTER TABLE "SocialEvent" ADD CONSTRAINT "social_values" CHECK (capacity>0 AND "pricePaise">=0);
ALTER TABLE "SocialParticipant" ADD CONSTRAINT "participant_values" CHECK (status IN ('HOLD','CONFIRMED','CANCELLED','EXPIRED') AND "pricePaise">=0);
ALTER TABLE "ShopOrderLine" ADD CONSTRAINT "order_line_values" CHECK (quantity>0 AND returned BETWEEN 0 AND quantity AND "unitPaise">=0 AND "discountPaise">=0 AND "totalPaise"=quantity*"unitPaise"-"discountPaise" AND "totalPaise">=0);
ALTER TABLE "KitchenLine" ADD CONSTRAINT "kitchen_line_values" CHECK (quantity>0 AND "unitPaise">=0 AND "discountPaise">=0 AND "totalPaise"=quantity*"unitPaise"-"discountPaise" AND "totalPaise">=0 AND status IN ('ACTIVE','CANCELLED'));
ALTER TABLE "Refund" ADD CONSTRAINT "refund_positive" CHECK ("amountPaise">0 AND status IN ('PENDING','RECORDED'));
CREATE UNIQUE INDEX "one_open_bill_per_table" ON "KitchenOrder"("tableId") WHERE status='OPEN';
CREATE UNIQUE INDEX "one_active_wait_offer" ON "WaitlistEntry"("courtId","startsAt",COALESCE("eventId",'')) WHERE status='OFFERED' AND "eventId" IS NULL;

CREATE FUNCTION guard_court_calendar() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM id FROM "Court" WHERE id=NEW."courtId" FOR UPDATE;
  IF TG_TABLE_NAME='Reservation' AND NEW.status IN ('HOLD','CONFIRMED') THEN
    IF EXISTS(SELECT 1 FROM "CourtClosure" c WHERE c."courtId"=NEW."courtId" AND c.active AND c."startsAt"<NEW."endsAt" AND c."endsAt">NEW."startsAt") THEN
      RAISE EXCEPTION 'Court has a maintenance closure' USING ERRCODE='23514';
    END IF;
  ELSIF TG_TABLE_NAME='CourtClosure' AND NEW.active THEN
    IF NEW."endsAt"<=NEW."startsAt" THEN RAISE EXCEPTION 'Invalid closure interval' USING ERRCODE='23514'; END IF;
    IF EXISTS(SELECT 1 FROM "Reservation" r WHERE r."courtId"=NEW."courtId" AND r.status IN ('HOLD','CONFIRMED') AND r."startsAt"<NEW."endsAt" AND r."endsAt">NEW."startsAt") THEN
      RAISE EXCEPTION 'Cancel affected reservations before closing this court' USING ERRCODE='23514';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER guard_reservation_calendar BEFORE INSERT OR UPDATE ON "Reservation" FOR EACH ROW EXECUTE FUNCTION guard_court_calendar();
CREATE TRIGGER guard_closure_calendar BEFORE INSERT OR UPDATE ON "CourtClosure" FOR EACH ROW EXECUTE FUNCTION guard_court_calendar();

CREATE FUNCTION guard_daily_quota() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE member_id text; club_day date; used_count integer; quota integer;
BEGIN
  IF TG_TABLE_NAME='Reservation' THEN
    IF NEW.kind='SOCIAL' OR NEW."userId" IS NULL OR NEW.status NOT IN ('HOLD','CONFIRMED') THEN RETURN NEW; END IF;
    member_id:=NEW."userId"; club_day:=NEW."clubDay";
  ELSE
    IF NEW.status NOT IN ('HOLD','CONFIRMED') THEN RETURN NEW; END IF;
    member_id:=NEW."userId";
    SELECT r."clubDay" INTO club_day FROM "SocialEvent" e JOIN "Reservation" r ON r.id=e."reservationId" WHERE e.id=NEW."eventId";
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(member_id,0));
  SELECT "dailySessionLimit" INTO quota FROM "ClubSettings" WHERE id='club';
  SELECT (SELECT COUNT(*) FROM "Reservation" r WHERE r."userId"=member_id AND r.kind='STANDARD' AND r."clubDay"=club_day AND (r.status='CONFIRMED' OR (r.status='HOLD' AND r."holdUntil">NOW())))
    +(SELECT COUNT(*) FROM "SocialParticipant" p JOIN "SocialEvent" e ON e.id=p."eventId" JOIN "Reservation" r ON r.id=e."reservationId" WHERE p."userId"=member_id AND r."clubDay"=club_day AND e.active AND (p.status='CONFIRMED' OR (p.status='HOLD' AND p."holdUntil">NOW()))) INTO used_count;
  IF used_count>quota THEN RAISE EXCEPTION 'Daily session limit exceeded' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER reservation_daily_quota AFTER INSERT OR UPDATE ON "Reservation" FOR EACH ROW EXECUTE FUNCTION guard_daily_quota();
CREATE TRIGGER social_daily_quota AFTER INSERT OR UPDATE ON "SocialParticipant" FOR EACH ROW EXECUTE FUNCTION guard_daily_quota();

CREATE FUNCTION guard_social_capacity() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE places integer; cap integer;
BEGIN
  SELECT capacity INTO cap FROM "SocialEvent" WHERE id=NEW."eventId" FOR UPDATE;
  SELECT COUNT(*) INTO places FROM "SocialParticipant" WHERE "eventId"=NEW."eventId" AND (status='CONFIRMED' OR (status='HOLD' AND "holdUntil">NOW()));
  IF places>cap THEN RAISE EXCEPTION 'Social session is full' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER social_capacity AFTER INSERT OR UPDATE ON "SocialParticipant" FOR EACH ROW EXECUTE FUNCTION guard_social_capacity();
