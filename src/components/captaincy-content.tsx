"use client";

import { ConfidenceBadge, RiskBadge } from "@/components/badges";
import { FixturePill } from "@/components/fpl-ui";
import { usePlayerDetail } from "@/components/player-detail-modal";
import { PlayerVisual } from "@/components/player-visual";
import { StillComputingPanel, usePolledAnalysis } from "@/components/polled-analysis";
import { ErrorState } from "@/components/states";
import { getCaptaincyCentre } from "@/lib/api";
import type { CaptaincyOption } from "@/lib/types";

const cardShell =
  "rounded-[24px] border border-[var(--border-soft)] bg-[var(--surface)] shadow-[0_18px_50px_rgba(35,10,57,0.065)]";

function formatPoints(value: number | null | undefined, digits = 1) {
  if (value == null || !Number.isFinite(Number(value))) return "—";
  return Number(value).toFixed(digits);
}

function numericValue(value: unknown) {
  const parsed = typeof value === "number" ? value : Number.parseFloat(String(value ?? ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, value));
}

function optionScore(option: CaptaincyOption, maxProjection: number) {
  if (!maxProjection) return 0;
  return clampPercent((option.projected_points / maxProjection) * 100);
}

function CheckIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4 fill-none stroke-current stroke-[2.2]">
      <path d="m4.5 10.5 3.1 3.1 7.9-8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function WarningIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4 fill-none stroke-current stroke-2">
      <path d="M10 3.2 17 16H3l7-12.8Z" strokeLinejoin="round" />
      <path d="M10 7v4.2M10 14h.01" strokeLinecap="round" />
    </svg>
  );
}

function MetricTile({
  label,
  value,
  detail,
  tone = "default",
  compact = false,
}: {
  label: string;
  value: string;
  detail?: string;
  tone?: "default" | "green" | "purple" | "amber";
  // Narrower contexts (e.g. the 3-column vice-captain panel in the sidebar rail) don't have room
  // for the same big number size used in the wide 4-column captain hero row - without this the
  // value truncates mid-digit (e.g. "85.93" becomes "8...").
  compact?: boolean;
}) {
  const valueClass =
    tone === "green"
      ? "text-[var(--success)]"
      : tone === "purple"
        ? "text-[var(--accent)]"
        : tone === "amber"
          ? "text-[var(--warning)]"
          : "text-[var(--ink)]";

  return (
    <div className={`min-w-0 rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] py-3 sm:py-4 ${compact ? "px-2.5 sm:px-3" : "px-3.5 sm:px-4"}`}>
      <p className="text-[9px] font-black uppercase tracking-[0.13em] text-[var(--muted)] sm:text-[10px]">
        {label}
      </p>
      <p
        className={`mt-1.5 truncate font-black tracking-[-0.025em] ${compact ? "text-xs sm:text-sm" : "text-xl sm:text-2xl"} ${valueClass}`}
      >
        {value}
      </p>
      {detail ? <p className="mt-1 truncate text-[11px] font-semibold text-[var(--muted)]">{detail}</p> : null}
    </div>
  );
}

function PlayerIdentity({
  option,
  compact = false,
}: {
  option: CaptaincyOption;
  compact?: boolean;
}) {
  const { open } = usePlayerDetail();
  return (
    <button type="button" onClick={() => open(option.player)} className="flex min-w-0 items-center gap-3 text-left">
      <div className={compact ? "shrink-0" : "shrink-0 rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] p-1 shadow-sm"}>
        <PlayerVisual player={option.player} size={compact ? "sm" : "lg"} />
      </div>
      <div className="min-w-0">
        <p className={`${compact ? "text-sm" : "text-xl sm:text-2xl"} truncate font-black tracking-[-0.02em] text-[var(--ink)]`}>
          {option.player.name}
        </p>
        <p className="mt-0.5 truncate text-xs font-bold text-[var(--muted)] sm:text-sm">
          {option.player.team} · {option.player.position}
        </p>
      </div>
    </button>
  );
}

function ViceCaptainPanel({ option }: { option: CaptaincyOption }) {
  return (
    <aside className="relative overflow-hidden rounded-[22px] border border-[var(--accent-border)] bg-[linear-gradient(145deg,var(--surface-2)_0%,var(--accent-soft)_100%)] p-4 sm:p-5">
      <div className="pointer-events-none absolute -right-6 -top-10 text-[150px] font-black leading-none text-[var(--accent)]/[0.055]">
        V
      </div>
      <div className="relative">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.15em] text-[var(--accent)]">Vice captain</p>
            <p className="mt-1 text-xs font-semibold text-[var(--muted)]">Best protection if the captain misses out</p>
          </div>
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--accent)] text-sm font-black text-white shadow-[0_10px_24px_rgba(108,29,255,0.22)]">
            V
          </span>
        </div>

        <div className="mt-4">
          <PlayerIdentity option={option} compact />
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <MetricTile label="Projected" value={formatPoints(option.projected_points)} tone="green" compact />
          <MetricTile label="Ceiling" value={option.ceiling != null ? formatPoints(option.ceiling, 0) : "—"} tone="purple" compact />
          <MetricTile label="Safety" value={option.safety != null ? String(option.safety) : "—"} compact />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <ConfidenceBadge value={option.confidence} />
          <RiskBadge value={option.risk} />
          <span className="rounded-lg border border-[var(--warning-border)] bg-[var(--warning-soft)] px-2.5 py-1 text-[10px] font-black text-[var(--warning)]">
            Minutes {option.minutes_risk}
          </span>
        </div>
      </div>
    </aside>
  );
}

function CaptainOptionCard({
  option,
  rank,
  maxProjection,
  featured = false,
}: {
  option: CaptaincyOption;
  rank: number;
  maxProjection: number;
  featured?: boolean;
}) {
  const score = optionScore(option, maxProjection);
  const safety = numericValue(option.safety);

  return (
    <article
      className={`group relative overflow-hidden rounded-[22px] border bg-[var(--surface)] p-4 transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_42px_rgba(38,10,61,0.09)] ${
        featured ? "border-[var(--accent-border)] ring-2 ring-[var(--accent)]/10" : "border-[var(--border-soft)]"
      }`}
    >
      <div
        className={`absolute inset-x-0 top-0 h-1 ${
          featured ? "bg-[linear-gradient(90deg,var(--accent),var(--accent-2))]" : "bg-[var(--border-soft)]"
        }`}
      />

      <div className="flex items-start justify-between gap-3 pt-1">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-black ${
              featured ? "bg-[var(--accent)] text-white" : "bg-[var(--accent-soft)] text-[var(--accent)]"
            }`}
          >
            {rank}
          </span>
          <PlayerIdentity option={option} compact />
        </div>
        <FixturePill fixture={option.player.fixture} difficulty={option.fixture_difficulty} />
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <div className="rounded-xl bg-[var(--surface-2)] px-3 py-3">
          <p className="text-[9px] font-black uppercase tracking-[0.1em] text-[var(--muted)]">Projection</p>
          <p className="mt-1 text-lg font-black text-[var(--success)]">{formatPoints(option.projected_points)}</p>
        </div>
        <div className="rounded-xl bg-[var(--surface-2)] px-3 py-3">
          <p className="text-[9px] font-black uppercase tracking-[0.1em] text-[var(--muted)]">Ceiling</p>
          <p className="mt-1 text-lg font-black text-[var(--accent)]">
            {option.ceiling != null ? formatPoints(option.ceiling, 0) : "—"}
          </p>
        </div>
        <div className="rounded-xl bg-[var(--surface-2)] px-3 py-3">
          <p className="text-[9px] font-black uppercase tracking-[0.1em] text-[var(--muted)]">Safety</p>
          <p className="mt-1 text-lg font-black text-[var(--ink)]">
            {option.safety != null ? String(option.safety) : "—"}
          </p>
        </div>
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[9px] font-black uppercase tracking-[0.12em] text-[var(--muted)]">Armband strength</p>
          <span className="text-xs font-black text-[var(--accent)]">{Math.round(score)}%</span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--border-soft)]">
          <div
            className="h-full rounded-full bg-[linear-gradient(90deg,var(--accent),var(--accent-2))] transition-all duration-500"
            style={{ width: `${score}%` }}
          />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <ConfidenceBadge value={option.confidence} />
        <RiskBadge value={option.risk} />
        <span className="rounded-lg border border-[var(--warning-border)] bg-[var(--warning-soft)] px-2.5 py-1 text-[10px] font-black text-[var(--warning)]">
          Minutes {option.minutes_risk}
        </span>
        {safety != null && safety >= 75 ? (
          <span className="rounded-lg border border-[var(--success-border)] bg-[var(--success-soft)] px-2.5 py-1 text-[10px] font-black text-[var(--success)]">
            Reliable
          </span>
        ) : null}
      </div>
    </article>
  );
}

function InsightPanel({
  eyebrow,
  title,
  body,
  tone,
}: {
  eyebrow: string;
  title: string;
  body: string;
  tone: "purple" | "amber" | "green";
}) {
  const toneClass =
    tone === "amber"
      ? "border-[var(--warning-border)] bg-[var(--warning-soft)] text-[var(--warning)]"
      : tone === "green"
        ? "border-[var(--success-border)] bg-[var(--success-soft)] text-[var(--success)]"
        : "border-[var(--accent-border)] bg-[var(--accent-soft)] text-[var(--accent)]";

  return (
    <article className={`rounded-[22px] border p-5 ${toneClass}`}>
      <p className="text-[10px] font-black uppercase tracking-[0.14em] opacity-80">{eyebrow}</p>
      <h3 className="mt-2 text-lg font-black tracking-[-0.02em] text-[var(--ink)]">{title}</h3>
      <p className="mt-3 text-sm font-semibold leading-6 text-[var(--ink-soft)]">{body}</p>
    </article>
  );
}

export function CaptaincyContent({ payload }: { payload: Record<string, unknown> }) {
  const entryIdValue = payload.entry_id ?? payload.team_id;
  const entryId = entryIdValue == null ? null : String(entryIdValue);
  const gameweekValue = payload.gameweek ?? payload.start_gw;
  const gameweekNumber = typeof gameweekValue === "number" ? gameweekValue : Number(gameweekValue);
  // getCaptaincyCentre hits the same /gameweek-command-centre/dashboard endpoint as Decision
  // Centre, so its background job status lives under the "dashboard_full" analysis type too.
  const state = usePolledAnalysis(() => getCaptaincyCentre(payload), [payload.entry_id], "captaincy", {
    entryId,
    gameweek: Number.isFinite(gameweekNumber) ? gameweekNumber : undefined,
    analysisType: "dashboard_full",
  });

  if (state.phase !== "ready") {
    if (state.phase === "error") return <ErrorState message={state.message} />;
    return (
      <StillComputingPanel
        phase={state.phase}
        elapsedMs={"elapsedMs" in state ? state.elapsedMs : undefined}
        label="Captaincy analysis"
      />
    );
  }

  const captaincy = state.data;
  const shortlist = captaincy.top_options.slice(0, 5);
  const maxProjection = Math.max(
    captaincy.best_captain.projected_points,
    ...shortlist.map((option) => option.projected_points),
    1,
  );

  return (
    <div className="space-y-6 pb-10">
      <section className="relative overflow-hidden rounded-[28px] border border-[var(--accent-border)] bg-[var(--surface)] shadow-[0_26px_70px_rgba(53,14,82,0.11)]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_82%_18%,rgba(108,29,255,0.16),transparent_34%),radial-gradient(circle_at_10%_100%,rgba(0,168,107,0.09),transparent_32%)]" />
        <div className="pointer-events-none absolute right-[-28px] top-[-54px] text-[260px] font-black leading-none text-[var(--accent)]/[0.045] sm:right-4 sm:top-[-72px] sm:text-[360px]">
          C
        </div>

        <div className="relative grid gap-0 xl:grid-cols-[minmax(0,1.22fr)_minmax(330px,.78fr)]">
          <div className="p-5 sm:p-7 lg:p-8">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-[var(--accent)] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-white">
                Recommended captain
              </span>
              <ConfidenceBadge value={captaincy.best_captain.confidence} />
              <RiskBadge value={captaincy.best_captain.risk} />
              <FixturePill
                fixture={captaincy.best_captain.player.fixture}
                difficulty={captaincy.best_captain.fixture_difficulty}
              />
            </div>

            <div className="mt-6 flex flex-col gap-5 sm:flex-row sm:items-center">
              <div className="relative shrink-0">
                <div className="absolute inset-0 scale-125 rounded-full bg-[var(--accent)]/10 blur-2xl" />
                <div className="relative rounded-[24px] border border-[var(--accent-border)] bg-[linear-gradient(145deg,var(--surface-2),var(--accent-soft))] p-3 shadow-[0_18px_42px_rgba(108,29,255,0.12)]">
                  <PlayerVisual player={captaincy.best_captain.player} size="lg" />
                  <span className="absolute -right-2 -top-2 grid h-10 w-10 place-items-center rounded-full border-4 border-white bg-[var(--accent)] text-sm font-black text-white shadow-[0_10px_22px_rgba(108,29,255,0.28)]">
                    C
                  </span>
                </div>
              </div>

              <div className="min-w-0">
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[var(--accent)]">
                  Captaincy verdict
                </p>
                <h2 className="mt-2 truncate text-4xl font-black tracking-[-0.045em] text-[var(--ink)] sm:text-5xl">
                  {captaincy.best_captain.player.name}
                </h2>
                <p className="mt-2 text-sm font-bold text-[var(--muted)] sm:text-base">
                  {captaincy.best_captain.player.team} · {captaincy.best_captain.player.position}
                </p>
                <p className="mt-4 max-w-2xl text-sm font-semibold leading-6 text-[var(--ink-soft)]">
                  {captaincy.why_this_captain[0] ??
                    "The strongest blend of projection, fixture quality, ceiling and expected minutes in your current squad."}
                </p>
              </div>
            </div>

            <div className="mt-7 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              <MetricTile
                label="Projected"
                value={`${formatPoints(captaincy.best_captain.projected_points)} pts`}
                detail="single-gameweek"
                tone="green"
              />
              <MetricTile
                label="Ceiling"
                value={captaincy.best_captain.ceiling != null ? formatPoints(captaincy.best_captain.ceiling, 0) : "—"}
                detail="upside outcome"
                tone="purple"
              />
              <MetricTile
                label="Safety"
                value={captaincy.best_captain.safety != null ? String(captaincy.best_captain.safety) : "—"}
                detail="reliability"
              />
              <MetricTile
                label="Minutes"
                value={String(captaincy.best_captain.minutes_risk)}
                detail="rotation exposure"
                tone="amber"
              />
            </div>
          </div>

          <div className="border-t border-[var(--border-soft)] bg-[var(--surface)]/70 p-5 backdrop-blur-sm sm:p-7 xl:border-l xl:border-t-0">
            <ViceCaptainPanel option={captaincy.vice_captain} />

            <div className="mt-4 rounded-[22px] border border-[var(--border-soft)] bg-[var(--surface)] p-4 sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--muted)]">Decision confidence</p>
                  <p className="mt-1 text-lg font-black text-[var(--ink)]">{captaincy.best_captain.confidence}</p>
                </div>
                <span className="text-2xl font-black text-[var(--accent)]">
                  {Math.round(optionScore(captaincy.best_captain, maxProjection))}%
                </span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--border-soft)]">
                <div
                  className="h-full rounded-full bg-[linear-gradient(90deg,var(--accent),var(--accent-2))]"
                  style={{ width: `${optionScore(captaincy.best_captain, maxProjection)}%` }}
                />
              </div>
              <p className="mt-3 text-xs font-semibold leading-5 text-[var(--muted)]">
                Relative strength against the other captain candidates in this squad.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className={cardShell}>
        <div className="flex flex-col gap-2 border-b border-[var(--border-soft)] p-5 sm:flex-row sm:items-end sm:justify-between sm:p-6">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.15em] text-[var(--accent)]">Captaincy shortlist</p>
            <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-[var(--ink)]">Top five armband options</h2>
          </div>
          <p className="text-xs font-semibold text-[var(--muted)]">Ranked by projection, ceiling, safety and minutes security</p>
        </div>

        <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5 sm:p-6">
          {shortlist.map((option, index) => (
            <CaptainOptionCard
              key={option.player.id}
              option={option}
              rank={index + 1}
              maxProjection={maxProjection}
              featured={option.player.id === captaincy.best_captain.player.id}
            />
          ))}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <InsightPanel
          eyebrow="Strategy"
          title="Ceiling versus safety"
          body={captaincy.ceiling_vs_safety}
          tone="purple"
        />
        <InsightPanel
          eyebrow="Availability"
          title="Minutes and rotation risk"
          body={captaincy.minutes_risk_summary}
          tone="amber"
        />
        <InsightPanel
          eyebrow="Fixture"
          title="Opponent difficulty"
          body={captaincy.fixture_difficulty_summary}
          tone="green"
        />
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <article className={`${cardShell} p-5 sm:p-6`}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--success)]">Supporting evidence</p>
              <h2 className="mt-2 text-xl font-black tracking-[-0.025em] text-[var(--ink)]">Why the model backs this captain</h2>
            </div>
            <span className="rounded-full bg-[var(--success-soft)] px-3 py-1 text-xs font-black text-[var(--success)]">
              {captaincy.why_this_captain.length} signals
            </span>
          </div>

          <div className="mt-5 space-y-3">
            {captaincy.why_this_captain.map((item, index) => (
              <div key={`${item}-${index}`} className="flex gap-3 rounded-2xl border border-[var(--success-soft)] bg-[var(--success-soft)] p-4">
                <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--success-soft)] text-[var(--success)]">
                  <CheckIcon />
                </span>
                <p className="text-sm font-semibold leading-6 text-[var(--ink-soft)]">{item}</p>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-[24px] border border-[var(--warning-border)] bg-[var(--warning-soft)] p-5 shadow-[0_18px_50px_rgba(92,57,0,0.055)] sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--warning)]">Downside check</p>
              <h2 className="mt-2 text-xl font-black tracking-[-0.025em] text-[var(--warning)]">What could go wrong</h2>
            </div>
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--warning-border)] text-[var(--warning)]">
              <WarningIcon />
            </span>
          </div>

          <div className="mt-5 space-y-3">
            {captaincy.what_could_go_wrong.map((item, index) => (
              <div key={`${item}-${index}`} className="flex gap-3 rounded-2xl border border-[var(--warning-border)] bg-[var(--surface)]/55 p-4">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--warning)]" />
                <p className="text-sm font-semibold leading-6 text-[var(--warning)]">{item}</p>
              </div>
            ))}
          </div>
        </article>
      </section>
    </div>
  );
}