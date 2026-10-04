// Runs the web app and the background worker together so emails, hold expiries and reminders always work.
//   node scripts/run-all.mjs dev    -> development server + worker
//   node scripts/run-all.mjs start  -> production server (after npm run build) + worker
import { spawn } from "node:child_process";
const mode = process.argv[2] === "start" ? "start" : "dev";
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const children = [spawn(npm, ["run", mode], { stdio: "inherit" }), spawn(npm, ["run", "worker"], { stdio: "inherit" })];
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill("SIGTERM");
  setTimeout(() => process.exit(code), 1500).unref();
}
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => stop(0));
for (const child of children) child.on("exit", (code) => stop(code ?? 0));
console.log(`\nChampions Club is starting in ${mode} mode with the worker. Press Ctrl+C to stop both.\n`);
