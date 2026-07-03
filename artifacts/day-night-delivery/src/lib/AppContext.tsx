import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { getSavedLanguage, saveLanguage } from "../i18n";

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
const THEME_TOUCHED_KEY = "dn_theme_user_selected";
const THEME_DEFAULT_VERSION_KEY = "dn_theme_default_version";
const THEME_DEFAULT_VERSION = "20260703-night-first";

export function AppProvider({ children }: { children: ReactNode }) {
  const [themeMode, setThemeModeState] = useState<ThemeMode>(() => {
    try {
      const saved = localStorage.getItem(THEME_MODE_KEY);
      const touched = localStorage.getItem(THEME_TOUCHED_KEY) === "1";
      const defaultVersion = localStorage.getItem(THEME_DEFAULT_VERSION_KEY);

      if (defaultVersion !== THEME_DEFAULT_VERSION && !touched) {
        localStorage.setItem(THEME_MODE_KEY, "dark");
        localStorage.setItem(THEME_DEFAULT_VERSION_KEY, THEME_DEFAULT_VERSION);
        return "dark";
      }

      if (touched && (saved === "light" || saved === "dark" || saved === "system")) {
        return saved;
      }
    } catch {
      // ignore storage issues
    }
    return "dark";
  });

  const [theme, setTheme] = useState<Theme>("dark");
  const [language, setLanguageState] = useState<Language>(() => getSavedLanguage() || "ar");

  useEffect(() => {
    const prefersDark = typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    const nextTheme = themeMode === "system" ? (prefersDark ? "dark" : "light") : themeMode;
    setTheme(nextTheme);

    try {
      localStorage.setItem(THEME_MODE_KEY, themeMode);
      localStorage.setItem(THEME_DEFAULT_VERSION_KEY, THEME_DEFAULT_VERSION);
    } catch {
      // ignore
    }
  }, [themeMode]);

  useEffect(() => {
    if (theme === "light") {
      document.documentElement.classList.add("light-theme");
      document.documentElement.classList.remove("dark-theme");
    } else {
      document.documentElement.classList.add("dark-theme");
      document.documentElement.classList.remove("light-theme");
    }
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
    document.documentElement.lang = language;
    saveLanguage(language);
  }, [language]);

  const setThemeMode = (mode: ThemeMode) => {
    try {
      localStorage.setItem(THEME_TOUCHED_KEY, "1");
    } catch {
      // ignore
    }
    setThemeModeState(mode);
  };

  const toggleTheme = () => setThemeMode(themeMode === "dark" ? "light" : "dark");

  const setLanguage = (lang: Language) => setLanguageState(lang);
  const toggleLanguage = () => setLanguageState((prev) => (prev === "ar" ? "en" : "ar"));

  return (
    <AppContext.Provider value={{ theme, themeMode, toggleTheme, setThemeMode, language, setLanguage, toggleLanguage }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useAppContext must be used within AppProvider");
  }
  return context;
}
