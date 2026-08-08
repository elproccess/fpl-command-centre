declare global {
  interface Window {
    umami?: {
      track: (eventName: string, data?: Record<string, unknown>) => void;
    };
  }
}

// Safe to call from anywhere, anytime - a no-op until analytics.matchdayfpl.co.uk's script has
// actually finished loading (no queueing, since umami.track() calls before that point would
// otherwise silently vanish rather than error, which is what we want here too).
export function trackEvent(eventName: string, data?: Record<string, unknown>) {
  if (typeof window === "undefined" || !window.umami) return;
  window.umami.track(eventName, data);
}
