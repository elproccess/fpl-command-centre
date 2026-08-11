"use client";

import { ErrorState } from "@/components/states";

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <main className="min-h-screen bg-[var(--surface-2)] p-6 text-[var(--ink)]">
      <div className="mx-auto max-w-3xl rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] p-6 shadow-[0_18px_45px_rgba(55,0,60,0.08)]">
        <h1 className="text-3xl font-black">Could not load this view</h1>
        <div className="mt-4">
          <ErrorState message={error.message || "The FPL service did not respond. Please try again."} />
        </div>
        <button onClick={reset} className="mt-5 rounded-xl bg-[var(--accent)] px-4 py-3 text-sm font-black text-white">
          Try again
        </button>
      </div>
    </main>
  );
}
