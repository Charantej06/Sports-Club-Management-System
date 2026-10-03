import "dotenv/config";
import { processNextJob } from "@/modules/mail/worker";
import { db } from "@/lib/db";
let stopped = false;
process.on("SIGINT", () => { stopped = true; });
process.on("SIGTERM", () => { stopped = true; });
console.log("Champions worker started.");
while (!stopped) {
  try { if (!await processNextJob()) await new Promise(resolve => setTimeout(resolve, 2000)); }
  catch { console.error("Worker database unavailable; retrying."); await new Promise(resolve => setTimeout(resolve, 5000)); }
}
await db.$disconnect();
