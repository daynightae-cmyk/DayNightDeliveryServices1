type SessionLike = {
  access_token?: string | null;
  expires_at?: number | null;
} | null | undefined;

let accessToken = "";
let expiresAt = 0;

export function cacheAuthenticatedAccessToken(session: SessionLike) {
  const nextToken = String(session?.access_token || "").trim();
  if (!nextToken) return;
  accessToken = nextToken;
  expiresAt = Number(session?.expires_at || 0) || 0;
}

export function clearAuthenticatedAccessToken() {
  accessToken = "";
  expiresAt = 0;
}

export function getCachedAuthenticatedAccessToken() {
  if (!accessToken) return "";
  if (expiresAt && expiresAt * 1000 <= Date.now() + 30_000) {
    clearAuthenticatedAccessToken();
    return "";
  }
  return accessToken;
}
