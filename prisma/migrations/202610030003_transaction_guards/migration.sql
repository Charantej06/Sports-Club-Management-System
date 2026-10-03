-- Branch by table before accessing its record fields, including inactive transitions.
CREATE OR REPLACE FUNCTION guard_court_calendar() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM id FROM "Court" WHERE id=NEW."courtId" FOR UPDATE;
  IF TG_TABLE_NAME='Reservation' THEN
    IF NEW.status IN ('HOLD','CONFIRMED') AND EXISTS(SELECT 1 FROM "CourtClosure" c WHERE c."courtId"=NEW."courtId" AND c.active AND c."startsAt"<NEW."endsAt" AND c."endsAt">NEW."startsAt") THEN
      RAISE EXCEPTION 'Court has a maintenance closure' USING ERRCODE='23514';
    END IF;
  ELSE
    IF NEW."endsAt"<=NEW."startsAt" THEN RAISE EXCEPTION 'Invalid closure interval' USING ERRCODE='23514'; END IF;
    IF NEW.active AND EXISTS(SELECT 1 FROM "Reservation" r WHERE r."courtId"=NEW."courtId" AND r.status IN ('HOLD','CONFIRMED') AND r."startsAt"<NEW."endsAt" AND r."endsAt">NEW."startsAt") THEN
      RAISE EXCEPTION 'Cancel affected reservations before closing this court' USING ERRCODE='23514';
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE FUNCTION guard_invoice_snapshot() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (to_jsonb(NEW)-'dueAt') IS DISTINCT FROM (to_jsonb(OLD)-'dueAt') THEN
    RAISE EXCEPTION 'Issued invoice snapshots are immutable' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER invoice_snapshot BEFORE UPDATE ON "Invoice" FOR EACH ROW EXECUTE FUNCTION guard_invoice_snapshot();
CREATE FUNCTION guard_line_snapshot() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Issued invoice lines are immutable' USING ERRCODE='23514'; END $$;
CREATE TRIGGER invoice_line_snapshot BEFORE UPDATE ON "InvoiceLine" FOR EACH ROW EXECUTE FUNCTION guard_line_snapshot();

CREATE FUNCTION guard_invoice_ledger() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE total integer; paid bigint; credited bigint;
BEGIN
  SELECT "totalPaise" INTO total FROM "Invoice" WHERE id=NEW."invoiceId" FOR UPDATE;
  SELECT COALESCE(SUM("amountPaise"),0) INTO paid FROM "PaymentAllocation" WHERE "invoiceId"=NEW."invoiceId";
  SELECT COALESCE(SUM("amountPaise"),0) INTO credited FROM "Credit" WHERE "invoiceId"=NEW."invoiceId";
  IF credited>total OR (TG_TABLE_NAME='PaymentAllocation' AND paid+credited>total) THEN
    RAISE EXCEPTION 'Invoice allocation or credit exceeds balance' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER allocation_balance AFTER INSERT OR UPDATE ON "PaymentAllocation" FOR EACH ROW EXECUTE FUNCTION guard_invoice_ledger();
CREATE TRIGGER credit_balance AFTER INSERT OR UPDATE ON "Credit" FOR EACH ROW EXECUTE FUNCTION guard_invoice_ledger();
