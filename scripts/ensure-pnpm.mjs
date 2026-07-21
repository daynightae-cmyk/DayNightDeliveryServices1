const userAgent = String(process.env.npm_config_user_agent || "").toLowerCase();

// Some CI lifecycle runners omit npm_config_user_agent during workspace
// preinstall. Reject an explicitly detected npm/yarn client, but do not fail
// a pnpm-driven install merely because the lifecycle environment is incomplete.
if (userAgent && !userAgent.includes("pnpm/")) {
  console.error("Use pnpm instead of npm or yarn for this workspace.");
  process.exit(1);
}
