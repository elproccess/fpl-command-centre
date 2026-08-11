export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "matchday-theme";

// Kept as a plain string (not a template literal referencing the constant above) so it can be
// copy-pasted verbatim into the inline <script> in layout.tsx, which must run as raw text before
// hydration - see that script's own comment for why it can't just import this module.
export const THEME_INIT_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem("matchday-theme");
    if (stored === "dark") document.documentElement.setAttribute("data-theme", "dark");
  } catch (e) {}
})();
`;

export function getStoredTheme(): Theme {
  if (typeof window === "undefined") return "light";
  try {
    return window.localStorage.getItem(THEME_STORAGE_KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

// The only place that ever writes data-theme="dark" - defaults to light for every visitor
// regardless of OS preference until they explicitly opt in here (see Settings' ThemeToggle).
export function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return;
  if (theme === "dark") {
    document.documentElement.setAttribute("data-theme", "dark");
  } else {
    document.documentElement.removeAttribute("data-theme");
  }
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    /* Storage can be disabled/full in private browsing - the in-memory attribute change above
       still applies for the rest of this session. */
  }
}
