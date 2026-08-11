"use client";

import { useEffect, useState } from "react";
import { applyTheme, getStoredTheme, type Theme } from "@/lib/theme";

export function ThemeToggle() {
  // Starts "light" on the server render (matches the platform's actual default) and syncs to
  // whatever the inline layout script already applied the instant this mounts - never causes the
  // flash the inline script exists to prevent, since <html> already has the right data-theme
  // attribute before this component's own JS runs.
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    setTheme(getStoredTheme());
  }, []);

  function choose(next: Theme) {
    setTheme(next);
    applyTheme(next);
  }

  return (
    <div className="inline-flex rounded-xl border border-[var(--border-soft)] bg-[var(--surface-3)] p-1">
      {(["light", "dark"] as const).map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => choose(option)}
          aria-pressed={theme === option}
          className={`rounded-lg px-4 py-2 text-sm font-black capitalize transition ${
            theme === option
              ? "bg-[var(--accent)] text-white shadow-[0_8px_18px_rgba(108,29,255,0.28)]"
              : "text-[var(--muted)] hover:text-[var(--ink)]"
          }`}
        >
          {option}
        </button>
      ))}
    </div>
  );
}
