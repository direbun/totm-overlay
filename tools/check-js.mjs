import { readdirSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const files = [
  "scripts/totm-overlay.mjs",
  "scripts/totm-overlay.runtime.mjs",
  ...readdirSync("scripts/modules")
    .filter(file => file.endsWith(".mjs"))
    .map(file => join("scripts/modules", file))
];

let failed = false;
for (const file of files) {
  const result = spawnSync(process.execPath, ["--check", file], { stdio: "inherit" });
  if (result.status !== 0) failed = true;
}

if (failed) process.exit(1);
