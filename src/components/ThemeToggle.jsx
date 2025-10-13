// src/components/ThemeToggle.jsx
import React from "react";
import { Sun, Moon } from "lucide-react";
import { useTheme } from "../hooks/useTheme";

export default function ThemeToggle({ className = "" }) {
  const { theme, setTheme } = useTheme();
  const isDark = theme === "dark";

  const toggle = () => setTheme(isDark ? "light" : "dark");

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={isDark}
      aria-label={isDark ? "Passer en mode clair" : "Passer en mode sombre"}
      title={isDark ? "Mode clair" : "Mode sombre"}
      className={[
        "inline-flex items-center justify-center rounded-xl border",
        "border-gray-200 dark:border-gray-800 bg-white/70 dark:bg-gray-900/70",
        "hover:bg-white dark:hover:bg-gray-800 p-2 transition-colors",
        "focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2",
        "ring-offset-white dark:ring-offset-gray-950",
        className,
      ].join(" ")}
    >
      {/* Icône animée */}
      <span className="relative inline-block">
        <Sun
          className={
            "w-5 h-5 transition-all duration-200 " +
            (isDark
              ? "opacity-0 rotate-90 scale-75 absolute"
              : "opacity-100 rotate-0 scale-100")
          }
          aria-hidden
        />
        <Moon
          className={
            "w-5 h-5 transition-all duration-200 " +
            (isDark
              ? "opacity-100 rotate-0 scale-100"
              : "opacity-0 -rotate-90 scale-75 absolute")
          }
          aria-hidden
        />
      </span>
    </button>
  );
}
