"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { translate } from "@/lib/i18n";
import type { Language } from "@/lib/types";

interface I18nContextValue {
  lang: Language;
  dir: "ltr" | "rtl";
  setLang: (l: Language) => void;
  toggleLang: () => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

interface ThemeContextValue {
  theme: "light" | "dark";
  toggleTheme: () => void;
}
const ThemeContext = createContext<ThemeContextValue | null>(null);

export function Providers({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>("en");
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const savedLang = (localStorage.getItem("axis_lang") as Language) || "en";
    const savedTheme =
      (localStorage.getItem("axis_theme") as "light" | "dark") ||
      (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    setLangState(savedLang);
    setTheme(savedTheme);
  }, []);

  useEffect(() => {
    const dir = lang === "ar" ? "rtl" : "ltr";
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
    localStorage.setItem("axis_lang", lang);
  }, [lang]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("axis_theme", theme);
  }, [theme]);

  const setLang = useCallback((l: Language) => setLangState(l), []);
  const toggleLang = useCallback(
    () => setLangState((p) => (p === "en" ? "ar" : "en")),
    []
  );
  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => translate(lang, key, vars),
    [lang]
  );
  const toggleTheme = useCallback(
    () => setTheme((p) => (p === "light" ? "dark" : "light")),
    []
  );

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      <I18nContext.Provider
        value={{ lang, dir: lang === "ar" ? "rtl" : "ltr", setLang, toggleLang, t }}
      >
        {children}
      </I18nContext.Provider>
    </ThemeContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within Providers");
  return ctx;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within Providers");
  return ctx;
}
