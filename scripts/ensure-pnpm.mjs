const userAgent = String(process.env.npm_config_user_agent || "").toLowerCase();

if (!userAgent.startsWith("pnpm/")) {
  console.error("Use pnpm instead of npm or yarn for this workspace.");
  process.exit(1);
}
