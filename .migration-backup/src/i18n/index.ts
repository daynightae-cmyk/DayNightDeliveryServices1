export type Lang = "ar" | "en";

const STORAGE_KEY = "dn_lang_preference";

export function detectBrowserLanguage(): Lang {
  if (typeof navigator === "undefined") return "ar";
  const lang = (navigator.language || "ar").toLowerCase();
  return lang.startsWith("ar") ? "ar" : "en";
}

export function getSavedLanguage(): Lang | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === "ar" || value === "en" ? value : null;
  } catch {
    return null;
  }
}

export function saveLanguage(lang: Lang) {
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    // ignore
  }
}
