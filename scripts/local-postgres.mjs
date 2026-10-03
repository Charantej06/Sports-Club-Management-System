// An isolated persistent cluster; the system PostgreSQL instance is never modified.
import "dotenv/config";
import { existsSync, mkdirSync, writeFileSync, unlinkSync } from "node:fs";
import { resolve, join } from "node:path";
import { spawnSync } from "node:child_process";
const bin = process.env.PG_BIN || (process.platform === "win32" ? "C:/Program Files/PostgreSQL/18/bin" : "/usr/lib/postgresql/18/bin");
const root = resolve(".local");
const data = join(root, "postgres");
const url = new URL(process.env.DATABASE_URL);
if (!["127.0.0.1", "localhost"].includes(url.hostname) || url.port !== "5433") throw new Error("db:local only supports the isolated loopback cluster on port 5433.");
mkdirSync(root, { recursive: true });
function run(program, args) {
  const result = spawnSync(join(bin, program), args, { stdio: "inherit", windowsHide: true });
  if (result.error) throw result.error;
  return result.status;
}
if (!existsSync(join(data, "PG_VERSION"))) {
  const passfile = join(root, "pg-init-password");
  writeFileSync(passfile, decodeURIComponent(url.password));
  try {
    if (run("initdb", ["-D", data, "-U", url.username, "--pwfile", passfile, "--auth=scram-sha-256", "--encoding=UTF8", "--locale=C"]) !== 0) process.exit(1);
  } finally { unlinkSync(passfile); }
}
if (process.argv.includes("--stop")) process.exit(run("pg_ctl", ["-D", data, "stop", "-m", "fast"]));
if (run("pg_ctl", ["-D", data, "status"]) !== 0) {
  if (run("pg_ctl", ["-D", data, "-l", join(root, "postgres.log"), "-o", "-p 5433 -h 127.0.0.1", "-w", "start"]) !== 0) process.exit(1);
}
const { Client } = await import("pg");
const client = new Client({ connectionString: process.env.DATABASE_URL.replace(/\/[^/]+$/, "/postgres") });
await client.connect();
const name = url.pathname.slice(1);
if (!/^[a-z_][a-z0-9_]*$/.test(name)) throw new Error("Unsafe database name");
const exists = await client.query("SELECT 1 FROM pg_database WHERE datname=$1", [name]);
if (!exists.rowCount) await client.query(`CREATE DATABASE "${name}"`);
await client.end();
console.log("Persistent PostgreSQL is ready on 127.0.0.1:5433.");
