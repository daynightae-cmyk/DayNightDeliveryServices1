import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
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

export function AppProvider({ children }: { children: ReactNode }) {
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    try {
      const saved = localStorage.getItem("dn_theme_mode");
      if (saved === "light" || saved === "dark" || saved === "system") {
        return saved;
      }
    } catch {
      // ignore
    }
    return "system";
  });

  const [theme, setTheme] = useState<Theme>("dark");
  const [language, setLanguageState] = useState<Language>(() => getSavedLanguage() || detectBrowserLanguage());

  useEffect(() => {
    const prefersDark = typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    const nextTheme = themeMode === "system" ? (prefersDark ? "dark" : "light") : themeMode;
    setTheme(nextTheme);

    try {
      localStorage.setItem("dn_theme_mode", themeMode);
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
  }, [theme]);

  useEffect(() => {
    document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
    document.documentElement.lang = language;
    saveLanguage(language);
  }, [language]);

  const toggleTheme = () => setThemeMode((prev) => {
    if (prev === "dark") return "light";
    if (prev === "light") return "system";
    return "dark";
  });

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
    throw new Error("useAppContext must be used within an AppProvider");
  }
  return context;
}
