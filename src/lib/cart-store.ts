export type CartItem = {
  variantId: string;
  quantity: number;
};

export const GUEST_CART_KEY = "champions-cart:guest";
export const LEGACY_CART_KEYS = ["champions-cart-v2", "champions-cart"] as const;

let activeUserId: string | null = null;

export function userCartKey(userId: string): string {
  return `champions-cart:user:${userId}`;
}

export function parseCartItems(raw: string | null | undefined): CartItem[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is CartItem =>
        Boolean(
          item &&
            typeof item === "object" &&
            typeof (item as CartItem).variantId === "string" &&
            (item as CartItem).variantId.trim().length > 0 &&
            Number.isInteger((item as CartItem).quantity) &&
            (item as CartItem).quantity > 0,
        ),
    ).map((item) => ({
      variantId: item.variantId,
      quantity: Math.min(20, Math.max(1, item.quantity)),
    }));
  } catch {
    return [];
  }
}

export function mergeCartItems(
  existing: CartItem[],
  incoming: CartItem[],
): CartItem[] {
  const map = new Map<string, number>();
  for (const item of existing) {
    map.set(item.variantId, item.quantity);
  }
  for (const item of incoming) {
    const current = map.get(item.variantId) || 0;
    map.set(item.variantId, Math.min(20, current + item.quantity));
  }
  return Array.from(map.entries()).map(([variantId, quantity]) => ({
    variantId,
    quantity,
  }));
}

export function cleanLegacyCarts(): void {
  if (typeof window === "undefined") return;
  try {
    for (const key of LEGACY_CART_KEYS) {
      window.localStorage.removeItem(key);
    }
  } catch {
    /* LocalStorage access might be restricted */
  }
}

export function getActiveCartKey(): string {
  if (typeof window === "undefined") return GUEST_CART_KEY;
  cleanLegacyCarts();
  let id = activeUserId;
  if (!id) {
    try {
      id = window.sessionStorage.getItem("champions-active-user-id");
    } catch {
      id = null;
    }
  }
  return id ? userCartKey(id) : GUEST_CART_KEY;
}

export function setActiveCartUserId(userId: string | null | undefined): void {
  const nextId = userId && userId.trim() ? userId.trim() : null;
  activeUserId = nextId;

  if (typeof window === "undefined") return;

  cleanLegacyCarts();

  try {
    if (nextId) {
      window.sessionStorage.setItem("champions-active-user-id", nextId);
      // If there are guest items, merge into user cart and clear guest cart
      const guestRaw = window.localStorage.getItem(GUEST_CART_KEY);
      const guestItems = parseCartItems(guestRaw);
      if (guestItems.length > 0) {
        const uKey = userCartKey(nextId);
        const userItems = parseCartItems(window.localStorage.getItem(uKey));
        const merged = mergeCartItems(userItems, guestItems);
        window.localStorage.setItem(uKey, JSON.stringify(merged));
        window.localStorage.removeItem(GUEST_CART_KEY);
      }
    } else {
      window.sessionStorage.removeItem("champions-active-user-id");
      // Explicitly clear guest cart and legacy cart on logout so subsequent unauthenticated visits are clean
      window.localStorage.removeItem(GUEST_CART_KEY);
      for (const key of LEGACY_CART_KEYS) {
        window.localStorage.removeItem(key);
      }
    }
  } catch {
    /* Storage quota or restriction */
  }

  window.dispatchEvent(new Event("club-cart"));
}

export function readActiveCart(): CartItem[] {
  if (typeof window === "undefined") return [];
  cleanLegacyCarts();
  try {
    const key = getActiveCartKey();
    return parseCartItems(window.localStorage.getItem(key));
  } catch {
    return [];
  }
}

export function writeActiveCart(items: CartItem[]): void {
  if (typeof window === "undefined") return;
  cleanLegacyCarts();
  try {
    const key = getActiveCartKey();
    const valid = items
      .filter((i) => i.quantity > 0)
      .map((i) => ({ ...i, quantity: Math.min(20, i.quantity) }));
    if (valid.length === 0) {
      window.localStorage.removeItem(key);
    } else {
      window.localStorage.setItem(key, JSON.stringify(valid));
    }
  } catch {
    /* LocalStorage full */
  }
  window.dispatchEvent(new Event("club-cart"));
}

export function clearActiveCart(): void {
  if (typeof window === "undefined") return;
  cleanLegacyCarts();
  try {
    const key = getActiveCartKey();
    window.localStorage.removeItem(key);
  } catch {
    /* Ignore */
  }
  window.dispatchEvent(new Event("club-cart"));
}

export function addCartItem(variantId: string, quantity = 1): void {
  const current = readActiveCart();
  const existing = current.find((i) => i.variantId === variantId);
  if (existing) {
    existing.quantity = Math.min(20, existing.quantity + quantity);
  } else {
    current.push({ variantId, quantity: Math.min(20, Math.max(1, quantity)) });
  }
  writeActiveCart(current);
}
