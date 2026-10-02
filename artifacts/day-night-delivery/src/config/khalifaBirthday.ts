export type BirthdayStepVariant =
  | "lead"
  | "hero"
  | "emotional"
  | "brand"
  | "playful";

export type BirthdayStep = {
  id: string;
  text: string;
  holdMs: number;
  variant: BirthdayStepVariant;
  confetti?: boolean;
};

export type BirthdayDecorMode = "intro" | "normal" | "quiet" | "light";

export type BirthdayCounts = {
  balloons: number;
  bubbles: number;
  particles: number;
};

export type BirthdayBalloon = {
  side: "left" | "right";
  edge: number;
  top: number;
  size: number;
  tone: "gold" | "navy" | "pearl" | "champagne";
  duration: number;
  delay: number;
};

const storySteps: BirthdayStep[] = [
  { id: "s1", text: "اليوم مش يوم عادي في Day Night...", holdMs: 850, variant: "lead" },
  { id: "s2", text: "النهارده عيد ميلاد خليفة", holdMs: 750, variant: "lead" },
  { id: "s3", text: "خليفة", holdMs: 2400, variant: "hero" },
  { id: "s4", text: "أول عيد ميلاد لخليفة مع عائلة Day Night", holdMs: 950, variant: "lead" },
  { id: "s5", text: "كل سنة وإنت منور دنيتنا يا خليفة", holdMs: 1100, variant: "emotional", confetti: true },
  { id: "s6", text: "من عائلة داي نايت لخدمات التوصيل والشحن", holdMs: 750, variant: "brand" },
  { id: "s7", text: "يلا يا بلد... مجبتش خليفة غيري 😎", holdMs: 650, variant: "playful" },
];

const reducedSteps: BirthdayStep[] = [
  { id: "r1", text: "النهارده عيد ميلاد خليفة", holdMs: 650, variant: "lead" },
  { id: "r2", text: "خليفة", holdMs: 1200, variant: "hero" },
  { id: "r3", text: "أول عيد ميلاد لخليفة مع عائلة Day Night", holdMs: 700, variant: "lead" },
  { id: "r4", text: "كل سنة وإنت منور دنيتنا يا خليفة", holdMs: 850, variant: "emotional" },
];

const balloons: BirthdayBalloon[] = [
  { side: "left", edge: 2, top: 12, size: 58, tone: "gold", duration: 7.3, delay: 0 },
  { side: "right", edge: 2, top: 18, size: 54, tone: "navy", duration: 8.1, delay: 0.35 },
  { side: "left", edge: 4, top: 48, size: 48, tone: "pearl", duration: 9.2, delay: 0.85 },
  { side: "right", edge: 4, top: 52, size: 50, tone: "champagne", duration: 7.8, delay: 0.55 },
  { side: "left", edge: 1, top: 31, size: 43, tone: "navy", duration: 8.6, delay: 1.1 },
  { side: "right", edge: 1, top: 35, size: 46, tone: "gold", duration: 9.4, delay: 0.95 },
];

export const khalifaBirthdayConfig = {
  enabled: true,
  startDate: "2026-10-02",
  endDate: null as string | null,
  storageKey: "daynight_khalifa_birthday_seen",
  autoStartDelayMs: 500,
  fadeInMs: 360,
  fadeOutMs: 240,
  exitFadeMs: 560,
  steps: storySteps,
  reduced: {
    fadeInMs: 260,
    fadeOutMs: 180,
    steps: reducedSteps,
  },
  hero: {
    subtitle1: "ظبي الإمارات الصغير",
    subtitle2: "ولي عهد Day Night",
    badge: "FIRST BIRTHDAY · 01",
    formMs: 1500,
    maxParticles: { desktop: 360, mobile: 210 },
    particleColors: ["#D4AF37", "#F4D06F", "#FFFFFF"],
  },
  confetti: {
    desktop: 54,
    mobile: 28,
    durationMs: 2300,
    colors: ["#D4AF37", "#F4D06F", "#FFFFFF", "#14306B"],
  },
  lights: { desktop: 20, mobile: 10, stepMs: 90 },
  balloons,
  density: {
    desktop: {
      intro: { balloons: 6, bubbles: 8, particles: 24 },
      normal: { balloons: 4, bubbles: 4, particles: 12 },
      quiet: { balloons: 2, bubbles: 0, particles: 5 },
      light: { balloons: 1, bubbles: 0, particles: 3 },
    },
    mobile: {
      intro: { balloons: 4, bubbles: 4, particles: 12 },
      normal: { balloons: 2, bubbles: 2, particles: 6 },
      quiet: { balloons: 1, bubbles: 0, particles: 2 },
      light: { balloons: 1, bubbles: 0, particles: 0 },
    },
  } as Record<"desktop" | "mobile", Record<BirthdayDecorMode, BirthdayCounts>>,
};

function uaeDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Dubai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value ?? "";
  const month = parts.find((part) => part.type === "month")?.value ?? "";
  const day = parts.find((part) => part.type === "day")?.value ?? "";
  return year && month && day ? year + "-" + month + "-" + day : "";
}

export function isKhalifaBirthdayCampaignActive(date = new Date()) {
  if (!khalifaBirthdayConfig.enabled) return false;
  const today = uaeDateKey(date);
  if (!today) return true;
  if (today < khalifaBirthdayConfig.startDate) return false;
  if (khalifaBirthdayConfig.endDate && today > khalifaBirthdayConfig.endDate) return false;
  return true;
}

export function getKhalifaAmbientMode(pathname: string): Exclude<BirthdayDecorMode, "intro"> {
  const path = (pathname || "/").toLowerCase();
  if (/(^|\/)(admin|auth|login)(\/|$)/.test(path)) return "light";
  if (/(^|\/)tracking(\/|$)/.test(path)) return "quiet";
  return "normal";
}
