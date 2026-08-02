type SessionLike = {
  access_token?: string | null;
  expires_at?: number | null;
} | null | undefined;

type StoredSession = {
  token: string;
  expiresAt: number;
};

let accessToken = "";
let expiresAt = 0;

function decodeJwtExpiry(token: string) {
  try {
    const payload = token.split(".")[1];
    if (!payload || typeof globalThis.atob !== "function") return 0;
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const parsed = JSON.parse(globalThis.atob(padded)) as { exp?: unknown };
    const expiry = Number(parsed.exp || 0);
    return Number.isFinite(expiry) ? expiry : 0;
  } catch {
    return 0;
  }
}

function findStoredSession(value: unknown, depth = 0): StoredSession | null {
  if (depth > 12 || value === null || value === undefined) return null;

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findStoredSession(item, depth + 1);
      if (found) return found;
    }
    return null;
  }

  if (typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const token = String(record.access_token || record.accessToken || "").trim();
  if (token) {
    const storedExpiry = Number(record.expires_at || record.expiresAt || 0);
    return {
      token,
      expiresAt: Number.isFinite(storedExpiry) && storedExpiry > 0
        ? storedExpiry
        : decodeJwtExpiry(token),
    };
  }

  for (const nested of Object.values(record)) {
    const found = findStoredSession(nested, depth + 1);
    if (found) return found;
  }
  return null;
}

function readPersistedSupabaseSession() {
  if (typeof window === "undefined") return null;
  try {
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index) || "";
      if (!key.startsWith("sb-") || !key.endsWith("-auth-token")) continue;
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      const found = findStoredSession(JSON.parse(raw));
      if (found) return found;
    }
  } catch {
    // The in-memory auth callback remains the primary source. Storage parsing
    // is only a compatibility fallback for a newly mounted mobile context.
  }
  return null;
}

function tokenIsUsable(token: string, tokenExpiresAt: number) {
  if (!token) return false;
  if (!tokenExpiresAt) return true;
  return tokenExpiresAt * 1000 > Date.now() + 30_000;
}

export function cacheAuthenticatedAccessToken(session: SessionLike) {
  const nextToken = String(session?.access_token || "").trim();
  if (!nextToken) return;
  accessToken = nextToken;
  expiresAt = Number(session?.expires_at || 0) || decodeJwtExpiry(nextToken);
}

export function clearAuthenticatedAccessToken() {
  accessToken = "";
  expiresAt = 0;
}

export function getCachedAuthenticatedAccessToken() {
  if (tokenIsUsable(accessToken, expiresAt)) return accessToken;
  clearAuthenticatedAccessToken();

  const persisted = readPersistedSupabaseSession();
  if (!persisted || !tokenIsUsable(persisted.token, persisted.expiresAt)) return "";
  accessToken = persisted.token;
  expiresAt = persisted.expiresAt;
  return accessToken;
}
