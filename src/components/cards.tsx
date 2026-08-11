"use client";

import type { BestMove, MarketSignal, Player, PricingTier, SquadHealth, TransferRoute } from "@/lib/types";
import { ConfidenceBadge, RiskBadge, SignalBadge } from "./badges";
import { FixturePill, MiniTrend, NativeMetric, RiskText, formatPrice } from "./fpl-ui";
import { usePlayerDetail } from "./player-detail-modal";
import { PlayerVisual } from "./player-visual";
import { TrustWarning } from "./states";

const card = "rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] shadow-[0_18px_45px_rgba(55,0,60,0.08)]";

export function StatCard({ label, value, detail, tone = "cyan" }: { label: string; value: string; detail: string; tone?: "cyan" | "green" | "amber" | "red" }) {
  const tones = {
    cyan: "text-[var(--info)]",
    green: "text-[var(--success)]",
    amber: "text-[var(--warning)]",
    red: "text-[var(--danger)]",
  };
  return (
    <section className={`${card} h-full p-4`}>
      <p className="text-[11px] font-black uppercase tracking-[0.12em] text-[var(--muted)]">{label}</p>
      <p className={`mt-3 text-2xl font-black ${tones[tone]}`}>{value}</p>
      <p className="mt-2 text-sm font-medium text-[var(--muted)]">{detail}</p>
    </section>
  );
}

export function BestMoveCard({ move, captain, gameweekLabel = "GW" }: { move: BestMove; captain?: Player; gameweekLabel?: string }) {
  return (
    <section className={`${card} h-full overflow-hidden`}>
      <div className="relative overflow-hidden bg-[var(--surface-2)] p-5 sm:p-6">
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(108,29,255,0.08)_1px,transparent_1px),linear-gradient(rgba(108,29,255,0.08)_1px,transparent_1px)] bg-[length:48px_48px]" />
        <div className="absolute right-8 top-1/2 h-44 w-44 -translate-y-1/2 rounded-full border-2 border-[var(--accent)]/10" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 gap-4">
            <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-[var(--accent)] text-lg font-black text-white shadow-[0_16px_28px_rgba(108,29,255,0.25)] sm:h-16 sm:w-16">
              {gameweekLabel}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--accent)] sm:text-sm">This Gameweek&apos;s Best Move</p>
              <h2 className="mt-1 text-3xl font-black tracking-tight text-[var(--ink)] sm:text-4xl">{move.move}</h2>
              <div className="mt-3 flex gap-2 sm:hidden">
                <ConfidenceBadge value={move.confidence_band} />
                <RiskBadge value={move.risk_level} />
              </div>
            </div>
          </div>
          <div className="hidden shrink-0 gap-2 sm:flex">
            <ConfidenceBadge value={move.confidence_band} />
            <RiskBadge value={move.risk_level} />
          </div>
        </div>
      </div>
      <div className="grid gap-4 p-5 sm:p-6 2xl:grid-cols-[1fr_1.05fr]">
        <div className="grid gap-3 min-[520px]:grid-cols-2">
          <NativeMetric label="Recommended action" value={move.recommended_action} tone="purple" />
          <NativeMetric label="Expected gain" value={`+${move.expected_gain} pts`} tone="green" />
          <NativeMetric label="Confidence" value={move.confidence_band} tone="cyan" />
          <NativeMetric label="Risk" value={move.risk_level} tone={move.risk_level === "Low" ? "green" : "amber"} />
          <div className="min-[520px]:col-span-2 rounded-xl border border-[var(--border-soft)] bg-[var(--surface)]/78 p-4">
            <p className="text-[11px] font-black uppercase tracking-[0.12em] text-[var(--muted)]">Captain pick</p>
            <div className="mt-3 flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                {captain ? <PlayerVisual player={captain} size="md" /> : null}
                <div className="min-w-0">
                  <p className="truncate text-xl font-black text-[var(--ink)]">{captain?.name ?? "Unavailable"}</p>
                  <p className="text-sm font-bold text-[var(--muted)]">{captain ? `${captain.team} / ${captain.position}` : "Captain pending"}</p>
                </div>
              </div>
              {captain?.fixture ? <FixturePill fixture={captain.fixture} difficulty={captain.fixture_difficulty ?? 3} /> : <span className="rounded-full bg-[var(--surface-2)] px-2.5 py-1 text-[11px] font-black text-[var(--muted)]">TBC</span>}
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-[var(--border-soft)] p-5">
          <h3 className="text-lg font-black text-[var(--ink)]">Why?</h3>
          <ul className="mt-3 space-y-3 text-sm font-semibold text-[var(--ink-soft)]">
            {move.why.map((item) => <li key={item} className="flex gap-3"><span className="text-[var(--accent)]">-</span>{item}</li>)}
          </ul>
        </div>
      </div>
      <div className="px-5 pb-5 sm:px-6 sm:pb-6">
        <div className="rounded-xl border border-[var(--warning-border)] bg-[var(--warning-soft)] p-4">
          <h3 className="text-sm font-black text-[var(--warning)]">What could go wrong?</h3>
          <p className="mt-2 text-sm font-medium text-[var(--warning)]">{move.why_this_could_be_wrong.join(" ")}</p>
        </div>
        <div className="mt-3"><TrustWarning show={move.fallback_used} reason={move.fallback_reason} /></div>
      </div>
    </section>
  );
}

export function PlayerCard({ player, compact = false, loading = false }: { player: Player; compact?: boolean; loading?: boolean }) {
  // `loading` is for the narrow window right after import where the real per-player analysis
  // hasn't resolved yet - the caller is still showing the raw imported squad (real names/photos)
  // but has no real projected/ownership numbers to merge in yet. Showing "..." here instead of a
  // confident-looking "0.0 pts / 0% owned" is the whole fix: a real player with a 0 stops reading
  // as broken/mock data once it's honest about still being unresolved.
  // team_has_fixture === false is a DIFFERENT, stable case (not a loading state): the player's
  // real club has zero fixtures in the loaded calendar (e.g. relegated) - the 0 is real and final,
  // just needs an honest reason instead of looking like a broken/missing calculation.
  const noFixtureData = !loading && player.team_has_fixture === false;
  const projLabel = loading ? "…" : noFixtureData ? "—" : player.projected;
  const ownedLabel = loading ? "…" : `${player.ownership}%`;
  const { open } = usePlayerDetail();
  return (
    <button type="button" onClick={() => open(player)} className={`${card} h-full w-full p-4 text-left transition hover:-translate-y-0.5 hover:shadow-[0_22px_50px_rgba(55,0,60,0.12)]`}>
      <div className="flex items-center gap-4">
        <PlayerVisual player={player} size={compact ? "sm" : "md"} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-lg font-black text-[var(--ink)]">{player.name}</h3>
          <p className="text-sm font-bold text-[var(--muted)]">{player.position} / {player.team}</p>
        </div>
        <RiskBadge value={player.risk} />
      </div>
      {!compact ? (
        <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl bg-[var(--surface-2)] p-3 text-sm">
          <div><span className="block text-xs font-bold text-[var(--muted)]">Price</span><span className="font-black text-[var(--ink)]">{formatPrice(player.price)}</span></div>
          <div><span className="block text-xs font-bold text-[var(--muted)]">Proj</span><span className="font-black text-[var(--ink)]">{projLabel}</span></div>
          <div><span className="block text-xs font-bold text-[var(--muted)]">Owned</span><span className="font-black text-[var(--ink)]">{ownedLabel}</span></div>
        </div>
      ) : (
        // Compact (bench) cards still surface proj/ownership, just at a smaller two-up size -
        // price and fixture stay hidden here to keep the card genuinely compact.
        <div className="mt-3 grid grid-cols-2 gap-2 rounded-lg bg-[var(--surface-2)] p-2 text-xs">
          <div><span className="block text-[10px] font-bold text-[var(--muted)]">Proj</span><span className="font-black text-[var(--ink)]">{projLabel}</span></div>
          <div><span className="block text-[10px] font-bold text-[var(--muted)]">Owned</span><span className="font-black text-[var(--ink)]">{ownedLabel}</span></div>
        </div>
      )}
      {noFixtureData ? (
        <p className="mt-3 text-xs font-bold text-[var(--warning)]">No fixture this season - {player.team} is not in the loaded league calendar.</p>
      ) : !compact ? (
        <div className="mt-3"><FixturePill fixture={player.fixture} difficulty={player.fixture_difficulty} /></div>
      ) : null}
      {player.role ? <p className="mt-3 text-sm font-bold text-[var(--accent)]">{player.role}</p> : null}
    </button>
  );
}

export function SquadHealthCard({ health, compact = false }: { health: SquadHealth; compact?: boolean }) {
  return (
    <section className={`${card} h-full p-5`}>
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-black text-[var(--accent)]">Squad Health</p>
          <h2 className="mt-2 text-3xl font-black text-[var(--success)]">{health.grade}</h2>
          <p className="mt-1 text-sm font-semibold text-[var(--muted)]">
            {health.weak_bench_alerts.length} minor {health.weak_bench_alerts.length === 1 ? "issue" : "issues"}
          </p>
        </div>
        <div className="grid h-20 w-20 shrink-0 place-items-center rounded-full bg-[conic-gradient(var(--success)_0_78%,var(--border-soft)_78%_100%)] sm:h-24 sm:w-24">
          <div className="grid h-14 w-14 place-items-center rounded-full bg-[var(--surface)] text-lg font-black text-[var(--ink)] sm:h-16 sm:w-16 sm:text-xl">{health.score != null ? `${health.score}%` : "—"}</div>
        </div>
      </div>
      {compact ? (
        <div className="mt-5 space-y-2">
          <div className="flex items-center justify-between rounded-lg bg-[var(--surface-2)] px-3 py-2 text-sm font-bold">
            <span className="text-[var(--muted)]">Minutes Risk</span>
            <span className="text-[var(--warning)]">{health.minutes_risk != null ? `${health.minutes_risk}%` : "—"}</span>
          </div>
          <div className="flex items-center justify-between rounded-lg bg-[var(--surface-2)] px-3 py-2 text-sm font-bold">
            <span className="text-[var(--muted)]">Captaincy Edge</span>
            <span className="text-[var(--success)]">{health.captaincy_strength}</span>
          </div>
        </div>
      ) : (
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <StatCard label="Minutes risk" value={health.minutes_risk != null ? `${health.minutes_risk}%` : "—"} detail="Rotation pressure" tone="amber" />
          <StatCard label="Status risk" value={health.injury_risk != null ? `${health.injury_risk}%` : "—"} detail="Flags and doubts" tone="red" />
          <StatCard label="Captaincy" value={health.captaincy_strength} detail="Armband strength" tone="green" />
        </div>
      )}
    </section>
  );
}

export function TransferRouteCard({ route }: { route: TransferRoute }) {
  return (
    <article className={`${card} h-full overflow-hidden`}>
      <div className="flex items-start justify-between gap-3 border-b border-[var(--border-soft)] bg-[var(--surface-2)] p-5">
        <div className="min-w-0">
          <p className="text-sm font-black text-[var(--accent)]">{route.title}</p>
          <h3 className="mt-2 text-2xl font-black text-[var(--ink)]">{route.move}</h3>
        </div>
        <div className="flex shrink-0 gap-2"><ConfidenceBadge value={route.confidence} /><RiskBadge value={route.risk} /></div>
      </div>
      <div className="p-5">
        <p className="text-3xl font-black text-[var(--success)]">+{route.expected_gain} pts</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div><h4 className="text-sm font-black text-[var(--ink)]">Why?</h4><p className="mt-2 text-sm font-semibold text-[var(--ink-soft)]">{route.why[0]}</p></div>
          <div><h4 className="text-sm font-black text-[var(--danger)]">What could go wrong?</h4><p className="mt-2 text-sm font-semibold text-[var(--danger)]">{route.why_this_could_be_wrong[0]}</p></div>
        </div>
      </div>
    </article>
  );
}

export function MarketSignalCard({ signal }: { signal: MarketSignal }) {
  const { open } = usePlayerDetail();
  return (
    <button type="button" onClick={() => open(signal.player)} className={`${card} h-full w-full p-4 text-left transition hover:-translate-y-0.5 hover:shadow-[0_22px_50px_rgba(55,0,60,0.12)]`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <PlayerVisual player={signal.player} size="sm" />
          <div className="min-w-0">
            <h3 className="text-sm font-black leading-tight text-[var(--ink)] sm:text-base">{signal.player.name}</h3>
            <p className="text-sm font-bold text-[var(--muted)]">{signal.player.team} / {signal.player.position}</p>
          </div>
        </div>
        <SignalBadge value={signal.signal} />
      </div>
      <p className="mt-4 text-sm font-semibold text-[var(--ink-soft)]">{signal.reason}</p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <FixturePill fixture={signal.player.fixture} difficulty={signal.player.fixture_difficulty} />
        <span className="rounded-full bg-[var(--surface-2)] px-2.5 py-1 text-[11px] font-black text-[var(--ink)]">
          {signal.player.projected.toFixed(1)} pts
        </span>
        <span className="rounded-full bg-[var(--surface-2)] px-2.5 py-1 text-[11px] font-black text-[var(--ink)]">
          {signal.player.ownership}% own
        </span>
      </div>
      {signal.score != null ? (
        <div className="mt-4 h-2 rounded-full bg-[var(--border-soft)]"><div className="h-2 rounded-full bg-[var(--accent)]" style={{ width: `${signal.score}%` }} /></div>
      ) : (
        <p className="mt-4 text-xs font-semibold text-[var(--muted)]">Score unavailable</p>
      )}
    </button>
  );
}

export function MarketRow({ signal }: { signal: MarketSignal }) {
  const player = signal.player;
  return (
    <article className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] p-3 shadow-sm">
      <div className="flex items-center gap-3">
        <PlayerVisual player={player} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="font-black leading-tight text-[var(--ink)]">{player.name}</p>
          <p className="text-xs font-bold text-[var(--muted)]">{player.team} / {player.position}</p>
        </div>
        <MiniTrend trend={player.trend} />
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
        <div><p className="font-bold text-[var(--muted)]">Price</p><p className="font-black">{formatPrice(player.price)}</p></div>
        <div><p className="font-bold text-[var(--muted)]">Owned</p><p className="font-black">{player.ownership}%</p></div>
        <div><p className="font-bold text-[var(--muted)]">Form</p><p className="font-black">{player.form}</p></div>
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        <FixturePill fixture={player.fixture} difficulty={player.fixture_difficulty} />
        <span className="text-sm font-black text-[var(--success)]">{player.projected.toFixed(1)} pts</span>
      </div>
    </article>
  );
}

export function TransferPlayerCard({ player, label }: { player: Player; label: "Player Out" | "Player In" }) {
  return (
    <article className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] p-4">
      <p className={`text-xs font-black uppercase tracking-[0.14em] ${label === "Player In" ? "text-[var(--success)]" : "text-[var(--danger)]"}`}>{label}</p>
      <div className="mt-3 flex items-center gap-3">
        <PlayerVisual player={player} size="lg" />
        <div className="min-w-0">
          <h3 className="truncate text-xl font-black text-[var(--ink)]">{player.name}</h3>
          <p className="text-sm font-bold text-[var(--muted)]">{player.position} / {player.team} / {formatPrice(player.price)}</p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-lg bg-[var(--surface-2)] p-2"><p className="text-xs font-bold text-[var(--muted)]">3-GW Proj</p><p className="font-black">{player.three_gw_projected}</p></div>
        <div className="rounded-lg bg-[var(--surface-2)] p-2"><p className="text-xs font-bold text-[var(--muted)]">Owned</p><p className="font-black">{player.ownership}%</p></div>
        <div className="rounded-lg bg-[var(--surface-2)] p-2"><p className="text-xs font-bold text-[var(--muted)]">Form</p><p className="font-black">{player.form}</p></div>
        <div className="rounded-lg bg-[var(--surface-2)] p-2"><p className="text-xs font-bold text-[var(--muted)]">Risk</p><RiskText value={player.risk} /></div>
      </div>
      <div className="mt-3"><FixturePill fixture={player.fixture} difficulty={player.fixture_difficulty} /></div>
    </article>
  );
}

export function PricingCard({ tier }: { tier: PricingTier }) {
  return (
    <article className={`rounded-2xl border p-6 shadow-[0_18px_45px_rgba(55,0,60,0.08)] ${tier.highlight ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "border-[var(--border-soft)] bg-[var(--surface)]"}`}>
      <h3 className="text-2xl font-black text-[var(--ink)]">{tier.name}</h3>
      <p className="mt-2 text-4xl font-black text-[var(--accent)]">{tier.price}</p>
      <p className="mt-2 text-sm font-semibold text-[var(--muted)]">{tier.summary}</p>
      <ul className="mt-5 space-y-2 text-sm font-semibold text-[var(--ink-soft)]">
        {tier.features.map((feature) => <li key={feature}>- {feature}</li>)}
      </ul>
    </article>
  );
}
