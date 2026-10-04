import "dotenv/config";
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { db } from "../../src/lib/db";
import {
  getCourtSchedule,
  createCourt,
  updateCourt,
} from "../../src/modules/staff/courts";

const testCourtIds: string[] = [];

after(async () => {
  if (testCourtIds.length > 0) {
    await db.auditLog.deleteMany({
      where: { entityId: { in: testCourtIds } },
    });
    await db.court.deleteMany({
      where: { id: { in: testCourtIds } },
    });
  }
  await db.$disconnect();
});

test("getCourtSchedule returns complete court availability and operating slots", async () => {
  const result = await getCourtSchedule();

  assert.ok(result.day);
  assert.ok(result.settings.openHour < result.settings.closeHour);
  assert.ok(result.sports.length > 0);
  assert.ok(result.courts.length > 0);
  assert.ok(result.stats.totalCourts > 0);
  assert.ok(result.stats.totalSlots > 0);

  const firstCourt = result.courts[0];
  assert.ok(firstCourt.id);
  assert.ok(firstCourt.name);
  assert.ok(firstCourt.slots.length > 0);
  assert.equal(
    firstCourt.slots.length,
    result.settings.closeHour - result.settings.openHour,
  );

  const firstSlot = firstCourt.slots[0];
  assert.equal(firstSlot.hour, result.settings.openHour);
  assert.ok(["AVAILABLE", "BOOKED", "HOLD", "CLOSED"].includes(firstSlot.status));
});

test("createCourt creates court, auto-generates ID, and writes audit record", async () => {
  const actor = await db.user.findFirst({
    where: { role: { in: ["OWNER", "RECEPTION"] } },
  });
  assert.ok(actor, "Staff user should exist in seeded database");

  const newCourt = await createCourt(actor.id, {
    name: "Test Padel Glass 99",
    sportId: "padel",
    hourlyPaise: 130000,
    indoor: false,
    active: true,
  });

  testCourtIds.push(newCourt.id);

  assert.ok(newCourt.id.startsWith("padel-"));
  assert.equal(newCourt.name, "Test Padel Glass 99");
  assert.equal(newCourt.sportId, "padel");
  assert.equal(newCourt.hourlyPaise, 130000);
  assert.equal(newCourt.indoor, false);
  assert.equal(newCourt.active, true);

  // Verify court persisted in database
  const inDb = await db.court.findUnique({
    where: { id: newCourt.id },
    include: { sport: true },
  });
  assert.ok(inDb);
  assert.equal(inDb.name, "Test Padel Glass 99");

  // Verify audit log was recorded
  const auditEntry = await db.auditLog.findFirst({
    where: {
      action: "court.create",
      entityId: newCourt.id,
      actorId: actor.id,
    },
  });
  assert.ok(auditEntry);
});

test("createCourt with explicit custom ID respects and enforces uniqueness", async () => {
  const actor = await db.user.findFirst({
    where: { role: { in: ["OWNER", "RECEPTION"] } },
  });
  assert.ok(actor);

  const customId = `tennis-test-custom-${Date.now()}`;

  const court = await createCourt(actor.id, {
    id: customId,
    name: "Custom Test Tennis Court",
    sportId: "tennis",
    hourlyPaise: 85000,
    indoor: true,
    active: true,
  });

  testCourtIds.push(court.id);
  assert.equal(court.id, customId);

  // Attempting to create duplicate ID must fail
  await assert.rejects(
    () =>
      createCourt(actor.id, {
        id: customId,
        name: "Duplicate Court",
        sportId: "tennis",
        hourlyPaise: 85000,
        indoor: true,
        active: true,
      }),
    { code: "COURT_EXISTS" },
  );
});

test("updateCourt modifies court state and records audit log", async () => {
  const actor = await db.user.findFirst({
    where: { role: { in: ["OWNER", "RECEPTION"] } },
  });
  assert.ok(actor);

  const testCourt = await createCourt(actor.id, {
    name: "Updateable Test Court",
    sportId: "cricket",
    hourlyPaise: 60000,
    indoor: false,
    active: true,
  });
  testCourtIds.push(testCourt.id);

  // Update active to false and hourlyPaise to 75000
  const updated = await updateCourt(actor.id, {
    id: testCourt.id,
    active: false,
    hourlyPaise: 75000,
  });

  assert.equal(updated.active, false);
  assert.equal(updated.hourlyPaise, 75000);

  // Verify in database
  const inDb = await db.court.findUnique({ where: { id: testCourt.id } });
  assert.equal(inDb?.active, false);
  assert.equal(inDb?.hourlyPaise, 75000);

  // Verify audit log
  const audit = await db.auditLog.findFirst({
    where: { action: "court.update", entityId: testCourt.id },
  });
  assert.ok(audit);
});
