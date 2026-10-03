import "dotenv/config";
import { processNextJob } from "@/modules/mail/worker";
import { db } from "@/lib/db";
import { synchronizeReminders } from "@/modules/mail/reminders";
let lastSync = 0;
let stopped = false;
process.on("SIGINT", () => { stopped = true; });
process.on("SIGTERM", () => { stopped = true; });
console.log("Champions worker started.");
while (!stopped) {
  try { if (Date.now() - lastSync > 60000) { await synchronizeReminders(); lastSync = Date.now(); } if (!await processNextJob()) await new Promise(resolve => setTimeout(resolve, 2000)); }
  catch { console.error("Worker database unavailable; retrying."); await new Promise(resolve => setTimeout(resolve, 5000)); }
}
await db.$disconnect();
