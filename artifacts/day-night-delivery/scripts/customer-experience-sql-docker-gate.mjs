import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";

const projectRoot = process.cwd();
const repositoryRoot = path.resolve(projectRoot, "../..");
const containerName = `daynight-cx-postgres-${process.pid}`;
const files = [
  "supabase/tests/customer_experience_bootstrap.sql",
  "supabase/migrations/20260723140000_smart_whatsapp_feedback_complaints.sql",
  "supabase/migrations/20260723140500_customer_experience_runtime_health.sql",
  "supabase/migrations/20260723141000_customer_experience_privacy_actions.sql",
  "supabase/migrations/20260723141500_customer_experience_rls_storage_hardening.sql",
  "supabase/migrations/20260723142000_customer_experience_pii_hash_hardening.sql",
  "supabase/migrations/20260723142500_customer_experience_request_header_hotfix.sql",
  "supabase/tests/customer_experience_verify.sql",
];

function command(binary, args, options = {}) {
  const result = spawnSync(binary, args, {
    cwd: repositoryRoot,
    encoding: "utf8",
    stdio: options.input ? ["pipe", "pipe", "pipe"] : "pipe",
    input: options.input,
    env: process.env,
    timeout: options.timeout || 120_000,
  });
  if (result.status !== 0) {
    const output = `${result.stdout || ""}\n${result.stderr || ""}`.trim();
    throw new Error(`${binary} ${args.join(" ")} failed (${result.status}):\n${output}`);
  }
  return String(result.stdout || "").trim();
}

function dockerAvailable() {
  const probe = spawnSync("docker", ["version", "--format", "{{.Server.Version}}"], { encoding: "utf8", timeout: 20_000 });
  return probe.status === 0;
}

function stopContainer() {
  spawnSync("docker", ["rm", "-f", containerName], { encoding: "utf8", timeout: 20_000 });
}

if (!dockerAvailable()) {
  if (process.env.CI) {
    throw new Error("Docker is required in CI to validate Customer Experience PostgreSQL migrations.");
  }
  console.warn("DAY NIGHT Customer Experience SQL Docker gate skipped locally because Docker is unavailable.");
  process.exit(0);
}

try {
  console.log("\n--- DAY NIGHT Customer Experience PostgreSQL 17 gate ---");
  stopContainer();
  command("docker", [
    "run", "-d", "--rm", "--name", containerName,
    "-e", "POSTGRES_PASSWORD=postgres",
    "-e", "POSTGRES_DB=daynight",
    "postgres:17",
  ], { timeout: 180_000 });

  let ready = false;
  for (let attempt = 1; attempt <= 60; attempt += 1) {
    const check = spawnSync("docker", ["exec", containerName, "pg_isready", "-U", "postgres", "-d", "daynight"], {
      encoding: "utf8",
      timeout: 10_000,
    });
    if (check.status === 0) {
      ready = true;
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  if (!ready) throw new Error("PostgreSQL 17 container did not become ready.");

  for (const relative of files) {
    const absolute = path.join(repositoryRoot, relative);
    if (!fs.existsSync(absolute)) throw new Error(`Missing SQL gate input: ${relative}`);
    console.log(`Applying ${relative}`);
    const sql = fs.readFileSync(absolute, "utf8");
    const output = command("docker", [
      "exec", "-i", containerName,
      "psql", "-U", "postgres", "-d", "daynight", "-v", "ON_ERROR_STOP=1",
    ], { input: sql, timeout: 180_000 });
    if (output) console.log(output);
  }

  console.log("DAY NIGHT Customer Experience PostgreSQL 17 gate: PASS\n");
} finally {
  stopContainer();
}
