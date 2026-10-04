"use client";
import { useEffect, useState } from "react";
import { X } from "lucide-react";
export function notify(message: string, error = false) {
  window.dispatchEvent(new CustomEvent("club-notice", { detail: { message, error } }));
}
export function ActionNotice() {
  const [notice, setNotice] = useState<{message: string; error: boolean} | null>(null);
  useEffect(() => {
    const listener = (event: Event) => setNotice((event as CustomEvent).detail);
    window.addEventListener("club-notice", listener);
    return () => window.removeEventListener("club-notice", listener);
  }, []);
  return notice && <div role={notice.error ? "alert" : "status"} className={`fixed left-4 right-4 top-5 z-[100] mx-auto flex max-w-xl items-start gap-4 rounded-xl border bg-white p-5 text-base text-neutral-950 shadow-xl ${notice.error ? "border-red-500" : "border-orange-500"}`}><p className="flex-1">{notice.message}</p><button aria-label="Dismiss notification" className="rounded p-1 hover:bg-neutral-100" onClick={() => setNotice(null)}><X size={20}/></button></div>;
}
