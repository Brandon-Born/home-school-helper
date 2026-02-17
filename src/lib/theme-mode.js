export const THEME_STORAGE_KEY = "hsh_theme_mode";

export function parseThemeMode(value) {
  if (value === "light" || value === "dark" || value === "system") {
    return value;
  }

  return "system";
}

export function resolveTheme(mode, prefersDark) {
  const normalizedMode = parseThemeMode(mode);
  if (normalizedMode === "light" || normalizedMode === "dark") {
    return normalizedMode;
  }

  return prefersDark ? "dark" : "light";
}

export function resolveThemeFromStorageValue(rawStorageValue, prefersDark) {
  return resolveTheme(parseThemeMode(rawStorageValue), prefersDark);
}

export const THEME_BOOTSTRAP_SCRIPT = `
(() => {
  try {
    const raw = localStorage.getItem("${THEME_STORAGE_KEY}");
    const mode = raw === "light" || raw === "dark" || raw === "system" ? raw : "system";
    const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    const resolved = mode === "dark" ? "dark" : mode === "light" ? "light" : prefersDark ? "dark" : "light";
    document.documentElement.dataset.theme = resolved;
    document.documentElement.style.colorScheme = resolved;
  } catch {}
})();
`;
