import "dotenv/config";
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { db } from "../../src/lib/db";
const base = process.env.TEST_BASE_URL || "http://localhost:3000",
  prefix = "http-" + randomUUID();
let ownerCookie = "";
const ids = [
  prefix,
  prefix + "-member",
  prefix + "-kitchen",
  prefix + "-cashier",
];
before(async () => {
  const password = await hashPassword("Operations2026!");
  for (const [n, id] of ids.entries()) {
    await db.user.create({
      data: {
        id,
        name: "HTTP Operations",
        email: id + "@example.test",
        emailVerified: true,
        championsId: "CC-" + id,
        role: (["OWNER", "MEMBER", "KITCHEN", "CASHIER"] as const)[n],
      },
    });
    await db.account.create({
      data: {
        id: "account-" + id,
        accountId: id,
        providerId: "credential",
        userId: id,
        password,
      },
    });
  }
  const r = await fetch(base + "/api/auth/sign-in/email", {
    method: "POST",
    headers: { Origin: base, "Content-Type": "application/json" },
    body: JSON.stringify({
      email: prefix + "@example.test",
      password: "Operations2026!",
    }),
  });
  assert.equal(r.status, 200);
  ownerCookie = r.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
});
after(async () => {
  await db.checkout.deleteMany({ where: { userId: { in: ids } } });
  await db.user.deleteMany({ where: { id: { in: ids } } });
  await db.$disconnect();
});
test("Operational routes validate payloads, origin, roles and client price injection", async () => {
  for (const area of [
    "reception",
    "crm",
    "inventory",
    "pos",
    "kitchen",
    "billing",
  ]) {
    const r = await fetch(`${base}/api/operations/${area}`, {
      headers: { Cookie: ownerCookie },
    });
    assert.equal(r.status, 200, await r.clone().text());
  }
  const send = (area: string, input: unknown, origin = base) =>
    fetch(`${base}/api/operations/${area}`, {
      method: "POST",
      headers: {
        Origin: origin,
        Cookie: ownerCookie,
        "Content-Type": "application/json",
        "Idempotency-Key": randomUUID(),
      },
      body: JSON.stringify(input),
    });
  assert.equal(
    (
      await send("booking", {
        courtId: "tennis-1",
        day: "2026-10-09",
        hour: 10,
        pricePaise: 1,
      })
    ).status,
    422,
  );
  assert.equal(
    (
      await send("order", {
        items: [{ variantId: "pro-tour-98-0", quantity: 1 }],
        totalPaise: 1,
      })
    ).status,
    422,
  );
  assert.equal(
    (await send("bill", { tableId: "table-1", items: [], pricePaise: 1 }))
      .status,
    422,
  );
  assert.equal(
    (await send("booking", {}, "https://untrusted.example")).status,
    403,
  );
  assert.equal((await send("unknown", {})).status, 404);
});
