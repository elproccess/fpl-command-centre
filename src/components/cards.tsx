import type { BestMove, MarketSignal, Player, PricingTier, SquadHealth, TransferRoute } from "@/lib/types";
import { ConfidenceBadge, RiskBadge, SignalBadge } from "./badges";
import { FixturePill, MiniTrend, NativeMetric, RiskText, formatPrice } from "./fpl-ui";
import { PlayerVisual } from "./player-visual";
import { TrustWarning } from "./states";

const card = "rounded-2xl border border-[#E8DEF8] bg-white shadow-[0_18px_45px_rgba(55,0,60,0.08)]";

export function StatCard({ label, value, detail, tone = "cyan" }: { label: string; value: string; detail: string; tone?: "cyan" | "green" | "amber" | "red" }) {
  const tones = {
    cyan: "text-[#00B8FF]",
    green: "text-[#00A844]",
    amber: "text-[#B97800]",
    red: "text-[#E90052]",
  };
  return (
    <section className={`${card} h-full p-4`}>
      <p className="text-[11px] font-black uppercase tracking-[0.12em] text-[#7B688E]">{label}</p>
      <p className={`mt-3 text-2xl font-black ${tones[tone]}`}>{value}</p>
      <p className="mt-2 text-sm font-medium text-[#5D4A70]">{detail}</p>
    </section>
  );
}

export function BestMoveCard({ move, captain, gameweekLabel = "GW" }: { move: BestMove; captain?: Player; gameweekLabel?: string }) {
  return (
    <section className={`${card} h-full overflow-hidden`}>
      <div className="relative overflow-hidden bg-[#F8F5FF] p-5 sm:p-6">
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(108,29,255,0.08)_1px,transparent_1px),linear-gradient(rgba(108,29,255,0.08)_1px,transparent_1px)] bg-[length:48px_48px]" />
        <div className="absolute right-8 top-1/2 h-44 w-44 -translate-y-1/2 rounded-full border-2 border-[#6C1DFF]/10" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 gap-4">
            <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-[#6C1DFF] text-lg font-black text-white shadow-[0_16px_28px_rgba(108,29,255,0.25)] sm:h-16 sm:w-16">
              {gameweekLabel}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-[#6C1DFF] sm:text-sm">This Gameweek&apos;s Best Move</p>
              <h2 className="mt-1 text-3xl font-black tracking-tight text-[#17002F] sm:text-4xl">{move.move}</h2>
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
          <div className="min-[520px]:col-span-2 rounded-xl border border-[#E8DEF8] bg-white/78 p-4">
            <p className="text-[11px] font-black uppercase tracking-[0.12em] text-[#7B688E]">Captain pick</p>
            <div className="mt-3 flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                {captain ? <PlayerVisual player={captain} size="md" /> : null}
                <div className="min-w-0">
                  <p className="truncate text-xl font-black text-[#17002F]">{captain?.name ?? "Unavailable"}</p>
                  <p className="text-sm font-bold text-[#5D4A70]">{captain ? `${captain.team} / ${captain.position}` : "Captain pending"}</p>
                </div>
              </div>
              {captain?.fixture ? <FixturePill fixture={captain.fixture} difficulty={captain.fixture_difficulty ?? 3} /> : <span className="rounded-full bg-[#F8F5FF] px-2.5 py-1 text-[11px] font-black text-[#7B688E]">TBC</span>}
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-[#E8DEF8] p-5">
          <h3 className="text-lg font-black text-[#17002F]">Why?</h3>
          <ul className="mt-3 space-y-3 text-sm font-semibold text-[#3C2752]">
            {move.why.map((item) => <li key={item} className="flex gap-3"><span className="text-[#6C1DFF]">-</span>{item}</li>)}
          </ul>
        </div>
      </div>
      <div className="px-5 pb-5 sm:px-6 sm:pb-6">
        <div className="rounded-xl border border-[#FFB800]/35 bg-[#FFB800]/10 p-4">
          <h3 className="text-sm font-black text-[#7A5200]">What could go wrong?</h3>
          <p className="mt-2 text-sm font-medium text-[#6D4B00]">{move.why_this_could_be_wrong.join(" ")}</p>
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
  return (
    <article className={`${card} h-full p-4`}>
      <div className="flex items-center gap-4">
        <PlayerVisual player={player} size={compact ? "sm" : "md"} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-lg font-black text-[#17002F]">{player.name}</h3>
          <p className="text-sm font-bold text-[#5D4A70]">{player.position} / {player.team}</p>
        </div>
        <RiskBadge value={player.risk} />
      </div>
      {!compact ? (
        <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl bg-[#F8F5FF] p-3 text-sm">
          <div><span className="block text-xs font-bold text-[#7B688E]">Price</span><span className="font-black text-[#17002F]">{formatPrice(player.price)}</span></div>
          <div><span className="block text-xs font-bold text-[#7B688E]">Proj</span><span className="font-black text-[#17002F]">{projLabel}</span></div>
          <div><span className="block text-xs font-bold text-[#7B688E]">Owned</span><span className="font-black text-[#17002F]">{ownedLabel}</span></div>
        </div>
      ) : (
        // Compact (bench) cards still surface proj/ownership, just at a smaller two-up size -
        // price and fixture stay hidden here to keep the card genuinely compact.
        <div className="mt-3 grid grid-cols-2 gap-2 rounded-lg bg-[#F8F5FF] p-2 text-xs">
          <div><span className="block text-[10px] font-bold text-[#7B688E]">Proj</span><span className="font-black text-[#17002F]">{projLabel}</span></div>
          <div><span className="block text-[10px] font-bold text-[#7B688E]">Owned</span><span className="font-black text-[#17002F]">{ownedLabel}</span></div>
        </div>
      )}
      {noFixtureData ? (
        <p className="mt-3 text-xs font-bold text-[#B97800]">No fixture this season - {player.team} is not in the loaded league calendar.</p>
      ) : !compact ? (
        <div className="mt-3"><FixturePill fixture={player.fixture} difficulty={player.fixture_difficulty} /></div>
      ) : null}
      {player.role ? <p className="mt-3 text-sm font-bold text-[#6C1DFF]">{player.role}</p> : null}
    </article>
  );
}

export function SquadHealthCard({ health, compact = false }: { health: SquadHealth; compact?: boolean }) {
  return (
    <section className={`${card} h-full p-5`}>
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-black text-[#6C1DFF]">Squad Health</p>
          <h2 className="mt-2 text-3xl font-black text-[#00A844]">{health.grade}</h2>
          <p className="mt-1 text-sm font-semibold text-[#5D4A70]">
            {health.weak_bench_alerts.length} minor {health.weak_bench_alerts.length === 1 ? "issue" : "issues"}
          </p>
        </div>
        <div className="grid h-20 w-20 shrink-0 place-items-center rounded-full bg-[conic-gradient(#00C853_0_78%,#E8DEF8_78%_100%)] sm:h-24 sm:w-24">
          <div className="grid h-14 w-14 place-items-center rounded-full bg-white text-lg font-black text-[#17002F] sm:h-16 sm:w-16 sm:text-xl">{health.score != null ? `${health.score}%` : "—"}</div>
        </div>
      </div>
      {compact ? (
        <div className="mt-5 space-y-2">
          <div className="flex items-center justify-between rounded-lg bg-[#F8F5FF] px-3 py-2 text-sm font-bold">
            <span className="text-[#5D4A70]">Minutes Risk</span>
            <span className="text-[#B97800]">{health.minutes_risk != null ? `${health.minutes_risk}%` : "—"}</span>
          </div>
          <div className="flex items-center justify-between rounded-lg bg-[#F8F5FF] px-3 py-2 text-sm font-bold">
            <span className="text-[#5D4A70]">Captaincy Edge</span>
            <span className="text-[#00A844]">{health.captaincy_strength}</span>
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
      <div className="flex items-start justify-between gap-3 border-b border-[#E8DEF8] bg-[#F8F5FF] p-5">
        <div className="min-w-0">
          <p className="text-sm font-black text-[#6C1DFF]">{route.title}</p>
          <h3 className="mt-2 text-2xl font-black text-[#17002F]">{route.move}</h3>
        </div>
        <div className="flex shrink-0 gap-2"><ConfidenceBadge value={route.confidence} /><RiskBadge value={route.risk} /></div>
      </div>
      <div className="p-5">
        <p className="text-3xl font-black text-[#00A844]">+{route.expected_gain} pts</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div><h4 className="text-sm font-black text-[#17002F]">Why?</h4><p className="mt-2 text-sm font-semibold text-[#3C2752]">{route.why[0]}</p></div>
          <div><h4 className="text-sm font-black text-[#E90052]">What could go wrong?</h4><p className="mt-2 text-sm font-semibold text-[#6D4560]">{route.why_this_could_be_wrong[0]}</p></div>
        </div>
      </div>
    </article>
  );
}

export function MarketSignalCard({ signal }: { signal: MarketSignal }) {
  return (
    <article className={`${card} h-full p-4`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <PlayerVisual player={signal.player} size="sm" />
          <div className="min-w-0">
            <h3 className="text-sm font-black leading-tight text-[#17002F] sm:text-base">{signal.player.name}</h3>
            <p className="text-sm font-bold text-[#5D4A70]">{signal.player.team} / {signal.player.position}</p>
          </div>
        </div>
        <SignalBadge value={signal.signal} />
      </div>
      <p className="mt-4 text-sm font-semibold text-[#3C2752]">{signal.reason}</p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <FixturePill fixture={signal.player.fixture} difficulty={signal.player.fixture_difficulty} />
        <span className="rounded-full bg-[#F8F5FF] px-2.5 py-1 text-[11px] font-black text-[#37003C]">
          {signal.player.projected.toFixed(1)} pts
        </span>
        <span className="rounded-full bg-[#F8F5FF] px-2.5 py-1 text-[11px] font-black text-[#37003C]">
          {signal.player.ownership}% own
        </span>
      </div>
      {signal.score != null ? (
        <div className="mt-4 h-2 rounded-full bg-[#E8DEF8]"><div className="h-2 rounded-full bg-[#6C1DFF]" style={{ width: `${signal.score}%` }} /></div>
      ) : (
        <p className="mt-4 text-xs font-semibold text-[#7B688E]">Score unavailable</p>
      )}
    </article>
  );
}

export function MarketRow({ signal }: { signal: MarketSignal }) {
  const player = signal.player;
  return (
    <article className="rounded-xl border border-[#E8DEF8] bg-white p-3 shadow-sm">
      <div className="flex items-center gap-3">
        <PlayerVisual player={player} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="font-black leading-tight text-[#17002F]">{player.name}</p>
          <p className="text-xs font-bold text-[#5D4A70]">{player.team} / {player.position}</p>
        </div>
        <MiniTrend trend={player.trend} />
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
        <div><p className="font-bold text-[#7B688E]">Price</p><p className="font-black">{formatPrice(player.price)}</p></div>
        <div><p className="font-bold text-[#7B688E]">Owned</p><p className="font-black">{player.ownership}%</p></div>
        <div><p className="font-bold text-[#7B688E]">Form</p><p className="font-black">{player.form}</p></div>
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        <FixturePill fixture={player.fixture} difficulty={player.fixture_difficulty} />
        <span className="text-sm font-black text-[#00A844]">{player.projected.toFixed(1)} pts</span>
      </div>
    </article>
  );
}

export function TransferPlayerCard({ player, label }: { player: Player; label: "Player Out" | "Player In" }) {
  return (
    <article className="rounded-xl border border-[#E8DEF8] bg-white p-4">
      <p className={`text-xs font-black uppercase tracking-[0.14em] ${label === "Player In" ? "text-[#00A844]" : "text-[#E90052]"}`}>{label}</p>
      <div className="mt-3 flex items-center gap-3">
        <PlayerVisual player={player} size="lg" />
        <div className="min-w-0">
          <h3 className="truncate text-xl font-black text-[#17002F]">{player.name}</h3>
          <p className="text-sm font-bold text-[#5D4A70]">{player.position} / {player.team} / {formatPrice(player.price)}</p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-lg bg-[#F8F5FF] p-2"><p className="text-xs font-bold text-[#7B688E]">3-GW Proj</p><p className="font-black">{player.three_gw_projected}</p></div>
        <div className="rounded-lg bg-[#F8F5FF] p-2"><p className="text-xs font-bold text-[#7B688E]">Owned</p><p className="font-black">{player.ownership}%</p></div>
        <div className="rounded-lg bg-[#F8F5FF] p-2"><p className="text-xs font-bold text-[#7B688E]">Form</p><p className="font-black">{player.form}</p></div>
        <div className="rounded-lg bg-[#F8F5FF] p-2"><p className="text-xs font-bold text-[#7B688E]">Risk</p><RiskText value={player.risk} /></div>
      </div>
      <div className="mt-3"><FixturePill fixture={player.fixture} difficulty={player.fixture_difficulty} /></div>
    </article>
  );
}

export function PricingCard({ tier }: { tier: PricingTier }) {
  return (
    <article className={`rounded-2xl border p-6 shadow-[0_18px_45px_rgba(55,0,60,0.08)] ${tier.highlight ? "border-[#6C1DFF] bg-[#F1E8FF]" : "border-[#E8DEF8] bg-white"}`}>
      <h3 className="text-2xl font-black text-[#17002F]">{tier.name}</h3>
      <p className="mt-2 text-4xl font-black text-[#6C1DFF]">{tier.price}</p>
      <p className="mt-2 text-sm font-semibold text-[#5D4A70]">{tier.summary}</p>
      <ul className="mt-5 space-y-2 text-sm font-semibold text-[#3C2752]">
        {tier.features.map((feature) => <li key={feature}>- {feature}</li>)}
      </ul>
    </article>
  );
}
