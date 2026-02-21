export const THEME_STORAGE_KEY = "hsh_theme_mode";

export function parseThemeMode(value) {
  if (value === "light" || value === "dark") {
    return value;
  }

  return null;
}

export const THEME_BOOTSTRAP_SCRIPT = `
(() => {
  try {
    const raw = localStorage.getItem("${THEME_STORAGE_KEY}");
    let mode = raw === "light" || raw === "dark" ? raw : null;
    if (!mode) {
      const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
      mode = prefersDark ? "dark" : "light";
      localStorage.setItem("${THEME_STORAGE_KEY}", mode);
    }
    document.documentElement.dataset.theme = mode;
    document.documentElement.style.colorScheme = mode;
  } catch {}
})();
`;
