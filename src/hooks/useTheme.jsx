// src/hooks/useTheme.jsx
import React from "react";

const THEME_KEY = "insightmate.theme"; // "light" | "dark"

/** Applique la classe 'dark' au <html> de manière sûre */
function applyTheme(theme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (theme === "dark") root.classList.add("dark");
  else root.classList.remove("dark");
}

/** Récupère le thème initial (storage -> sinon préférence système -> "light") */
function getInitialTheme() {
  if (typeof window === "undefined") return "light";
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === "dark" || saved === "light") return saved;
    // fallback préférence système
    const prefersDark = window.matchMedia?.(
      "(prefers-color-scheme: dark)"
    )?.matches;
    return prefersDark ? "dark" : "light";
  } catch {
    return "light";
  }
}

export function useTheme() {
  const [theme, setTheme] = React.useState(getInitialTheme);

  // Applique au montage (utile si SSR ou si classe manquante)
  React.useEffect(() => {
    applyTheme(theme);
  }, []); // une fois

  // Persistance + application à chaque changement
  React.useEffect(() => {
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {}
    applyTheme(theme);
  }, [theme]);

  // Sync multi-onglets
  React.useEffect(() => {
    const onStorage = (e) => {
      if (
        e?.key === THEME_KEY &&
        (e.newValue === "dark" || e.newValue === "light")
      ) {
        setTheme(e.newValue);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const isDark = theme === "dark";
  const toggle = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  return { theme, setTheme, isDark, toggle };
}

export default useTheme; // compat
