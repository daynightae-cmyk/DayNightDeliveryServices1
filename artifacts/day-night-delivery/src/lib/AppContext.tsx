import React, { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { detectBrowserLanguage, getSavedLanguage, saveLanguage } from "../i18n";

type Theme = "dark" | "light";
type ThemeMode = Theme | "system";
type Language = "ar" | "en";

interface AppContextType {
  theme: Theme;
  themeMode: ThemeMode;
  toggleTheme: () => void;
  setThemeMode: (mode: ThemeMode) => void;
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);
const THEME_MODE_KEY = "dn_theme_mode";
const ADMIN_SETTINGS_KEY = "dn_admin_control_settings_v2";

function savedThemeMode(): ThemeMode {
  try {
    const saved = localStorage.getItem(THEME_MODE_KEY);
    if (saved === "light" || saved === "dark" || saved === "system") return saved;
    const admin = JSON.parse(localStorage.getItem(ADMIN_SETTINGS_KEY) || "{}");
    if (admin?.theme === "day") return "light";
    if (admin?.theme === "night") return "dark";
  } catch {
    // Storage may be unavailable in private browser contexts.
  }
  return "system";
}

function systemTheme(): Theme {
  if (typeof window === "undefined" || !window.matchMedia) return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function persistAdminTheme(theme: Theme) {
  try {
    const current = JSON.parse(localStorage.getItem(ADMIN_SETTINGS_KEY) || "{}");
    localStorage.setItem(
      ADMIN_SETTINGS_KEY,
      JSON.stringify({ ...current, theme: theme === "light" ? "day" : "night" }),
    );
  } catch {
    // Keep rendering safe when storage is restricted or malformed.
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [themeMode, setThemeModeState] = useState<ThemeMode>(savedThemeMode);
  const [systemPreference, setSystemPreference] = useState<Theme>(systemTheme);
  const [language, setLanguageState] = useState<Language>(() => getSavedLanguage() || detectBrowserLanguage());

  const theme = useMemo<Theme>(
    () => (themeMode === "system" ? systemPreference : themeMode),
    [systemPreference, themeMode],
  );

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => setSystemPreference(media.matches ? "dark" : "light");
    update();
    media.addEventListener?.("change", update);
    return () => media.removeEventListener?.("change", update);
  }, []);

  useEffect(() => {
    const syncFromAdminSettings = (event: Event) => {
      const detail = (event as CustomEvent<{ theme?: "day" | "night" }>).detail;
      if (detail?.theme === "day") setThemeModeState("light");
      if (detail?.theme === "night") setThemeModeState("dark");
    };
    window.addEventListener("dn-admin-settings-change", syncFromAdminSettings);
    return () => window.removeEventListener("dn-admin-settings-change", syncFromAdminSettings);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(THEME_MODE_KEY, themeMode);
    } catch {
      // Ignore storage failures.
    }
  }, [themeMode]);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("light-theme", theme === "light");
    root.classList.toggle("dark-theme", theme === "dark");
    root.dataset.theme = theme;
    root.dataset.dnAdminTheme = theme === "light" ? "day" : "night";
    root.style.colorScheme = theme;
    document.body?.classList.toggle("light-theme", theme === "light");
    document.body?.classList.toggle("dark-theme", theme === "dark");
    persistAdminTheme(theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
    document.documentElement.lang = language;
    saveLanguage(language);
  }, [language]);

  const setThemeMode = (mode: ThemeMode) => setThemeModeState(mode);
  const toggleTheme = () =>
    setThemeModeState((current) =>
      current === "dark" ? "light" : current === "light" ? "system" : "dark",
    );
  const setLanguage = (lang: Language) => setLanguageState(lang);
  const toggleLanguage = () => setLanguageState((current) => (current === "ar" ? "en" : "ar"));

  return (
    <AppContext.Provider value={{ theme, themeMode, toggleTheme, setThemeMode, language, setLanguage, toggleLanguage }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (!context) throw new Error("useAppContext must be used within AppProvider");
  return context;
}
