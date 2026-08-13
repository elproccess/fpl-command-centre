"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { SignalBadge } from "@/components/badges";
import { CompareAnyTwoPlayers } from "@/components/compare-any-two-players";
import { FixturePill, formatPrice } from "@/components/fpl-ui";
import { PlayerVisual } from "@/components/player-visual";
import { StillComputingPanel, usePolledAnalysis } from "@/components/polled-analysis";
import { ErrorState } from "@/components/states";
import {
  analyseStockMarketSquad,
  getMarketBoard,
  getPlayerExplorer,
  getPlayersDirectory,
  type ExplorerPlayer,
  type PlayerDirectoryEntry,
  type PlayerExplorerData,
} from "@/lib/api";
import type { MarketBoard, MarketSignal, Player } from "@/lib/types";

const SIGNAL_ORDER: Record<MarketSignal["signal"], number> = {
  Buy: 6,
  Watch: 5,
  Hold: 4,
  Sell: 2,
  Avoid: 1,
  // Ranks below every real signal (including Watch) in a merge tie-break - a genuine "no strong
  // call" verdict on a real player always wins over "no real claim on minutes yet" if a player
  // somehow appears under both.
  Bench: 0,
};

const POSITIONS = ["All", "GK", "DEF", "MID", "FWD"] as const;

// Tabs re-slice ONE underlying table instead of swapping to a second, differently-shaped list -
// "Sell/Avoid" is deliberately one tab even though the two are distinct badges, because the
// player is asking the same question either way ("who's a risk right now").
const VIEW_TABS = ["All", "Buy", "Watch", "Sell/Avoid", "Rising", "Falling", "My Squad"] as const;

const PRICE_OPTIONS = [
  { value: 0, label: "Any price" },
  { value: 4.5, label: "Under £4.5m" },
  { value: 5, label: "Under £5.0m" },
  { value: 5.5, label: "Under £5.5m" },
  { value: 6, label: "Under £6.0m" },
  { value: 6.5, label: "Under £6.5m" },
  { value: 7.5, label: "Under £7.5m" },
  { value: 8.5, label: "Under £8.5m" },
  { value: 10, label: "Under £10.0m" },
  { value: 12, label: "Under £12.0m" },
];

const MIN_PRICE_OPTIONS = [
  { value: 0, label: "Any price" },
  { value: 4.5, label: "Over £4.5m" },
  { value: 5, label: "Over £5.0m" },
  { value: 5.5, label: "Over £5.5m" },
  { value: 6, label: "Over £6.0m" },
  { value: 6.5, label: "Over £6.5m" },
  { value: 7.5, label: "Over £7.5m" },
  { value: 8.5, label: "Over £8.5m" },
  { value: 10, label: "Over £10.0m" },
];

const PAGE_SIZE = 30;

type PositionFilter = (typeof POSITIONS)[number];
type ViewTab = (typeof VIEW_TABS)[number];
type RowSortKey = "horizon" | "next" | "value" | "score" | "form" | "movement" | "price" | "ownership";
type SortDirection = "asc" | "desc";

// One row per real player, always present for the whole pool (explorer fields) - signal/score/
// thesis/trend/form/movement/fixture are attached when the market engine has ranked that player,
// and left null otherwise. This is what lets a single table answer both "best under £6.0m" (every
// row has price+projection) and "what does the market think of him" (only ranked rows have this).
type MarketRow = {
  id: number;
  code: number | null;
  name: string;
  team: string;
  team_id: number;
  position: "GK" | "DEF" | "MID" | "FWD";
  price: number;
  ownership: number;
  status: Player["status"];
  projections: Record<string, number>;
  next_projected: number;
  horizon_projected: number;
  value_per_million: number;
  signal: MarketSignal["signal"] | null;
  score: number | null;
  reason: string | null;
  trend: Player["trend"] | null;
  price_movement: number | null;
  form: number | null;
  three_gw_projected: number | null;
  fixture: string | null;
  fixture_difficulty: Player["fixture_difficulty"] | null;
};

function numberValue(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function formatProjection(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value.toFixed(1) : "—";
}

function formatMovement(value: number | null | undefined) {
  if (value == null) return "—";
  const movement = numberValue(value);
  if (movement === 0) return "—";
  const normalized = Math.abs(movement) >= 1 ? movement / 10 : movement;
  return `${normalized > 0 ? "+" : ""}£${normalized.toFixed(1)}`;
}

function statusTone(status: Player["status"]) {
  if (status === "Injured" || status === "Suspended") return "bg-[var(--danger-soft)] text-[var(--danger)]";
  if (status === "Doubt") return "bg-[var(--warning-soft)] text-[var(--warning)]";
  return "";
}

// Sits next to the Buy/Sell/etc signal rather than replacing it - the signal is the action call,
// this is the reason. A player can be "Sell" + healthy (bad fixtures) or "Sell" + "Injured" (why),
// and collapsing those into one tag would lose the distinction.
function StatusChip({ status }: { status: Player["status"] }) {
  if (status === "Available") return null;
  return (
    <span className={`w-fit rounded-md px-1.5 py-0.5 text-[9px] font-black uppercase tracking-[0.06em] ${statusTone(status)}`}>
      {status}
    </span>
  );
}

function signalTone(signal: MarketSignal["signal"]) {
  if (signal === "Buy") return "border-[var(--success-border)] bg-[var(--success-soft)] text-[var(--success)]";
  if (signal === "Sell") return "border-[var(--danger-border)] bg-[var(--danger-soft)] text-[var(--danger)]";
  if (signal === "Avoid") return "border-[var(--warning-border)] bg-[var(--warning-soft)] text-[var(--warning)]";
  if (signal === "Watch") return "border-[var(--info-border)] bg-[var(--info-soft)] text-[var(--info)]";
  return "border-[var(--border)] bg-[var(--surface-3)] text-[var(--ink-soft)]";
}

function trendGlyph(trend: Player["trend"] | null | undefined) {
  if (trend === "up") return "↗";
  if (trend === "down") return "↘";
  return "→";
}

function trendClass(trend: Player["trend"] | null | undefined) {
  if (trend === "up") return "text-[var(--success)]";
  if (trend === "down") return "text-[var(--danger)]";
  return "text-[var(--muted)]";
}

function playerRichness(player: Player) {
  return [
    player.fixture && player.fixture !== "TBC" ? 1 : 0,
    numberValue(player.projected) > 0 ? 1 : 0,
    numberValue(player.three_gw_projected) > 0 ? 1 : 0,
    numberValue(player.ownership) > 0 ? 1 : 0,
    numberValue(player.form) > 0 ? 1 : 0,
    numberValue(player.price) > 0 ? 1 : 0,
  ].reduce((sum, value) => sum + value, 0);
}

function mergePlayer(base: Player, incoming: Player): Player {
  const richer = playerRichness(incoming) >= playerRichness(base) ? incoming : base;
  const other = richer === incoming ? base : incoming;
  return {
    ...other,
    ...richer,
    fixture: richer.fixture && richer.fixture !== "TBC" ? richer.fixture : other.fixture,
    projected: numberValue(richer.projected) > 0 ? richer.projected : other.projected,
    three_gw_projected:
      numberValue(richer.three_gw_projected) > 0 ? richer.three_gw_projected : other.three_gw_projected,
    ownership: numberValue(richer.ownership) > 0 ? richer.ownership : other.ownership,
    form: numberValue(richer.form) > 0 ? richer.form : other.form,
    price_movement:
      numberValue(richer.price_movement) !== 0 ? richer.price_movement : other.price_movement,
  };
}

function mergeSignals(signals: MarketSignal[]) {
  const byPlayer = new Map<number, MarketSignal>();
  for (const signal of signals) {
    const existing = byPlayer.get(signal.player.id);
    if (!existing) {
      byPlayer.set(signal.player.id, signal);
      continue;
    }

    const existingScore = numberValue(existing.score);
    const incomingScore = numberValue(signal.score);
    const preferredSignal =
      incomingScore > existingScore ||
      (incomingScore === existingScore && SIGNAL_ORDER[signal.signal] > SIGNAL_ORDER[existing.signal])
        ? signal
        : existing;

    byPlayer.set(signal.player.id, {
      ...preferredSignal,
      player: mergePlayer(existing.player, signal.player),
      reason: preferredSignal.reason || existing.reason || signal.reason,
      score: Math.max(existingScore, incomingScore) || null,
    });
  }
  return Array.from(byPlayer.values());
}

function marketUniverse(board: MarketBoard) {
  return mergeSignals([
    ...board.all_players,
    ...board.market_alerts,
    ...board.rising_players,
    ...board.falling_players,
    ...board.owned_squad_alerts,
  ]);
}

// The single merge point: every player in the full pool becomes one row; a signal (if the market
// engine ranked that player) attaches its score/thesis/trend/form/movement/fixture on top. A
// signal player somehow missing from the pool (shouldn't normally happen - same players table)
// still gets a row rather than silently vanishing.
function buildMarketRows(pool: ExplorerPlayer[], signals: MarketSignal[]): MarketRow[] {
  const signalById = new Map<number, MarketSignal>();
  for (const signal of signals) signalById.set(signal.player.id, signal);

  const asPosition = (value: string): MarketRow["position"] =>
    (["GK", "DEF", "MID", "FWD"] as const).includes(value as never) ? (value as MarketRow["position"]) : "MID";

  // entry.status is the pool's own raw field (unranked players never get a signalPlayer at all,
  // so reading only signalPlayer?.status silently forced every unranked injured/doubtful player
  // to show as "Available").
  const asStatus = (value: string | null | undefined): Player["status"] =>
    value === "Doubt" || value === "Injured" || value === "Suspended" ? value : "Available";

  const rows: MarketRow[] = pool.map((entry) => {
    const signal = signalById.get(entry.id);
    const signalPlayer = signal?.player;
    return {
      id: entry.id,
      code: entry.code,
      name: entry.name,
      team: entry.team,
      team_id: entry.team_id,
      position: asPosition(entry.position),
      price: entry.price,
      ownership: entry.ownership,
      status: signalPlayer?.status ?? asStatus(entry.status),
      projections: entry.projections,
      next_projected: entry.next_projected,
      horizon_projected: entry.horizon_projected,
      value_per_million: entry.value_per_million,
      signal: signal?.signal ?? null,
      score: signal?.score ?? null,
      reason: signal?.reason ?? null,
      trend: signalPlayer?.trend ?? null,
      price_movement: signalPlayer?.price_movement ?? null,
      form: signalPlayer?.form ?? null,
      three_gw_projected: signalPlayer?.three_gw_projected ?? null,
      fixture: signalPlayer?.fixture ?? null,
      fixture_difficulty: signalPlayer?.fixture_difficulty ?? null,
    };
  });

  const poolIds = new Set(pool.map((entry) => entry.id));
  for (const signal of signals) {
    if (poolIds.has(signal.player.id)) continue;
    const player = signal.player;
    const horizon = numberValue(player.three_gw_projected) || numberValue(player.projected);
    rows.push({
      id: player.id,
      code: player.code ?? null,
      name: player.name,
      team: player.team,
      team_id: 0,
      position: asPosition(player.position),
      price: player.price,
      ownership: numberValue(player.ownership),
      status: player.status,
      projections: {},
      next_projected: numberValue(player.projected),
      horizon_projected: horizon,
      value_per_million: player.price ? Math.round((horizon / player.price) * 100) / 100 : 0,
      signal: signal.signal,
      score: signal.score,
      reason: signal.reason,
      trend: player.trend ?? null,
      price_movement: player.price_movement ?? null,
      form: player.form ?? null,
      three_gw_projected: player.three_gw_projected ?? null,
      fixture: player.fixture ?? null,
      fixture_difficulty: player.fixture_difficulty ?? null,
    });
  }

  return rows;
}

function rowSortValue(row: MarketRow, key: RowSortKey) {
  if (key === "next") return row.next_projected;
  if (key === "value") return row.value_per_million;
  if (key === "score") return numberValue(row.score);
  if (key === "form") return numberValue(row.form);
  if (key === "movement") return Math.abs(numberValue(row.price_movement));
  if (key === "price") return row.price;
  if (key === "ownership") return row.ownership;
  return row.horizon_projected;
}

function matchesTab(row: MarketRow, tab: ViewTab, ownedIds: Set<number>) {
  if (tab === "All") return true;
  if (tab === "Buy") return row.signal === "Buy";
  if (tab === "Watch") return row.signal === "Watch";
  if (tab === "Sell/Avoid") return row.signal === "Sell" || row.signal === "Avoid";
  if (tab === "Rising") return row.trend === "up";
  if (tab === "Falling") return row.trend === "down";
  return ownedIds.has(row.id);
}

// PlayerVisual expects the app-wide Player shape; a MarketRow carries everything the photo/shirt/
// initials fallback chain needs (code + team + position), so bridge the two here.
function rowVisualPlayer(row: MarketRow): Player {
  return {
    id: row.id,
    code: row.code ?? undefined,
    name: row.name,
    team: row.team,
    position: row.position,
    price: row.price,
    projected: row.next_projected,
    ownership: row.ownership,
    status: row.status,
    risk: "Low",
    trend: row.trend ?? undefined,
    price_movement: row.price_movement ?? undefined,
    form: row.form ?? undefined,
    three_gw_projected: row.three_gw_projected ?? undefined,
    fixture: row.fixture ?? undefined,
    fixture_difficulty: row.fixture_difficulty ?? undefined,
  };
}

function MarketStat({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-3)] p-4">
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--muted)]">{label}</p>
      <p className="mt-2 text-2xl font-black text-[var(--ink)]">{value}</p>
      <p className="mt-1 text-xs font-semibold text-[var(--muted)]">{detail}</p>
    </div>
  );
}

function MovementTicker({ signals, onSelect }: { signals: MarketSignal[]; onSelect: (signal: MarketSignal) => void }) {
  if (!signals.length) return null;
  return (
    <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[0_18px_45px_rgba(15,23,60,0.06)]">
      <div className="flex items-center gap-3 border-b border-[var(--border)] px-4 py-3">
        <span className="h-2 w-2 animate-pulse rounded-full bg-[var(--success)]" />
        <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--ink)]">Live market tape</p>
        <span className="text-xs font-bold text-[var(--muted)]">Highest conviction and movement</span>
      </div>
      <div className="flex gap-3 overflow-x-auto px-4 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {signals.slice(0, 12).map((signal) => (
          <button
            key={`ticker-${signal.player.id}`}
            type="button"
            onClick={() => onSelect(signal)}
            className="flex min-w-[210px] shrink-0 items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-3)] px-3 py-3 text-left transition hover:-translate-y-0.5 hover:border-[var(--accent-border)]"
          >
            <PlayerVisual player={signal.player} size="sm" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-black text-[var(--ink)]">{signal.player.name}</span>
              <span className="mt-0.5 block text-xs font-bold text-[var(--muted)]">
                {signal.player.team} · {formatPrice(signal.player.price)}
              </span>
            </span>
            <span className="text-right">
              <span className={`block text-lg font-black ${trendClass(signal.player.trend)}`}>{trendGlyph(signal.player.trend)}</span>
              <span className="block text-[10px] font-black text-[var(--muted)]">{signal.score ?? "—"}</span>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

function FilterButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-xl border px-3 py-2 text-xs font-black transition ${
        active
          ? "border-[var(--accent)] bg-[var(--accent)] text-white shadow-[0_10px_24px_rgba(108,29,255,0.20)]"
          : "border-[var(--border)] bg-[var(--surface)] text-[var(--ink-soft)] hover:border-[var(--accent-border)] hover:text-[var(--accent)]"
      }`}
    >
      {label}
    </button>
  );
}

function MarketToolbar({
  search,
  onSearch,
  tab,
  onTab,
  position,
  onPosition,
  team,
  onTeam,
  minPrice,
  onMinPrice,
  maxPrice,
  onMaxPrice,
  sortKey,
  onSortKey,
  sortDirection,
  onSortDirection,
  teams,
  resultCount,
  horizon,
}: {
  search: string;
  onSearch: (value: string) => void;
  tab: ViewTab;
  onTab: (value: ViewTab) => void;
  position: PositionFilter;
  onPosition: (value: PositionFilter) => void;
  team: string;
  onTeam: (value: string) => void;
  minPrice: number;
  onMinPrice: (value: number) => void;
  maxPrice: number;
  onMaxPrice: (value: number) => void;
  sortKey: RowSortKey;
  onSortKey: (value: RowSortKey) => void;
  sortDirection: SortDirection;
  onSortDirection: () => void;
  teams: string[];
  resultCount: number;
  horizon: number;
}) {
  return (
    <section className="sticky top-2 z-20 rounded-2xl border border-[var(--border)] bg-[var(--surface)]/95 p-4 shadow-[0_18px_45px_rgba(15,23,60,0.08)] backdrop-blur-xl">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">Search the player market</span>
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--muted)]">⌕</span>
          <input
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            placeholder="Search player or club"
            className="h-12 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-3)] pl-10 pr-4 text-sm font-bold text-[var(--ink)] outline-none transition placeholder:text-[var(--muted)] focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent)]/10"
          />
        </label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5 xl:flex xl:shrink-0">
          <select
            value={team}
            onChange={(event) => onTeam(event.target.value)}
            className="h-12 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-xs font-black text-[var(--ink)] outline-none focus:border-[var(--accent)]"
            aria-label="Filter by team"
          >
            <option value="">All clubs</option>
            {teams.map((club) => (
              <option key={club} value={club}>{club}</option>
            ))}
          </select>
          <select
            value={minPrice}
            onChange={(event) => onMinPrice(Number(event.target.value))}
            className="h-12 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-xs font-black text-[var(--ink)] outline-none focus:border-[var(--accent)]"
            aria-label="Minimum price"
          >
            {MIN_PRICE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <select
            value={maxPrice}
            onChange={(event) => onMaxPrice(Number(event.target.value))}
            className="h-12 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-xs font-black text-[var(--ink)] outline-none focus:border-[var(--accent)]"
            aria-label="Maximum price"
          >
            {PRICE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <select
            value={sortKey}
            onChange={(event) => onSortKey(event.target.value as RowSortKey)}
            className="h-12 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-xs font-black text-[var(--ink)] outline-none focus:border-[var(--accent)]"
            aria-label="Sort market"
          >
            <option value="horizon">{horizon}-GW projection</option>
            <option value="next">Next-GW projection</option>
            <option value="value">Points per £m</option>
            <option value="score">Market score</option>
            <option value="form">Form</option>
            <option value="movement">Price movement</option>
            <option value="price">Price</option>
            <option value="ownership">Ownership</option>
          </select>
          <button
            type="button"
            onClick={onSortDirection}
            className="h-12 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-xs font-black text-[var(--accent)] transition hover:border-[var(--accent)]"
          >
            {sortDirection === "desc" ? "Highest first ↓" : "Lowest first ↑"}
          </button>
        </div>
      </div>

      <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {VIEW_TABS.map((item) => (
          <FilterButton key={item} active={tab === item} label={item} onClick={() => onTab(item)} />
        ))}
        <span className="mx-1 h-9 w-px shrink-0 bg-[var(--border)]" />
        {POSITIONS.map((item) => (
          <FilterButton key={item} active={position === item} label={item} onClick={() => onPosition(item)} />
        ))}
        <span className="ml-auto hidden shrink-0 items-center rounded-xl bg-[var(--accent-soft)] px-3 py-2 text-xs font-black text-[var(--accent)] sm:flex">
          {resultCount} players
        </span>
      </div>
    </section>
  );
}

function MarketRowTable({
  rows,
  selectedId,
  onSelect,
}: {
  rows: MarketRow[];
  selectedId?: number;
  onSelect: (row: MarketRow) => void;
}) {
  return (
    <section className="hidden overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[0_22px_60px_rgba(15,23,60,0.08)] md:block">
      <div className="overflow-x-auto">
        {/* Below 2xl the sidebar-split layout leaves too little width for all 10 columns (they'd
            either clip past this card's edge or force a scrollbar with no visible affordance) -
            Own/Horizon/Pts-per-£m/Score stay hidden until there's real room, in favour of keeping
            Next GW (the projection) visible without scrolling; Own is still shown in the detail
            panel for whichever row is selected. */}
        <div className="min-w-[560px] 2xl:min-w-[1080px]">
          <div className="grid grid-cols-[36px_minmax(170px,1.7fr)_50px_66px_86px_74px] items-center gap-3 border-b border-[var(--border)] bg-[var(--surface-3)] px-4 py-3 text-[10px] font-black uppercase tracking-[0.12em] text-[var(--muted)] 2xl:grid-cols-[42px_minmax(190px,1.7fr)_60px_72px_68px_86px_86px_78px_70px_68px]">
            <span>#</span><span>Player</span><span>Pos</span><span>Price</span><span>Signal</span><span>Next GW</span>
            <span className="hidden 2xl:block">Own</span><span className="hidden 2xl:block">Horizon</span><span className="hidden 2xl:block">Pts/£m</span><span className="hidden 2xl:block">Score</span>
          </div>
          <div className="divide-y divide-[var(--border-soft)]">
            {rows.map((row, index) => {
              const selected = row.id === selectedId;
              return (
                <button
                  key={`market-row-${row.id}`}
                  type="button"
                  onClick={() => onSelect(row)}
                  className={`grid w-full grid-cols-[36px_minmax(170px,1.7fr)_50px_66px_86px_74px] items-center gap-3 px-4 py-3 text-left transition 2xl:grid-cols-[42px_minmax(190px,1.7fr)_60px_72px_68px_86px_86px_78px_70px_68px] ${
                    selected ? "bg-[var(--accent-soft)]" : "bg-[var(--surface)] hover:bg-[var(--surface-3)]"
                  }`}
                >
                  <span className="text-xs font-black text-[var(--muted)]">{String(index + 1).padStart(2, "0")}</span>
                  <span className="flex min-w-0 items-center gap-3">
                    <PlayerVisual player={rowVisualPlayer(row)} size="sm" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-black text-[var(--ink)]">{row.name}</span>
                      <span className="block text-xs font-bold text-[var(--muted)]">{row.team}</span>
                    </span>
                  </span>
                  <span className="text-xs font-black text-[var(--ink-soft)]">{row.position}</span>
                  <span className="text-sm font-black text-[var(--ink)]">{formatPrice(row.price)}</span>
                  <span className="flex flex-col items-start gap-1">
                    {row.signal ? <SignalBadge value={row.signal} /> : <span className="rounded-lg bg-[var(--surface-3)] px-2.5 py-1 text-[11px] font-black text-[var(--muted)] ring-1 ring-[var(--border)]">Unranked</span>}
                    <StatusChip status={row.status} />
                  </span>
                  <span className="text-sm font-black text-[var(--success)]">{formatProjection(row.next_projected)}</span>
                  <span className="hidden text-sm font-black text-[var(--ink)] 2xl:block">{row.ownership.toFixed(1)}%</span>
                  <span className="hidden text-sm font-black text-[var(--accent)] 2xl:block">{formatProjection(row.horizon_projected)}</span>
                  <span className="hidden text-sm font-black text-[var(--ink)] 2xl:block">{row.value_per_million.toFixed(1)}</span>
                  <span className="hidden text-right text-base font-black text-[var(--ink)] 2xl:block">{row.score ?? "—"}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

function MobileMarketRowCards({ rows, onSelect }: { rows: MarketRow[]; onSelect: (row: MarketRow) => void }) {
  return (
    <div className="grid gap-3 md:hidden">
      {rows.map((row, index) => (
        <button
          key={`mobile-market-${row.id}`}
          type="button"
          onClick={() => onSelect(row)}
          className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 text-left shadow-[0_14px_34px_rgba(15,23,60,0.06)] transition active:scale-[0.99]"
        >
          <div className="flex items-start gap-3">
            <span className="pt-1 text-[10px] font-black text-[var(--muted)]">{String(index + 1).padStart(2, "0")}</span>
            <PlayerVisual player={rowVisualPlayer(row)} size="sm" />
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-base font-black text-[var(--ink)]">{row.name}</p>
                  <p className="text-xs font-bold text-[var(--muted)]">{row.team} · {row.position} · {formatPrice(row.price)}</p>
                </div>
                <span className="flex shrink-0 flex-col items-end gap-1">
                  {row.signal ? <SignalBadge value={row.signal} /> : <span className="rounded-lg bg-[var(--surface-3)] px-2.5 py-1 text-[11px] font-black text-[var(--muted)] ring-1 ring-[var(--border)]">Unranked</span>}
                  <StatusChip status={row.status} />
                </span>
              </div>
              <div className="mt-3 grid grid-cols-4 gap-2">
                <MobileMetric label="Next" value={formatProjection(row.next_projected)} tone="green" />
                <MobileMetric label="Horizon" value={formatProjection(row.horizon_projected)} tone="purple" />
                <MobileMetric label="Pts/£m" value={row.value_per_million.toFixed(1)} />
                <MobileMetric label="Score" value={row.score == null ? "—" : String(row.score)} />
              </div>
              <div className="mt-3 flex items-center justify-between gap-3">
                {row.fixture ? <FixturePill fixture={row.fixture} difficulty={row.fixture_difficulty ?? 3} /> : <span className="text-xs font-bold text-[var(--muted)]">No signal fixture data</span>}
                <span className={`text-xs font-black ${trendClass(row.trend)}`}>{trendGlyph(row.trend)} {formatMovement(row.price_movement)}</span>
                <span className="text-xs font-black text-[var(--ink-soft)]">{row.ownership.toFixed(1)}% own</span>
              </div>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}

function pagerWindow(page: number, totalPages: number): (number | "ellipsis")[] {
  const clip = (value: number) => Math.min(totalPages - 1, Math.max(0, value));
  const keep = Array.from(new Set([0, clip(page - 1), page, clip(page + 1), totalPages - 1])).sort((a, b) => a - b);
  const items: (number | "ellipsis")[] = [];
  keep.forEach((value, index) => {
    if (index > 0 && value - keep[index - 1] > 1) items.push("ellipsis");
    items.push(value);
  });
  return items;
}

function MarketPager({ page, totalPages, onPage }: { page: number; totalPages: number; onPage: (page: number) => void }) {
  const items = pagerWindow(page, totalPages);
  const buttonBase = "min-w-[36px] rounded-xl px-3 py-2 text-sm font-black transition";
  return (
    <nav className="flex flex-wrap items-center justify-center gap-2 pt-1" aria-label="Market page navigation">
      <button
        type="button"
        onClick={() => onPage(Math.max(0, page - 1))}
        disabled={page === 0}
        className={`${buttonBase} border border-[var(--accent-border)] bg-[var(--surface)] text-[var(--accent)] hover:bg-[var(--surface-2)] disabled:cursor-not-allowed disabled:opacity-40`}
      >
        ‹ Prev
      </button>
      {items.map((item, index) =>
        item === "ellipsis" ? (
          <span key={`ellipsis-${index}`} className="px-1 text-sm font-black text-[var(--muted)]">
            …
          </span>
        ) : (
          <button
            key={item}
            type="button"
            onClick={() => onPage(item)}
            aria-current={item === page ? "page" : undefined}
            className={`${buttonBase} ${
              item === page
                ? "bg-[var(--accent)] text-white shadow-[0_10px_24px_rgba(108,29,255,0.3)]"
                : "border border-[var(--border)] bg-[var(--surface)] text-[var(--ink-soft)] hover:bg-[var(--surface-2)]"
            }`}
          >
            {item + 1}
          </button>
        ),
      )}
      <button
        type="button"
        onClick={() => onPage(Math.min(totalPages - 1, page + 1))}
        disabled={page === totalPages - 1}
        className={`${buttonBase} border border-[var(--accent-border)] bg-[var(--surface)] text-[var(--accent)] hover:bg-[var(--surface-2)] disabled:cursor-not-allowed disabled:opacity-40`}
      >
        Next ›
      </button>
    </nav>
  );
}

function MobileMetric({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "green" | "purple" }) {
  const toneClass = tone === "green" ? "text-[var(--success)]" : tone === "purple" ? "text-[var(--accent)]" : "text-[var(--ink)]";
  return (
    <span className="rounded-lg bg-[var(--surface-3)] px-2 py-2 text-center">
      <span className="block text-[9px] font-black uppercase tracking-[0.1em] text-[var(--muted)]">{label}</span>
      <span className={`mt-0.5 block text-xs font-black ${toneClass}`}>{value}</span>
    </span>
  );
}

function PlayerDetail({ row, onClose, mobile = false }: { row: MarketRow; onClose?: () => void; mobile?: boolean }) {
  const gameweeks = Object.entries(row.projections)
    .map(([gw, points]) => ({ gw: Number(gw), points }))
    .sort((a, b) => a.gw - b.gw);
  const maxGwPoints = Math.max(0, ...gameweeks.map((item) => item.points));

  return (
    <aside className={`${mobile ? "min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-t-[26px]" : "sticky top-[168px] max-h-[calc(100vh-192px)] overflow-y-auto rounded-2xl"} border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[0_24px_70px_rgba(15,23,60,0.16)]`}>
      {mobile ? (
        <div className="mb-4 flex items-center justify-between">
          <span className="h-1.5 w-12 rounded-full bg-[var(--border)]" />
          <button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full bg-[var(--surface-3)] text-lg font-black text-[var(--ink-soft)]" aria-label="Close player details">×</button>
        </div>
      ) : null}
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <PlayerVisual player={rowVisualPlayer(row)} size="lg" />
          <div className="min-w-0">
            <p className="truncate text-2xl font-black text-[var(--ink)]">{row.name}</p>
            <p className="mt-1 text-sm font-bold text-[var(--muted)]">{row.team} · {row.position} · {formatPrice(row.price)}</p>
          </div>
        </div>
        <span className="flex shrink-0 flex-col items-end gap-1">
          {row.signal ? <SignalBadge value={row.signal} /> : <span className="rounded-lg bg-[var(--surface-3)] px-2.5 py-1 text-[11px] font-black text-[var(--muted)] ring-1 ring-[var(--border)]">Unranked</span>}
          <StatusChip status={row.status} />
        </span>
      </div>

      {row.signal ? (
        <div className="mt-5 rounded-2xl border border-[var(--border)] bg-[var(--surface-3)] p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--muted)]">Market score</p>
              <p className="mt-1 text-3xl font-black text-[var(--ink)]">{row.score ?? "—"}</p>
            </div>
            <div className={`rounded-xl border px-3 py-2 text-right ${signalTone(row.signal)}`}>
              <p className="text-[10px] font-black uppercase tracking-[0.12em]">Trend</p>
              <p className="mt-1 text-lg font-black">{trendGlyph(row.trend)} {row.trend ?? "flat"}</p>
            </div>
          </div>
          {row.score != null ? (
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-[var(--border-soft)]">
              <div className="h-full rounded-full bg-[var(--accent)] transition-all" style={{ width: `${Math.max(0, Math.min(100, row.score))}%` }} />
            </div>
          ) : null}
        </div>
      ) : (
        <div className="mt-5 rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface-3)] p-4">
          <p className="text-xs font-semibold leading-5 text-[var(--muted)]">
            Not yet in the market signal engine&apos;s ranked set — the projection breakdown below is still real.
          </p>
        </div>
      )}

      <div className="mt-4 grid grid-cols-2 gap-3">
        <DetailMetric label="Next GW" value={`${formatProjection(row.next_projected)} pts`} tone="green" />
        <DetailMetric label="Horizon total" value={`${formatProjection(row.horizon_projected)} pts`} tone="purple" />
        <DetailMetric label="Ownership" value={`${row.ownership.toFixed(1)}%`} />
        <DetailMetric label="Points per £m" value={row.value_per_million.toFixed(1)} />
        {row.form != null ? <DetailMetric label="Form" value={row.form.toFixed(1)} /> : null}
        {row.price_movement != null ? (
          <DetailMetric label="Price movement" value={formatMovement(row.price_movement)} tone={numberValue(row.price_movement) >= 0 ? "green" : "red"} />
        ) : null}
        {row.fixture ? (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
            <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[var(--muted)]">Next fixture</p>
            <div className="mt-2"><FixturePill fixture={row.fixture} difficulty={row.fixture_difficulty ?? 3} /></div>
          </div>
        ) : null}
      </div>

      {gameweeks.length ? (
        <div className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[var(--muted)]">Projection by gameweek</p>
          <div className="mt-3 space-y-2">
            {gameweeks.map(({ gw, points }) => {
              const width = maxGwPoints > 0 ? Math.max(6, Math.min(100, (points / maxGwPoints) * 100)) : 6;
              return (
                <div key={gw} className="flex items-center gap-3">
                  <span className="w-8 shrink-0 text-xs font-black text-[var(--muted)]">GW{gw}</span>
                  <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-[var(--surface-3)]">
                    <div className="h-full rounded-full bg-[var(--success)]" style={{ width: `${width}%` }} />
                  </div>
                  <span className="w-10 shrink-0 text-right text-xs font-black text-[var(--ink)]">{points.toFixed(1)}</span>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--accent-soft)] p-4">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--accent)]">Market thesis</p>
        <p className="mt-2 text-sm font-semibold leading-6 text-[var(--ink-soft)]">
          {row.reason || "The market engine hasn't ranked this player yet - it currently covers the strongest signals only. The projection and value numbers above are real regardless."}
        </p>
      </div>

      {row.status !== "Available" ? (
        <div className="mt-4 rounded-xl border border-[var(--danger-border)] bg-[var(--danger-soft)] p-3 text-sm font-bold text-[var(--danger)]">
          Availability: {row.status}. Treat the projection with additional caution.
        </div>
      ) : null}

      <div className="mt-5 grid grid-cols-2 gap-3">
        <Link href={`/compare?player_a=${row.id}`} className="rounded-xl border border-[var(--accent)] bg-[var(--surface)] px-4 py-3 text-center text-sm font-black text-[var(--accent)] transition hover:bg-[var(--accent-soft)]">
          Compare
        </Link>
        <Link href={`/watchlist?player_id=${row.id}`} className="rounded-xl bg-[var(--accent)] px-4 py-3 text-center text-sm font-black text-white shadow-[0_14px_30px_rgba(108,29,255,0.24)]">
          Watch player
        </Link>
      </div>
    </aside>
  );
}

function DetailMetric({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "green" | "purple" | "red" }) {
  const toneClass = tone === "green" ? "text-[var(--success)]" : tone === "purple" ? "text-[var(--accent)]" : tone === "red" ? "text-[var(--danger)]" : "text-[var(--ink)]";
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
      <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[var(--muted)]">{label}</p>
      <p className={`mt-1 text-xl font-black ${toneClass}`}>{value}</p>
    </div>
  );
}

function SignalGuide({ board }: { board: MarketBoard }) {
  const groups: MarketSignal["signal"][] = ["Buy", "Watch", "Hold", "Sell", "Avoid", "Bench"];
  return (
    <details className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[0_18px_45px_rgba(15,23,60,0.06)]">
      <summary className="cursor-pointer list-none text-base font-black text-[var(--ink)] marker:hidden">
        How market signals are classified <span className="float-right text-[var(--accent)]">＋</span>
      </summary>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {groups.map((group) => (
          <div key={group} className="rounded-xl border border-[var(--border)] bg-[var(--surface-3)] p-3">
            <SignalBadge value={group} />
            <p className="mt-3 text-xs font-semibold leading-5 text-[var(--ink-soft)]">{board.signal_explanations[group]}</p>
          </div>
        ))}
      </div>
    </details>
  );
}

export function MarketContent({
  payload,
  position: initialPosition,
  signal: initialSignal,
  team: initialTeam,
  maxPrice: initialMaxPrice,
}: {
  payload: Record<string, unknown>;
  position: string;
  signal: string;
  team: string;
  maxPrice: number;
}) {
  // market_list is a global board (no entry_id on the backend row), so it can't be looked up via
  // the entry-scoped /analysis/status endpoint - left on the original full-endpoint re-poll.
  const listState = usePolledAnalysis(() => getMarketBoard({ limit: 100 }), [], "market-list");
  const entryIdValue = payload.entry_id ?? payload.team_id;
  const entryId = entryIdValue == null ? null : String(entryIdValue);
  const gameweekValue = payload.gameweek ?? payload.start_gw;
  const gameweekNumber = typeof gameweekValue === "number" ? gameweekValue : Number(gameweekValue);
  const squadState = usePolledAnalysis(() => analyseStockMarketSquad(payload), [payload.entry_id], "market-squad", {
    entryId,
    gameweek: Number.isFinite(gameweekNumber) ? gameweekNumber : undefined,
    analysisType: "market_squad",
  });
  const [directory, setDirectory] = useState<PlayerDirectoryEntry[]>([]);

  // Full player pool - fetched separately from the signal board (different endpoint, returns
  // instantly). While it's loading, buildMarketRows([], signals) still produces a full table from
  // signal data alone (same rows the page always showed), so there's no second blocking spinner -
  // the table just gains rows once the pool resolves.
  const [explorerData, setExplorerData] = useState<PlayerExplorerData | null>(null);
  const [explorerError, setExplorerError] = useState("");

  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<ViewTab>(
    (VIEW_TABS as readonly string[]).includes(initialSignal) ? (initialSignal as ViewTab) : "All",
  );
  const [positionFilter, setPositionFilter] = useState<PositionFilter>(
    POSITIONS.includes(initialPosition as PositionFilter) ? (initialPosition as PositionFilter) : "All",
  );
  const [teamFilter, setTeamFilter] = useState(initialTeam);
  const [minPrice, setMinPrice] = useState(0);
  const [maxPrice, setMaxPrice] = useState(initialMaxPrice || 0);
  const [sortKey, setSortKey] = useState<RowSortKey>("horizon");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const [page, setPage] = useState(0);
  const resultsTopRef = useRef<HTMLDivElement | null>(null);

  // Without this the fixed backdrop still lets touch scrolling fall through to the page behind
  // it once the sheet's own content is shorter than the gesture's scroll distance - the user
  // ends up scrolling the market table instead of the open card.
  useEffect(() => {
    if (!mobileDetailOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [mobileDetailOpen]);

  useEffect(() => {
    let cancelled = false;
    void getPlayersDirectory()
      .then((result) => {
        if (!cancelled) setDirectory(result.data);
      })
      .catch(() => {
        if (!cancelled) setDirectory([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    getPlayerExplorer()
      .then((result) => {
        if (!cancelled) setExplorerData(result.data);
      })
      .catch((error) => {
        if (!cancelled) setExplorerError(error instanceof Error ? error.message : "Player pool failed to load.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setPage(0);
  }, [search, tab, positionFilter, teamFilter, minPrice, maxPrice, sortKey, sortDirection]);

  if (listState.phase === "error") return <ErrorState message={listState.message} />;
  if (listState.phase !== "ready") {
    return (
      <StillComputingPanel
        phase={listState.phase}
        elapsedMs={"elapsedMs" in listState ? listState.elapsedMs : undefined}
        label="Market analysis"
      />
    );
  }

  // The league-wide market is useful on its own, so a slower or failed squad-specific analysis
  // must not block the entire exchange. Owned alerts upgrade in place once that second request
  // resolves; until then the market endpoint's own owned alerts remain visible.
  const squadAlerts =
    squadState.phase === "ready" && squadState.data.owned_player_alerts.length
      ? squadState.data.owned_player_alerts
      : listState.data.owned_squad_alerts;

  const board: MarketBoard = {
    ...listState.data,
    owned_squad_alerts: squadAlerts,
  };

  const universe = marketUniverse(board);
  const ownedIds = new Set(board.owned_squad_alerts.map((item) => item.player.id));
  const pool = explorerData?.players ?? [];
  const horizon = explorerData?.horizon || 5;
  const gwWindow = explorerData?.gameweeks.length
    ? `GW${explorerData.gameweeks[0]}–GW${explorerData.gameweeks[explorerData.gameweeks.length - 1]}`
    : "the current window";

  const allRows = buildMarketRows(pool, universe);
  const teams = Array.from(new Set(allRows.map((row) => row.team).filter(Boolean))).sort();

  const query = search.trim().toLowerCase();
  const filteredRows = allRows
    .filter((row) => !query || row.name.toLowerCase().includes(query) || row.team.toLowerCase().includes(query))
    .filter((row) => matchesTab(row, tab, ownedIds))
    .filter((row) => positionFilter === "All" || row.position === positionFilter)
    .filter((row) => !teamFilter || row.team === teamFilter)
    .filter((row) => !minPrice || row.price >= minPrice)
    .filter((row) => !maxPrice || row.price <= maxPrice)
    .sort((a, b) => {
      const delta = rowSortValue(a, sortKey) - rowSortValue(b, sortKey);
      if (delta !== 0) return sortDirection === "desc" ? -delta : delta;
      return a.name.localeCompare(b.name);
    });
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages - 1);
  const shownRows = filteredRows.slice(currentPage * PAGE_SIZE, currentPage * PAGE_SIZE + PAGE_SIZE);

  const selectedRow =
    filteredRows.find((row) => row.id === selectedId) ??
    allRows.find((row) => row.id === selectedId) ??
    shownRows[0] ??
    allRows[0];

  const buys = allRows.filter((row) => row.signal === "Buy");
  const sells = allRows.filter((row) => row.signal === "Sell" || row.signal === "Avoid");
  const rising = allRows.filter((row) => row.trend === "up");
  const falling = allRows.filter((row) => row.trend === "down");
  const averageProjection = allRows.length
    ? allRows.reduce((sum, row) => sum + row.next_projected, 0) / allRows.length
    : 0;
  const ticker = [...universe].sort((a, b) => {
    const movementDelta = Math.abs(numberValue(b.player.price_movement)) - Math.abs(numberValue(a.player.price_movement));
    return movementDelta || numberValue(b.score) - numberValue(a.score);
  });

  function selectRow(row: MarketRow, mobile = false) {
    setSelectedId(row.id);
    if (mobile) setMobileDetailOpen(true);
  }

  function selectSignalFromTicker(signal: MarketSignal, mobile = false) {
    setSelectedId(signal.player.id);
    if (mobile) setMobileDetailOpen(true);
  }

  return (
    <div className="space-y-5">
      <section className="relative overflow-hidden rounded-[26px] border border-[var(--accent-border)] bg-[var(--surface)] p-5 shadow-[0_28px_72px_rgba(47,18,77,0.12)] sm:p-7">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_88%_14%,rgba(108,29,255,0.14),transparent_34%),radial-gradient(circle_at_8%_92%,rgba(0,168,86,0.08),transparent_28%)]" />
          <div className="absolute -right-12 -top-16 h-48 w-48 rounded-full border border-[var(--accent)]/10 sm:h-64 sm:w-64" />
        </div>
        <div className="relative">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-2xl">
              <div className="flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-2 rounded-full border border-[var(--success-border)] bg-[var(--success-soft)] px-3 py-1.5 text-xs font-black uppercase tracking-[0.14em] text-[var(--success)]">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-[var(--success)]" /> Live player market
                </span>
              </div>
              <h1 className="mt-3 text-2xl font-black tracking-tight text-[var(--ink)] sm:text-3xl">Player Market</h1>
              <p className="mt-2 max-w-xl text-xs font-semibold leading-5 text-[var(--muted)] sm:text-sm">
                The full player pool for {gwWindow}, screened by price, position, ownership and market signal — click any row for the full thesis.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:min-w-[560px]">
              <MarketStat label="Market depth" value={String(allRows.length)} detail="players in pool" />
              <MarketStat label="Buy signals" value={String(buys.length)} detail="positive setups" />
              <MarketStat label="Risk exits" value={String(sells.length)} detail="sell or avoid" />
              <MarketStat label="Avg projection" value={averageProjection.toFixed(1)} detail="next-GW points" />
            </div>
          </div>
          <div className="mt-6 flex flex-wrap gap-2 text-xs font-black text-[var(--ink-soft)]">
            <span className="rounded-full border border-[var(--border)] bg-[var(--surface-3)] px-3 py-2">↗ {rising.length} rising</span>
            <span className="rounded-full border border-[var(--border)] bg-[var(--surface-3)] px-3 py-2">↘ {falling.length} falling</span>
            <span className="rounded-full border border-[var(--border)] bg-[var(--surface-3)] px-3 py-2">◎ {board.owned_squad_alerts.length} squad alerts</span>
            <span className="rounded-full border border-[var(--border)] bg-[var(--surface-3)] px-3 py-2">{explorerData ? "Full pool loaded" : "Loading full pool…"}</span>
          </div>
        </div>
      </section>

      <MovementTicker signals={ticker} onSelect={(item) => selectSignalFromTicker(item, true)} />

      <MarketToolbar
        search={search}
        onSearch={setSearch}
        tab={tab}
        onTab={setTab}
        position={positionFilter}
        onPosition={setPositionFilter}
        team={teamFilter}
        onTeam={setTeamFilter}
        minPrice={minPrice}
        onMinPrice={setMinPrice}
        maxPrice={maxPrice}
        onMaxPrice={setMaxPrice}
        sortKey={sortKey}
        onSortKey={setSortKey}
        sortDirection={sortDirection}
        onSortDirection={() => setSortDirection((current) => (current === "desc" ? "asc" : "desc"))}
        teams={teams}
        resultCount={filteredRows.length}
        horizon={horizon}
      />

      {explorerError ? (
        <p className="rounded-xl border border-dashed border-[var(--danger-border)] bg-[var(--danger-soft)] px-4 py-3 text-xs font-semibold text-[var(--danger)]">
          The full player pool failed to load ({explorerError}) — showing the market&apos;s ranked signals only.
        </p>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div ref={resultsTopRef} className="min-w-0 space-y-3">
          <div className="flex items-end justify-between gap-4 px-1">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--accent)]">{tab === "All" ? "Full market" : tab}</p>
              <h2 className="mt-1 text-2xl font-black text-[var(--ink)]">{filteredRows.length} players</h2>
            </div>
            {board.full_market_locked ? (
              <span className="rounded-full bg-[var(--warning-soft)] px-3 py-2 text-xs font-black text-[var(--warning)]">Preview depth</span>
            ) : (
              <span className="rounded-full bg-[var(--success-soft)] px-3 py-2 text-xs font-black text-[var(--success)]">Live market feed</span>
            )}
          </div>

          {shownRows.length ? (
            <>
              <MarketRowTable rows={shownRows} selectedId={selectedRow?.id} onSelect={(row) => selectRow(row)} />
              <MobileMarketRowCards rows={shownRows} onSelect={(row) => selectRow(row, true)} />
              {totalPages > 1 ? (
                <MarketPager
                  page={currentPage}
                  totalPages={totalPages}
                  onPage={(next) => {
                    setPage(next);
                    resultsTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                />
              ) : null}
            </>
          ) : (
            <section className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)] p-10 text-center shadow-[0_18px_45px_rgba(15,23,60,0.05)]">
              <p className="text-xl font-black text-[var(--ink)]">No players match this market screen.</p>
              <p className="mt-2 text-sm font-semibold text-[var(--muted)]">Clear one or more filters to restore market depth.</p>
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setTab("All");
                  setPositionFilter("All");
                  setTeamFilter("");
                  setMinPrice(0);
                  setMaxPrice(0);
                }}
                className="mt-5 rounded-xl bg-[var(--accent)] px-5 py-3 text-sm font-black text-white"
              >
                Clear filters
              </button>
            </section>
          )}
        </div>

        <div className="hidden xl:block">{selectedRow ? <PlayerDetail row={selectedRow} /> : null}</div>
      </div>

      {board.full_market_locked ? (
        <section className="flex flex-col gap-4 rounded-[24px] border border-dashed border-[var(--accent-border)] bg-[var(--accent-soft)] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.17em] text-[var(--accent)]">Market depth limited</p>
            <h2 className="mt-2 text-xl font-black text-[var(--ink)]">Unlock deeper ranked market coverage</h2>
            <p className="mt-2 max-w-2xl text-sm font-semibold text-[var(--muted)]">Higher-tier depth exposes the additional market coverage returned by the backend while keeping the same live projection model and ranking tools.</p>
          </div>
          <Link href="/pricing" className="inline-flex shrink-0 items-center justify-center rounded-xl bg-[var(--accent)] px-5 py-3 text-sm font-black text-white shadow-[0_12px_28px_rgba(108,29,255,0.24)] transition hover:bg-[var(--accent-2)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-2)] focus:ring-offset-2">View plans</Link>
        </section>
      ) : null}

      {directory.length ? (
        <details className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[0_18px_45px_rgba(15,23,60,0.06)]">
          <summary className="cursor-pointer list-none text-base font-black text-[var(--ink)] marker:hidden">
            Open head-to-head player comparison <span className="float-right text-[var(--accent)]">＋</span>
          </summary>
          <div className="mt-5"><CompareAnyTwoPlayers directory={directory} /></div>
        </details>
      ) : null}

      <SignalGuide board={board} />

      {mobileDetailOpen && selectedRow ? (
        <div className="fixed inset-0 z-[80] flex items-end bg-[var(--ink)]/55 p-0 backdrop-blur-sm xl:hidden" onClick={() => setMobileDetailOpen(false)}>
          <div className="flex max-h-[88vh] w-full flex-col overflow-hidden" onClick={(event) => event.stopPropagation()}>
            <PlayerDetail row={selectedRow} mobile onClose={() => setMobileDetailOpen(false)} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
