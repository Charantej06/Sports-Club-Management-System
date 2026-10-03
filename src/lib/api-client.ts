"use client";
export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  if (typeof navigator !== "undefined" && !navigator.onLine && init?.method && init.method !== "GET") throw new Error("Reconnect before submitting. No reservation, stock or payment was confirmed.");
  const response = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error?.message || "Unable to complete this request.");
  return body.data as T;
}
