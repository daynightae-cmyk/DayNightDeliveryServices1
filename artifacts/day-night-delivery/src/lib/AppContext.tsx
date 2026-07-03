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
const THEME_DEFAULT_VERSION = "20260703-night-only-production";

function forceNightStorage() {
  try {
    localStorage.setItem(THEME_MODE_KEY, "dark");
    localStorage.setItem(THEME_DEFAULT_VERSION_KEY, THEME_DEFAULT_VERSION);
    localStorage.removeItem(THEME_TOUCHED_KEY);
  } catch {
    // ignore storage issues
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [themeMode, setThemeModeState] = useState<ThemeMode>(() => {
    forceNightStorage();
    return "dark";
  });

  const [theme, setTheme] = useState<Theme>("dark");
  const [language, setLanguageState] = useState<Language>(() => getSavedLanguage() || "ar");

  useEffect(() => {
    forceNightStorage();
    if (themeMode !== "dark") setThemeModeState("dark");
    setTheme("dark");
  }, [themeMode]);

  useEffect(() => {
    document.documentElement.classList.add("dark-theme");
    document.documentElement.classList.remove("light-theme");
    document.documentElement.dataset.theme = "dark";
    document.documentElement.style.colorScheme = "dark";
    document.body?.classList.remove("light-theme");
    document.body?.classList.add("dark-theme");
  }, [theme]);

  useEffect(() => {
    document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
    document.documentElement.lang = language;
    saveLanguage(language);
  }, [language]);

  const setThemeMode = (_mode: ThemeMode) => {
    forceNightStorage();
    setThemeModeState("dark");
    setTheme("dark");
  };

  const toggleTheme = () => setThemeMode("dark");
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
