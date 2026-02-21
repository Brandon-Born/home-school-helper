"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { parseThemeMode, THEME_STORAGE_KEY } from "../../../src/lib/theme-mode.js";

const ThemeContext = createContext(null);

function applyResolvedTheme(resolvedTheme) {
  if (typeof document === "undefined") {
    return;
  }

  document.documentElement.dataset.theme = resolvedTheme;
  document.documentElement.style.colorScheme = resolvedTheme;
}

export function ThemeProvider({ children }) {
  // Always initialize to the default server rendered state to prevent hydration errors
  const [themeMode, setThemeMode] = useState("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Once the component is mounted on the client, synchronize the state
    setMounted(true);
    let initialMode = "light";
    if (typeof document !== "undefined") {
      const fromDom = document.documentElement.dataset.theme;
      if (fromDom === "light" || fromDom === "dark") {
        initialMode = fromDom;
      }
    }
    setThemeMode(initialMode);
  }, []);

  useEffect(() => {
    // Only persist back to the DOM/Storage if we've successfully mounted and stabilized
    if (!mounted) return;
    const mode = parseThemeMode(themeMode) || "light";

    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, mode);
    } catch {
      // Ignore storage failures.
    }

    applyResolvedTheme(mode);
  }, [themeMode, mounted]);

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

