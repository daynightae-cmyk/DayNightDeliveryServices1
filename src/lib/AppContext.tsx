import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";

type Theme = "dark" | "light" | "system";
type Language = "ar" | "en";

interface AppContextType {
  theme: Theme;
  toggleTheme: () => void;
  setThemeMode: (mode: Theme) => void;
  language: Language;
  toggleLanguage: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>("dark");
  const [language, setLanguage] = useState<Language>("ar");

  // Function to apply theme based on mode
  const applyTheme = (themeMode: Theme) => {
    if (themeMode === "system") {
      const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      if (isDark) {
        document.documentElement.classList.add("dark-theme");
        document.documentElement.classList.remove("light-theme");
      } else {
        document.documentElement.classList.add("light-theme");
        document.documentElement.classList.remove("dark-theme");
      }
    } else if (themeMode === "light") {
      document.documentElement.classList.add("light-theme");
      document.documentElement.classList.remove("dark-theme");
    } else {
      document.documentElement.classList.add("dark-theme");
      document.documentElement.classList.remove("light-theme");
    }
  };

  useEffect(() => {
    applyTheme(theme);
    
    // Listen for system theme changes when in system mode
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => {
      if (theme === "system") {
        applyTheme("system");
      }
    };
    
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [theme]);

  // Adjust document direction when language changes
  useEffect(() => {
    document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
    document.documentElement.lang = language;
  }, [language]);

  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : theme === "light" ? "system" : "dark";
    setTheme(newTheme);
    localStorage.setItem("daynight-theme", newTheme);
  };
  
  const setThemeMode = (mode: Theme) => {
    setTheme(mode);
    localStorage.setItem("daynight-theme", mode);
  };
  
  const toggleLanguage = () => setLanguage((prev) => (prev === "ar" ? "en" : "ar"));
  
  // Load saved theme preference on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem("daynight-theme") as Theme | null;
    if (savedTheme && ["dark", "light", "system"].includes(savedTheme)) {
      setTheme(savedTheme);
    }
  }, []);

  return (
    <AppContext.Provider value={{ theme, toggleTheme, setThemeMode, language, toggleLanguage }}>
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
