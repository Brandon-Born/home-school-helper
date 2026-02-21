"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { parseThemeMode, THEME_STORAGE_KEY } from "../../../src/lib/theme-mode.js";

const ThemeContext = createContext(null);

function readSystemPreference() {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function applyResolvedTheme(resolvedTheme) {
  if (typeof document === "undefined") {
    return;
  }

  document.documentElement.dataset.theme = resolvedTheme;
  document.documentElement.style.colorScheme = resolvedTheme;
}

function readInitialMode() {
  if (typeof window === "undefined") {
    return "light";
  }

  try {
    const stored = parseThemeMode(window.localStorage.getItem(THEME_STORAGE_KEY));
    if (stored) {
      return stored;
    }
    const mode = readSystemPreference() ? "dark" : "light";
    window.localStorage.setItem(THEME_STORAGE_KEY, mode);
    return mode;
  } catch {
    return "light";
  }
}

function readInitialThemeState() {
  const mode = readInitialMode();
  let resolvedTheme = mode;
  if (typeof document !== "undefined") {
    const fromDom = document.documentElement.dataset.theme;
    if (fromDom === "light" || fromDom === "dark") {
      resolvedTheme = fromDom;
    }
  }

  return {
    mode: resolvedTheme,
    resolvedTheme
  };
}

export function ThemeProvider({ children }) {
  const [initialThemeState] = useState(readInitialThemeState);
  const [themeMode, setThemeMode] = useState(initialThemeState.mode);

  useEffect(() => {
    const mode = parseThemeMode(themeMode) || "light";

    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, mode);
    } catch {
      // Ignore storage failures.
    }

    applyResolvedTheme(mode);
  }, [themeMode]);

  const value = useMemo(
    () => ({
      themeMode,
      resolvedTheme: themeMode,
      setThemeMode
    }),
    [themeMode]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider.");
  }

  return context;
}
