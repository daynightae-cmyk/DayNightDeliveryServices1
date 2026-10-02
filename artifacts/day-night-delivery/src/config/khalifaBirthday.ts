export const khalifaBirthdayConfig = {
  enabled: true,
  startDate: "2026-10-02",
  endDate: null as string | null,
  storageKey: "daynight_khalifa_birthday_seen",
  autoStartDelayMs: 450,
  introDurationMs: 12500,
  reducedDurationMs: 5500,
};

export function isKhalifaBirthdayCampaignActive(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Dubai", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const part = (type: string) => parts.find(p => p.type === type)?.value;
  const date = `${part("year")}-${part("month")}-${part("day")}`;
  const c = khalifaBirthdayConfig;
  return c.enabled && date >= c.startDate && (!c.endDate || date <= c.endDate);
}

export function getKhalifaAmbientMode(path: string) {
  if (/^\/(auth|admin|driver|merchant|customer|update-password)(\/|$)/.test(path)) return "minimal";
  return /^\/tracking(\/|$)/.test(path) ? "quiet" : "public";
}
