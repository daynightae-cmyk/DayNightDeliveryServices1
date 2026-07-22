export type Lang = "ar" | "en";

export const LANGUAGE_STORAGE_KEY = "dn_lang_preference";

export const roleMessages = {
  ar: {
    close: "إغلاق",
    signOut: "تسجيل الخروج",
    switchLanguage: "English",
    merchantNavigation: "تنقل بوابة التاجر",
    merchantMenu: "قائمة مركز أعمال التاجر",
    merchantMenuHint: "اختر القسم المطلوب لإدارة نشاطك",
    driverSplashTitle: "داي نايت للمندوب",
    driverSplashSubtitle: "المهام والملاحة المباشرة",
    merchantSplashTitle: "داي نايت للتاجر",
    merchantSplashSubtitle: "مركز إدارة الطلبات والأعمال",
    preparingWorkspace: "جاري تجهيز مساحة العمل الآمنة",
  },
  en: {
    close: "Close",
    signOut: "Sign out",
    switchLanguage: "العربية",
    merchantNavigation: "Merchant portal navigation",
    merchantMenu: "Merchant Business Center menu",
    merchantMenuHint: "Choose a section to manage your business",
    driverSplashTitle: "DAY NIGHT Driver",
    driverSplashSubtitle: "Live missions and navigation",
    merchantSplashTitle: "DAY NIGHT Merchant",
    merchantSplashSubtitle: "Orders and business control center",
    preparingWorkspace: "Preparing your secure workspace",
  },
} as const;

export type RoleMessageKey = keyof (typeof roleMessages)["en"];

function normalizeLanguage(value: unknown): Lang | null {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "ar" || normalized.startsWith("ar-")) return "ar";
  if (normalized === "en" || normalized.startsWith("en-")) return "en";
  return null;
}

export function detectBrowserLanguage(): Lang {
  if (typeof navigator === "undefined") return "ar";
  const candidates = Array.isArray(navigator.languages) && navigator.languages.length
    ? navigator.languages
    : [navigator.language];
  for (const candidate of candidates) {
    const language = normalizeLanguage(candidate);
    if (language) return language;
  }
  return "ar";
}

export function getSavedLanguage(): Lang | null {
  try {
    return normalizeLanguage(localStorage.getItem(LANGUAGE_STORAGE_KEY));
  } catch {
    return null;
  }
}

export function getInitialLanguage(): Lang {
  if (typeof document !== "undefined") {
    const bootstrapped = normalizeLanguage(document.documentElement.dataset.language || document.documentElement.lang);
    if (bootstrapped) return bootstrapped;
  }

  const saved = getSavedLanguage();
  if (saved) return saved;

  if (typeof window !== "undefined") {
    const queryLanguage = normalizeLanguage(new URLSearchParams(window.location.search).get("lang"));
    if (queryLanguage) return queryLanguage;
  }

  return detectBrowserLanguage();
}

export function applyLanguageToDocument(lang: Lang) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.lang = lang;
  root.dir = lang === "ar" ? "rtl" : "ltr";
  root.dataset.language = lang;
  root.classList.toggle("dn-language-ar", lang === "ar");
  root.classList.toggle("dn-language-en", lang === "en");
}

export function saveLanguage(lang: Lang) {
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
  } catch {
    // Storage may be restricted; the current session still keeps its language.
  }
}

export function t(lang: Lang, key: RoleMessageKey) {
  return roleMessages[lang][key];
}
