-- Leads from visitors without an account: contact details, what they want, repeat-enquiry merging and shareable quotes.
ALTER TABLE "Lead"
  ADD COLUMN "phone" TEXT,
  ADD COLUMN "interest" TEXT NOT NULL DEFAULT 'GENERAL',
  ADD COLUMN "planId" TEXT,
  ADD COLUMN "enquiryCount" INTEGER NOT NULL DEFAULT 1;
CREATE INDEX "Lead_email_idx" ON "Lead"("email");
ALTER TABLE "LeadQuote" ADD COLUMN "token" TEXT, ADD COLUMN "sentAt" TIMESTAMP(3);
UPDATE "LeadQuote" SET "token" = md5(random()::text || clock_timestamp()::text || id);
ALTER TABLE "LeadQuote" ALTER COLUMN "token" SET NOT NULL;
CREATE UNIQUE INDEX "LeadQuote_token_key" ON "LeadQuote"("token");
