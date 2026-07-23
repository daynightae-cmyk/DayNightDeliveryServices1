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
  "supabase/migrations/20260723143000_customer_experience_pgcrypto_runtime_hotfix.sql",
  "supabase/migrations/20260723143500_customer_experience_notification_enum_lint_hotfix.sql",
  "supabase/tests/customer_experience_verify.sql",
];

function run(binary, args, options = {}) {
  return spawnSync(binary, args, {
    cwd: repositoryRoot,
    encoding: "utf8",
    stdio: options.input ? ["pipe", "pipe", "pipe"] : "pipe",
    input: options.input,
    env: process.env,
    timeout: options.timeout || 120_000,
  });
}

function command(binary, args, options = {}) {
  const result = run(binary, args, options);
  if (result.status !== 0) {
    const output = `${result.stdout || ""}\n${result.stderr || ""}`.trim();
    throw new Error(`${binary} ${args.join(" ")} failed (${result.status}):\n${output}`);
  }
  return String(result.stdout || "").trim();
}

function dockerAvailable() {
  const probe = run("docker", ["version", "--format", "{{.Server.Version}}"], { timeout: 20_000 });
  return probe.status === 0;
}

function stopContainer() {
  run("docker", ["rm", "-f", containerName], { timeout: 20_000 });
}

function containerLogs() {
  const result = run("docker", ["logs", containerName], { timeout: 20_000 });
  return `${result.stdout || ""}\n${result.stderr || ""}`;
}

async function waitForFinalPostgresStartup() {
  let consecutiveReadyChecks = 0;
  let lastLogs = "";

  for (let attempt = 1; attempt <= 120; attempt += 1) {
    lastLogs = containerLogs();
    const initializationCompleted = lastLogs.includes("PostgreSQL init process complete; ready for start up.");
    const ready = run("docker", ["exec", containerName, "pg_isready", "-U", "postgres", "-d", "daynight"], {
      timeout: 10_000,
    });

    if (initializationCompleted && ready.status === 0) {
      consecutiveReadyChecks += 1;
      if (consecutiveReadyChecks >= 3) return;
    } else {
      consecutiveReadyChecks = 0;
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw new Error(`PostgreSQL 17 container did not reach stable final startup.\n${lastLogs}`);
}

async function applySql(relative, sql) {
  let lastFailure = "";
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    const result = run("docker", [
      "exec", "-i", containerName,
      "psql", "-U", "postgres", "-d", "daynight", "-v", "ON_ERROR_STOP=1",
    ], { input: sql, timeout: 180_000 });

    if (result.status === 0) return String(result.stdout || "").trim();

    lastFailure = `${result.stdout || ""}\n${result.stderr || ""}`.trim();
    const transientStartupFailure = /database system is (starting up|shutting down)|connection.*failed/i.test(lastFailure);
    if (!transientStartupFailure || attempt === 4) break;

    console.warn(`Transient PostgreSQL startup state while applying ${relative}; retrying (${attempt}/4).`);
    await waitForFinalPostgresStartup();
  }

  throw new Error(`psql failed while applying ${relative}:\n${lastFailure}\n\nContainer logs:\n${containerLogs()}`);
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
    "--shm-size", "256m",
    "-e", "POSTGRES_PASSWORD=postgres",
    "-e", "POSTGRES_DB=daynight",
    "postgres:17-alpine",
  ], { timeout: 180_000 });

  await waitForFinalPostgresStartup();

  for (const relative of files) {
    const absolute = path.join(repositoryRoot, relative);
    if (!fs.existsSync(absolute)) throw new Error(`Missing SQL gate input: ${relative}`);
    console.log(`Applying ${relative}`);
    const sql = fs.readFileSync(absolute, "utf8");
    const output = await applySql(relative, sql);
    if (output) console.log(output);
  }

  console.log("DAY NIGHT Customer Experience PostgreSQL 17 gate: PASS\n");
} finally {
  stopContainer();
}
