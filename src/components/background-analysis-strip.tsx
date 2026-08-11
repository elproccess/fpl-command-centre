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
    <section className="mb-5 rounded-2xl border border-[var(--accent-border)] bg-[linear-gradient(145deg,var(--accent-soft),var(--accent-soft))] p-4 shadow-[0_14px_34px_rgba(108,29,255,0.08)]">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${anyComputing ? "animate-pulse bg-[var(--accent)]" : "bg-[var(--danger)]"}`} />
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--accent)]">
            {anyComputing ? "Background analysis running" : "Background analysis needs attention"}
          </p>
        </div>
        <button type="button" onClick={() => setDismissed(true)} className="text-xs font-black text-[var(--muted)] hover:text-[var(--accent)]">
          Hide
        </button>
      </div>
      <p className="mt-1 text-xs font-semibold text-[var(--ink-soft)]">
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
                ? "border-[var(--success-border)] bg-[var(--success-soft)] text-[var(--success)]"
                : job.state === "failed"
                  ? "border-[var(--danger-border)] bg-[var(--danger-soft)] text-[var(--danger)]"
                  : job.state === "computing"
                    ? "border-[var(--accent-border)] bg-[var(--surface)] text-[var(--accent)]"
                    : "border-[var(--border)] bg-[var(--surface)] text-[var(--muted)]"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                job.state === "ready"
                  ? "bg-[var(--success)]"
                  : job.state === "failed"
                    ? "bg-[var(--danger)]"
                    : job.state === "computing"
                      ? "animate-pulse bg-[var(--accent)]"
                      : "bg-[var(--muted)]"
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
