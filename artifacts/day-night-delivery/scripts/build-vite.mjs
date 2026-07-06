import { spawnSync } from "node:child_process";

process.env.BASE_PATH ||= "/";
process.env.PORT ||= "3000";

await import("./install-local-assets.mjs");

const pnpmBin = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

const result = spawnSync(
  pnpmBin,
  ["exec", "vite", "build", "--config", "vite.config.ts"],
  {
    stdio: "inherit",
    env: process.env,
    shell: process.platform === "win32",
  }
);

if (result.error) {
  console.error(result.error);
  process.exit(1);
}

process.exit(result.status ?? 1);
