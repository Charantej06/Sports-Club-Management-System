import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  parseCartItems,
  mergeCartItems,
  userCartKey,
  getActiveCartKey,
  setActiveCartUserId,
  GUEST_CART_KEY,
  LEGACY_CART_KEYS,
  cleanLegacyCarts,
} from "../src/lib/cart-store";

// Mock minimal browser storage environment for testing client-side store logic
class MockStorage {
  private store: Map<string, string> = new Map();
  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  clear(): void {
    this.store.clear();
  }
  get size(): number {
    return this.store.size;
  }
}

const mockLocalStorage = new MockStorage();
const mockSessionStorage = new MockStorage();

(globalThis as unknown as { window: unknown }).window = {
  localStorage: mockLocalStorage,
  sessionStorage: mockSessionStorage,
  dispatchEvent: () => true,
  addEventListener: () => {},
  removeEventListener: () => {},
};

beforeEach(() => {
  mockLocalStorage.clear();
  mockSessionStorage.clear();
  setActiveCartUserId(null);
});

test("Cart parser validates items, filters corrupted rows and clamps quantities", () => {
  assert.deepEqual(parseCartItems(null), []);
  assert.deepEqual(parseCartItems(""), []);
  assert.deepEqual(parseCartItems("not-json"), []);
  assert.deepEqual(parseCartItems("{}"), []);
  assert.deepEqual(
    parseCartItems(
      JSON.stringify([
        { variantId: "v1", quantity: 2 },
        { variantId: "v2", quantity: -1 },
        { variantId: "v3", quantity: 50 },
        { variantId: "", quantity: 3 },
        { invalid: true },
      ]),
    ),
    [
      { variantId: "v1", quantity: 2 },
      { variantId: "v3", quantity: 20 },
    ],
  );
});

test("Cart merger combines items and clamps quantity to maximum limit of 20", () => {
  const existing = [
    { variantId: "racket-1", quantity: 2 },
    { variantId: "balls-1", quantity: 15 },
  ];
  const incoming = [
    { variantId: "balls-1", quantity: 10 },
    { variantId: "grip-1", quantity: 3 },
  ];
  const merged = mergeCartItems(existing, incoming);
  assert.deepEqual(merged, [
    { variantId: "racket-1", quantity: 2 },
    { variantId: "balls-1", quantity: 20 }, // clamped to 20
    { variantId: "grip-1", quantity: 3 },
  ]);
});

test("Cart key resolution distinguishes guest and authenticated users", () => {
  setActiveCartUserId(null);
  assert.equal(getActiveCartKey(), GUEST_CART_KEY);

  setActiveCartUserId("user-alice");
  assert.equal(getActiveCartKey(), userCartKey("user-alice"));

  setActiveCartUserId(null);
  assert.equal(getActiveCartKey(), GUEST_CART_KEY);
});

test("Guest cart merges into user cart on sign-in and guest cart is emptied", () => {
  setActiveCartUserId(null);
  // Guest adds items
  mockLocalStorage.setItem(
    GUEST_CART_KEY,
    JSON.stringify([{ variantId: "guest-item-1", quantity: 2 }]),
  );

  // User signs in
  setActiveCartUserId("user-bob");
  assert.equal(getActiveCartKey(), userCartKey("user-bob"));

  // Guest cart must be cleared
  assert.equal(mockLocalStorage.getItem(GUEST_CART_KEY), null);

  // User cart must contain merged item
  const userItems = parseCartItems(mockLocalStorage.getItem(userCartKey("user-bob")));
  assert.deepEqual(userItems, [{ variantId: "guest-item-1", quantity: 2 }]);
});

test("Sign-out isolates carts so unauthenticated visitors never see previous user items", () => {
  // Alice logs in and adds items to her cart
  setActiveCartUserId("user-alice");
  mockLocalStorage.setItem(
    userCartKey("user-alice"),
    JSON.stringify([{ variantId: "alice-racket", quantity: 1 }]),
  );

  // Alice signs out
  setActiveCartUserId(null);

  // Active key is now guest key
  assert.equal(getActiveCartKey(), GUEST_CART_KEY);

  // Guest cart is empty
  const guestCart = mockLocalStorage.getItem(GUEST_CART_KEY);
  assert.equal(guestCart, null);

  // Bob logs in
  setActiveCartUserId("user-bob");
  assert.equal(getActiveCartKey(), userCartKey("user-bob"));
  // Bob does not see Alice's items
  assert.equal(mockLocalStorage.getItem(userCartKey("user-bob")), null);

  // Alice logs back in
  setActiveCartUserId("user-alice");
  const aliceCart = parseCartItems(mockLocalStorage.getItem(userCartKey("user-alice")));
  assert.deepEqual(aliceCart, [{ variantId: "alice-racket", quantity: 1 }]);
});

test("Legacy contaminated cart keys are wiped on cleanup", () => {
  for (const legacyKey of LEGACY_CART_KEYS) {
    mockLocalStorage.setItem(legacyKey, JSON.stringify([{ variantId: "old", quantity: 1 }]));
  }
  cleanLegacyCarts();
  for (const legacyKey of LEGACY_CART_KEYS) {
    assert.equal(mockLocalStorage.getItem(legacyKey), null);
  }
});
