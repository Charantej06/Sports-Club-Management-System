import { test } from "node:test";
import assert from "node:assert/strict";
import {
  courtCreateSchema,
  courtUpdateSchema,
} from "../src/modules/staff/validation";

test("Court create validation accepts valid court configurations", () => {
  const valid = {
    name: "Padel Court 3",
    sportId: "padel",
    hourlyPaise: 120000,
    indoor: false,
    active: true,
  };
  const result = courtCreateSchema.safeParse(valid);
  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.name, "Padel Court 3");
    assert.equal(result.data.hourlyPaise, 120000);
    assert.equal(result.data.sportId, "padel");
    assert.equal(result.data.indoor, false);
    assert.equal(result.data.active, true);
  }
});

test("Court create validation supports custom alphanumeric hyphenated ID", () => {
  const withCustomId = {
    id: "padel-glass-3",
    name: "Padel Glass Court 3",
    sportId: "padel",
    hourlyPaise: 150000,
    indoor: true,
    active: true,
  };
  const result = courtCreateSchema.safeParse(withCustomId);
  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.id, "padel-glass-3");
    assert.equal(result.data.indoor, true);
  }
});

test("Court create validation rejects invalid court inputs", () => {
  // Negative hourly price
  assert.equal(
    courtCreateSchema.safeParse({
      name: "Bad Price Court",
      sportId: "tennis",
      hourlyPaise: -500,
    }).success,
    false,
  );

  // Short court name
  assert.equal(
    courtCreateSchema.safeParse({
      name: "C",
      sportId: "tennis",
      hourlyPaise: 80000,
    }).success,
    false,
  );

  // Missing sportId
  assert.equal(
    courtCreateSchema.safeParse({
      name: "Court 4",
      sportId: "",
      hourlyPaise: 80000,
    }).success,
    false,
  );

  // Invalid ID format with spaces or illegal characters
  assert.equal(
    courtCreateSchema.safeParse({
      id: "court with spaces",
      name: "Court 4",
      sportId: "tennis",
      hourlyPaise: 80000,
    }).success,
    false,
  );

  assert.equal(
    courtCreateSchema.safeParse({
      id: "court@#$!",
      name: "Court 4",
      sportId: "tennis",
      hourlyPaise: 80000,
    }).success,
    false,
  );
});

test("Court update validation validates partial edits and requires court ID", () => {
  // Valid partial update
  const validUpdate = courtUpdateSchema.safeParse({
    id: "tennis-1",
    active: false,
    hourlyPaise: 90000,
  });
  assert.equal(validUpdate.success, true);

  // Missing court ID
  const missingId = courtUpdateSchema.safeParse({
    active: false,
  });
  assert.equal(missingId.success, false);

  // Negative hourly rate
  const negativePrice = courtUpdateSchema.safeParse({
    id: "tennis-1",
    hourlyPaise: -100,
  });
  assert.equal(negativePrice.success, false);
});
