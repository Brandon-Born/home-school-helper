"use client";

import { useTheme } from "./ThemeProvider.js";

const MODES = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" }
];

export function ThemeToggle() {
  const { themeMode, resolvedTheme, setThemeMode } = useTheme();

  return (
    <div className="theme-toggle" role="group" aria-label="Theme mode">
      {MODES.map((mode) => (
        <button
          key={mode.value}
          type="button"
          className={`theme-toggle__option${themeMode === mode.value ? " is-selected" : ""}`}
          onClick={() => setThemeMode(mode.value)}
          aria-pressed={themeMode === mode.value}
        >
          {mode.label}
        </button>
      ))}
      <span className="theme-toggle__status" aria-live="polite">
        {resolvedTheme === "dark" ? "Dark" : "Light"}
      </span>
    </div>
  );
}
