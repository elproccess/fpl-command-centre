import type { Metadata } from "next";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";

export const metadata: Metadata = {
  title: "About & Methodology",
  description:
    "How Matchday OS turns Fantasy Premier League data into transfer and captaincy recommendations - what feeds the model, what it's good at, and where it can be wrong.",
  alternates: { canonical: "/about" },
};

function InfoCard({ title, body }: { title: string; body: string }) {
  return (
    <section className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] p-5 shadow-[0_18px_45px_rgba(55,0,60,0.08)]">
      <h2 className="text-xl font-black text-[var(--ink)]">{title}</h2>
      <p className="mt-3 text-sm font-semibold leading-6 text-[var(--muted)]">{body}</p>
    </section>
  );
}

export default function AboutPage() {
  return (
    <AppShell title="About Matchday OS" eyebrow="What this is, and how it actually works">
      <section className="rounded-2xl border border-[#111827] bg-[#070912] p-5 text-white shadow-[0_24px_60px_rgba(0,0,0,0.18)]">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#A7F3D0]">In plain English</p>
        <h1 className="mt-2 text-4xl font-black">A free Fantasy Premier League planner that shows its working</h1>
        <p className="mt-3 max-w-4xl text-sm font-semibold leading-6 text-white/72">
          Matchday OS is a decision-support tool for Fantasy Premier League - it plans transfers and captaincy across
          the full gameweek horizon, not just the next one, and pulls in a live market screen and squad health checks
          along the way. It doesn&apos;t pick a squad for you. It shows the best move it can find, why it thinks that,
          how confident it is, and what could make it wrong - then leaves the call with you.
        </p>
      </section>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <InfoCard
          title="Where the numbers come from"
          body="Player prices, minutes, fixtures, and results are ingested from the official FPL API and refreshed on a schedule. Those feed a projection model that estimates expected points per player per gameweek, which the planner, market screen, and captaincy picks are all built on top of - one shared set of numbers, not a different guess per page."
        />
        <InfoCard
          title="Why 'planner', not 'picker'"
          body="Fantasy Premier League is a multi-gameweek game - a transfer that looks good this week can be the wrong one once you weight fixtures three or four gameweeks out. Matchday OS plans across that full horizon at once, so a recommendation already accounts for what's coming, not just what's in front of you right now."
        />
        <InfoCard
          title="Confidence, not certainty"
          body="Every recommendation carries a confidence and risk label, not just a single number. Projections are a model's best estimate from real data, not a promise - form changes, teams rotate, and injuries happen mid-week. The full breakdown, including live backtest results measured against actual gameweek outcomes, is on the model trust page."
        />
        <InfoCard
          title="Free, no account needed"
          body="The core planner, dashboard, and market screen are free to use with no signup - import a team ID and it works. Some deeper features (unlimited scenario testing, the full multi-gameweek planner, advanced confidence auditing) sit behind paid tiers to keep the project running, but the core decision engine isn't paywalled."
        />
      </div>

      <section className="mt-6 rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] p-5 shadow-[0_18px_45px_rgba(55,0,60,0.08)]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--accent)]">Want the live numbers?</p>
            <h2 className="mt-2 text-2xl font-black text-[var(--ink)]">Backtest results, fallback status, and decision variables update in real time</h2>
            <p className="mt-2 max-w-2xl text-sm font-semibold text-[var(--muted)]">
              The model trust page shows exactly which variables currently drive a recommendation, the model&apos;s
              measured accuracy against real past gameweeks, and what happens when data is missing or a fallback kicks in.
            </p>
          </div>
          <Link
            href="/trust"
            className="w-fit shrink-0 rounded-full bg-[var(--ink)] px-5 py-3 text-sm font-black text-[var(--surface)] transition hover:opacity-90"
          >
            See model trust →
          </Link>
        </div>
      </section>

      <section className="mt-6">
        <p className="mb-3 text-xs font-black uppercase tracking-[0.14em] text-[var(--muted-2)]">New to FPL?</p>
        <div className="grid gap-3 sm:grid-cols-4">
          <Link href="/guides/beginners" className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] p-4 text-sm font-black text-[var(--ink)] transition hover:border-[var(--accent-border)] hover:bg-[var(--accent-soft)]">
            FPL for Beginners →
          </Link>
          <Link href="/guides/chips" className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] p-4 text-sm font-black text-[var(--ink)] transition hover:border-[var(--accent-border)] hover:bg-[var(--accent-soft)]">
            Chips Explained →
          </Link>
          <Link href="/guides/captaincy" className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] p-4 text-sm font-black text-[var(--ink)] transition hover:border-[var(--accent-border)] hover:bg-[var(--accent-soft)]">
            Captaincy Explained →
          </Link>
          <Link href="/guides/mistakes" className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] p-4 text-sm font-black text-[var(--ink)] transition hover:border-[var(--accent-border)] hover:bg-[var(--accent-soft)]">
            Common Mistakes →
          </Link>
        </div>
      </section>
    </AppShell>
  );
}
