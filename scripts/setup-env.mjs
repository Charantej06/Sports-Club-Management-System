import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
if (!existsSync(".env")) {
  writeFileSync(".env", readFileSync(".env.example", "utf8").replace("replace-with-at-least-32-random-characters", randomBytes(48).toString("hex")));
  console.log("Created local .env with a random auth secret.");
} else console.log("Existing .env preserved.");
