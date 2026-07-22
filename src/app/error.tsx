"use client";

import { ErrorState } from "@/components/states";

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <main className="min-h-screen bg-[#F4F0FA] p-6 text-[#17002F]">
      <div className="mx-auto max-w-3xl rounded-2xl border border-[#E8DEF8] bg-white p-6 shadow-[0_18px_45px_rgba(55,0,60,0.08)]">
        <h1 className="text-3xl font-black">Could not load this view</h1>
        <div className="mt-4">
          <ErrorState message={error.message || "The FPL service did not respond. Please try again."} />
        </div>
        <button onClick={reset} className="mt-5 rounded-xl bg-[#6C1DFF] px-4 py-3 text-sm font-black text-white">
          Try again
        </button>
      </div>
    </main>
  );
}
