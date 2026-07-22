"use client";

import type { ReactNode } from "react";

export function FootballPitch({ children, label = "Pitch map" }: { children: ReactNode; label?: string }) {
  return (
    <div aria-label={label} className="relative aspect-[1.48/1] w-full overflow-hidden rounded-2xl border border-white/10 bg-[#0D7A43] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]">
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.055)_1px,transparent_1px),linear-gradient(0deg,rgba(255,255,255,0.045)_1px,transparent_1px)] bg-[length:34px_34px]" />
      <svg viewBox="0 0 100 68" className="absolute inset-0 h-full w-full text-white/45" fill="none" preserveAspectRatio="none">
        <rect x="3" y="3" width="94" height="62" rx="2" stroke="currentColor" strokeWidth="0.8" />
        <path d="M50 3v62" stroke="currentColor" strokeWidth="0.55" />
        <circle cx="50" cy="34" r="8.5" stroke="currentColor" strokeWidth="0.55" />
        <circle cx="50" cy="34" r="0.65" fill="currentColor" />
        <path d="M3 21h13v26H3M97 21H84v26h13" stroke="currentColor" strokeWidth="0.6" />
        <path d="M3 27h6v14H3M97 27h-6v14h6" stroke="currentColor" strokeWidth="0.5" />
        <circle cx="11" cy="34" r="0.55" fill="currentColor" />
        <circle cx="89" cy="34" r="0.55" fill="currentColor" />
      </svg>
      <div className="absolute inset-0">{children}</div>
    </div>
  );
}
