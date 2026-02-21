(function bootstrapThemeMode() {
  try {
    var raw = localStorage.getItem("hsh_theme_mode");
    var mode = raw === "light" || raw === "dark" || raw === "system" ? raw : "system";
    var prefersDark =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches;
    var resolved = mode === "dark" ? "dark" : mode === "light" ? "light" : prefersDark ? "dark" : "light";
    document.documentElement.dataset.theme = resolved;
    document.documentElement.style.colorScheme = resolved;
  } catch (_) {
    // Ignore storage/DOM errors and let hydration choose defaults.
  }
})();
