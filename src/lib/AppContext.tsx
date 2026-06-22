import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";

type Theme = "dark" | "light";
type Language = "ar" | "en";

interface AppContextType {
  theme: Theme;
  toggleTheme: () => void;
  language: Language;
  toggleLanguage: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>("dark");
  const [language, setLanguage] = useState<Language>("ar");

  useEffect(() => {
    // Apply theme classes to body for global styles if needed
    if (theme === "light") {
      document.documentElement.classList.add("light-theme");
      document.documentElement.classList.remove("dark-theme");
    } else {
      document.documentElement.classList.add("dark-theme");
      document.documentElement.classList.remove("light-theme");
    }
  }, [theme]);

  // Adjust document direction when language changes
  useEffect(() => {
    document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
    document.documentElement.lang = language;
  }, [language]);

  const toggleTheme = () => setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  const toggleLanguage = () => setLanguage((prev) => (prev === "ar" ? "en" : "ar"));

  return (
    <AppContext.Provider value={{ theme, toggleTheme, language, toggleLanguage }}>
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
