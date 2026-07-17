const ROUTE_LOAD_RELOAD_KEY = "dn_route_load_recovery";
const ROUTE_LOAD_RECOVERY_WINDOW_MS = 120_000;

const RECOVERABLE_ROUTE_LOAD_PATTERNS = [
  "Failed to fetch dynamically imported module",
  "Importing a module script failed",
  "Loading chunk",
  "ChunkLoadError",
  "dynamically imported module",
  "Unable to preload CSS",
  "module script failed",
];

function errorMessage(error: unknown): string {
  if (!error) return "";
  if (error instanceof Error) return `${error.name} ${error.message}`;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

export function isRecoverableRouteLoadError(error: unknown): boolean {
  const message = errorMessage(error);
  return RECOVERABLE_ROUTE_LOAD_PATTERNS.some((pattern) => message.toLowerCase().includes(pattern.toLowerCase()));
}

export function recoverRouteLoadFailure(): boolean {
  if (typeof window === "undefined") return false;

  const key = `${ROUTE_LOAD_RELOAD_KEY}:${window.location.pathname}`;
  const lastAttempt = Number(window.sessionStorage.getItem(key) || "0");
  const now = Date.now();

  if (Number.isFinite(lastAttempt) && now - lastAttempt < ROUTE_LOAD_RECOVERY_WINDOW_MS) {
    return false;
  }

  window.sessionStorage.setItem(key, String(now));
  window.location.reload();
  return true;
}
