"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getAnalysisStatus } from "@/lib/api";
import type { AnalysisJobStatus } from "@/lib/types";

const POLL_INTERVAL_MS = 4000;

const TRACKED_TABS: { key: string; label: string; href: string }[] = [
  { key: "squad_health", label: "Squad Health", href: "/squad/health" },
  { key: "dashboard_full", label: "Decision Centre", href: "/transfers" },
  { key: "planner", label: "Planner", href: "/planner" },
  { key: "scenarios", label: "Scenario Simulator", href: "/scenarios" },
  { key: "market_squad", label: "Player Stock Market", href: "/market" },
];

type JobState = "ready" | "computing" | "failed" | "idle";

function statusOf(job: AnalysisJobStatus | undefined): JobState {
  if (!job) return "idle";
  if (job.status === "completed") return "ready";
  if (job.status === "failed") return "failed";
  if (job.status === "pending" || job.status === "running") return "computing";
  return "idle"; // not_scheduled
}

/**
 * Polls /analysis/status for the imported team while any tracked background job is still
 * pending/running, and shows a compact strip on the Dashboard - the one page every user lands
 * on right after import, before they've opened any other tab. Without this, the background
 * analysis schedule_precompute() kicks off at import time is invisible until a user happens to
 * click into Planner/Decision Centre/etc. and sees a spinner there for the first time. Hides
 * itself once nothing is left computing (or the user dismisses it), so it never lingers as
 * permanent clutter once the whole team is ready.
 */
export function BackgroundAnalysisStrip({ entryId, gameweek }: { entryId: string; gameweek?: number }) {
  const [analysis, setAnalysis] = useState<Record<string, AnalysisJobStatus> | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!entryId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function poll() {
      try {
        const result = await getAnalysisStatus(entryId, gameweek);
        if (cancelled) return;
        setAnalysis(result.data.analysis);
        const stillGoing = TRACKED_TABS.some((tab) => statusOf(result.data.analysis[tab.key]) === "computing");
        if (stillGoing) timer = setTimeout(() => void poll(), POLL_INTERVAL_MS);
      } catch {
        if (!cancelled) timer = setTimeout(() => void poll(), POLL_INTERVAL_MS);
      }
    }

    void poll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [entryId, gameweek]);

  if (!analysis || dismissed) return null;

  const jobs = TRACKED_TABS.map((tab) => ({ ...tab, state: statusOf(analysis[tab.key]) }));
  const anyComputing = jobs.some((job) => job.state === "computing");
  const anyFailed = jobs.some((job) => job.state === "failed");
  if (!anyComputing && !anyFailed) return null;

  return (
    <section className="mb-5 rounded-2xl border border-[#D8C9FF] bg-[linear-gradient(145deg,#F8F4FF,#F2ECFF)] p-4 shadow-[0_14px_34px_rgba(108,29,255,0.08)]">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${anyComputing ? "animate-pulse bg-[#6C1DFF]" : "bg-[#E90052]"}`} />
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[#6C1DFF]">
            {anyComputing ? "Background analysis running" : "Background analysis needs attention"}
          </p>
        </div>
        <button type="button" onClick={() => setDismissed(true)} className="text-xs font-black text-[#6C7195] hover:text-[#6C1DFF]">
          Hide
        </button>
      </div>
      <p className="mt-1 text-xs font-semibold text-[#4D5680]">
        {anyComputing
          ? "Your other tabs are still computing in the background - they'll show real results as soon as each one finishes."
          : "One or more background analyses failed - open the tab to retry."}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {jobs.map((job) => (
          <Link
            key={job.key}
            href={job.href}
            className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-black transition ${
              job.state === "ready"
                ? "border-[#BDEFD2] bg-[#EFFFF5] text-[#008B49]"
                : job.state === "failed"
                  ? "border-[#FFC5D8] bg-[#FFF1F6] text-[#C80043]"
                  : job.state === "computing"
                    ? "border-[#D8C9FF] bg-white text-[#6C1DFF]"
                    : "border-[#E1E7F2] bg-white text-[#6C7195]"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                job.state === "ready"
                  ? "bg-[#00C853]"
                  : job.state === "failed"
                    ? "bg-[#E90052]"
                    : job.state === "computing"
                      ? "animate-pulse bg-[#6C1DFF]"
                      : "bg-[#B7BEDA]"
              }`}
            />
            {job.label}
            <span className="text-[10px] font-bold opacity-70">
              {job.state === "ready" ? "Ready" : job.state === "failed" ? "Failed" : job.state === "computing" ? "Computing…" : "—"}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
