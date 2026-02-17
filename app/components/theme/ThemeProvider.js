"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { parseThemeMode, resolveTheme, resolveThemeFromStorageValue, THEME_STORAGE_KEY } from "../../../src/lib/theme-mode.js";

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
    return "system";
  }

  try {
    return parseThemeMode(window.localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return "system";
  }
}

function readInitialResolvedTheme(initialMode) {
  if (typeof document !== "undefined") {
    const fromDom = document.documentElement.dataset.theme;
    if (fromDom === "light" || fromDom === "dark") {
      return fromDom;
    }
  }

  return resolveTheme(initialMode, readSystemPreference());
}

function readInitialThemeState() {
  const mode = readInitialMode();
  return {
    mode,
    resolvedTheme: readInitialResolvedTheme(mode)
  };
}

export function ThemeProvider({ children }) {
  const [initialThemeState] = useState(readInitialThemeState);
  const [themeMode, setThemeMode] = useState(initialThemeState.mode);
  const [resolvedTheme, setResolvedTheme] = useState(initialThemeState.resolvedTheme);

  useEffect(() => {
    const mode = parseThemeMode(themeMode);
    let mediaQueryList = null;

    function recomputeResolvedTheme() {
      const nextTheme = resolveThemeFromStorageValue(mode, readSystemPreference());
      setResolvedTheme(nextTheme);
      applyResolvedTheme(nextTheme);
    }

    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, mode);
    } catch {
      // Ignore storage failures.
    }

    recomputeResolvedTheme();

    if (mode !== "system" || typeof window.matchMedia !== "function") {
      return undefined;
    }

    mediaQueryList = window.matchMedia("(prefers-color-scheme: dark)");
    const listener = () => {
      recomputeResolvedTheme();
    };

    if (typeof mediaQueryList.addEventListener === "function") {
      mediaQueryList.addEventListener("change", listener);
      return () => mediaQueryList.removeEventListener("change", listener);
    }

    mediaQueryList.addListener(listener);
    return () => mediaQueryList.removeListener(listener);
  }, [themeMode]);

  const value = useMemo(
    () => ({
      themeMode,
      resolvedTheme,
      setThemeMode
    }),
    [resolvedTheme, themeMode]
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
