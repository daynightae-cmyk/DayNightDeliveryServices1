type LimitWindow = "day" | "hour";

function windowKey(windowType: LimitWindow) {
  const now = new Date();
  if (windowType === "day") {
    return `${now.getUTCFullYear()}-${now.getUTCMonth() + 1}-${now.getUTCDate()}`;
  }
  return `${now.getUTCFullYear()}-${now.getUTCMonth() + 1}-${now.getUTCDate()}-${now.getUTCHours()}`;
}

function readCount(key: string) {
  try {
    const value = localStorage.getItem(key);
    return value ? Number(value) : 0;
  } catch {
    return 0;
  }
}

function writeCount(key: string, value: number) {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    // Ignore storage write errors.
  }
}

function applyLimit(baseKey: string, max: number, windowType: LimitWindow) {
  const key = `${baseKey}:${windowKey(windowType)}`;
  const current = readCount(key);
  if (current >= max) {
    return { allowed: false, remaining: 0 };
  }
  writeCount(key, current + 1);
  return { allowed: true, remaining: Math.max(0, max - current - 1) };
}

export function canSubmitDeliveryRequest() {
  return applyLimit("dn:request", 5, "day");
}

export function canRetryTracking() {
  return applyLimit("dn:tracking_failed", 10, "hour");
}

export function secureHeaders() {
  return {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "SAMEORIGIN",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "geolocation=(), microphone=(), camera=()",
    "Content-Security-Policy": "default-src 'self' https: data: blob:; img-src 'self' https: data: blob:; style-src 'self' 'unsafe-inline' https:; script-src 'self' 'unsafe-inline' https:; connect-src 'self' https: wss:; frame-ancestors 'self'; base-uri 'self'; form-action 'self'",
    "X-Powered-By": ""
  };
}
