"use client";
import {
  createContext,
  useContext,
  useSyncExternalStore,
  type SetStateAction,
} from "react";
const DraftUser = createContext("");
export function DraftScope({
  userId,
  children,
}: {
  userId: string;
  children: React.ReactNode;
}) {
  return <DraftUser.Provider value={userId}>{children}</DraftUser.Provider>;
}
const empty = "[]";
function subscribe(listener: () => void) {
  window.addEventListener("storage", listener);
  window.addEventListener("club-draft", listener);
  return () => {
    window.removeEventListener("storage", listener);
    window.removeEventListener("club-draft", listener);
  };
}
export function useItemDraft<T extends { quantity: number }>(
  name: string,
): [T[], (value: SetStateAction<T[]>) => void] {
  const userId = useContext(DraftUser),
    key = `champions-draft:${userId}:${name}`;
  const raw = useSyncExternalStore(
    subscribe,
    () => {
      try {
        return localStorage.getItem(key) || empty;
      } catch {
        return empty;
      }
    },
    () => empty,
  );
  let items: T[] = [];
  try {
    const value: unknown = JSON.parse(raw);
    if (
      Array.isArray(value) &&
      value.length <= 100 &&
      value.every(
        (i) =>
          i &&
          typeof i === "object" &&
          Number.isInteger(i.quantity) &&
          i.quantity > 0 &&
          i.quantity <= 30,
      )
    )
      items = value as T[];
  } catch {
    /* A corrupt draft never blocks operations. */
  }
  return [
    items,
    (value) => {
      const next = typeof value === "function" ? value(items) : value;
      if (userId) {
        try {
          localStorage.setItem(key, JSON.stringify(next));
        } catch {
          /* Server confirmation remains available if local storage is full. */
        }
      }
      window.dispatchEvent(new Event("club-draft"));
    },
  ];
}
function networkSubscribe(listener: () => void) {
  window.addEventListener("online", listener);
  window.addEventListener("offline", listener);
  return () => {
    window.removeEventListener("online", listener);
    window.removeEventListener("offline", listener);
  };
}
export function NetworkNotice() {
  const online = useSyncExternalStore(
    networkSubscribe,
    () => navigator.onLine,
    () => true,
  );
  return !online ? (
    <p role="status" className="notice mb-5">
      Disconnected. Cart and counter/POS item drafts stay on this device.
      Reconnect and review the table or customer before submitting. Bookings,
      stock, kitchen submissions and payments require server validation.
    </p>
  ) : null;
}
