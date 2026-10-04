-- Sports and courts are managed by the owner: new facilities can be added and
-- existing ones can be put under maintenance or retired without deleting history.
CREATE TYPE "FacilityStatus" AS ENUM ('ACTIVE', 'MAINTENANCE', 'INACTIVE');
ALTER TABLE "Sport"
  ADD COLUMN "status" "FacilityStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "statusNote" TEXT;
ALTER TABLE "Court"
  ADD COLUMN "status" "FacilityStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "statusNote" TEXT;
UPDATE "Court" SET "status" = 'INACTIVE' WHERE NOT "active";
DROP INDEX IF EXISTS "Court_sportId_active_idx";
ALTER TABLE "Court" DROP COLUMN "active";
CREATE INDEX "Court_sportId_status_idx" ON "Court"("sportId", "status");
ALTER TABLE "Court" ADD CONSTRAINT "court_rate" CHECK ("hourlyPaise" >= 0);
