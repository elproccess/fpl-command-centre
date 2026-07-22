"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { DataModeBadge } from "@/components/app-shell";
import { SignalBadge } from "@/components/badges";
import { CompareAnyTwoPlayers } from "@/components/compare-any-two-players";
import { FixturePill, formatPrice } from "@/components/fpl-ui";
import { PlayerVisual } from "@/components/player-visual";
import { StillComputingPanel, usePolledAnalysis } from "@/components/polled-analysis";
import { ErrorState } from "@/components/states";
import {
  analyseStockMarketSquad,
  getMarketBoard,
  getPlayersDirectory,
  type PlayerDirectoryEntry,
} from "@/lib/api";
import type { MarketBoard, MarketSignal, Player } from "@/lib/types";

const SIGNAL_ORDER: Record<MarketSignal["signal"], number> = {
  Buy: 5,
  Watch: 4,
  Hold: 3,
  Sell: 2,
  Avoid: 1,
};

const SIGNALS: Array<"All" | MarketSignal["signal"] | "My squad"> = [
  "All",
  "Buy",
  "Watch",
  "Hold",
  "Sell",
  "Avoid",
  "My squad",
];

const POSITIONS = ["All", "GK", "DEF", "MID", "FWD"] as const;

type PositionFilter = (typeof POSITIONS)[number];
type SignalFilter = (typeof SIGNALS)[number];
type SortKey = "score" | "projected" | "three_gw" | "form" | "ownership" | "price" | "price_change";
type SortDirection = "asc" | "desc";

function numberValue(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function formatProjection(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value.toFixed(1) : "—";
}

function formatMovement(value: number | null | undefined) {
  const movement = numberValue(value);
  if (movement === 0) return "—";
  const normalized = Math.abs(movement) >= 1 ? movement / 10 : movement;
  return `${normalized > 0 ? "+" : ""}£${normalized.toFixed(1)}`;
}

function signalTone(signal: MarketSignal["signal"]) {
  if (signal === "Buy") return "border-[#B7EFD0] bg-[#EFFFF5] text-[#008A46]";
  if (signal === "Sell") return "border-[#FFD2DF] bg-[#FFF0F5] text-[#D9004A]";
  if (signal === "Avoid") return "border-[#FFDDB4] bg-[#FFF5E7] text-[#B96800]";
  if (signal === "Watch") return "border-[#CDE7FF] bg-[#EDF7FF] text-[#006FA6]";
  return "border-[#E1E7F2] bg-[#F5F7FB] text-[#4D5680]";
}

function trendGlyph(player: Player) {
  if (player.trend === "up") return "↗";
  if (player.trend === "down") return "↘";
  return "→";
}

function trendClass(player: Player) {
  if (player.trend === "up") return "text-[#00A85A]";
  if (player.trend === "down") return "text-[#E90052]";
  return "text-[#6C7195]";
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
    ...board.market_alerts,
    ...board.rising_players,
    ...board.falling_players,
    ...board.owned_squad_alerts,
  ]);
}

function scoreForSort(signal: MarketSignal, key: SortKey) {
  const player = signal.player;
  if (key === "score") return numberValue(signal.score);
  if (key === "projected") return numberValue(player.projected);
  if (key === "three_gw") return numberValue(player.three_gw_projected);
  if (key === "form") return numberValue(player.form);
  if (key === "ownership") return numberValue(player.ownership);
  if (key === "price") return numberValue(player.price);
  return numberValue(player.price_movement);
}

function MarketStat({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.07] p-4 backdrop-blur-sm">
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/50">{label}</p>
      <p className="mt-2 text-2xl font-black text-white">{value}</p>
      <p className="mt-1 text-xs font-semibold text-white/55">{detail}</p>
    </div>
  );
}

function MovementTicker({ signals, onSelect }: { signals: MarketSignal[]; onSelect: (signal: MarketSignal) => void }) {
  if (!signals.length) return null;
  return (
    <section className="overflow-hidden rounded-2xl border border-[#E1E7F2] bg-white shadow-[0_18px_45px_rgba(15,23,60,0.06)]">
      <div className="flex items-center gap-3 border-b border-[#E1E7F2] px-4 py-3">
        <span className="h-2 w-2 animate-pulse rounded-full bg-[#00A85A]" />
        <p className="text-xs font-black uppercase tracking-[0.16em] text-[#101947]">Live market tape</p>
        <span className="text-xs font-bold text-[#6C7195]">Highest conviction and movement</span>
      </div>
      <div className="flex gap-3 overflow-x-auto px-4 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {signals.slice(0, 12).map((signal) => (
          <button
            key={`ticker-${signal.player.id}`}
            type="button"
            onClick={() => onSelect(signal)}
            className="flex min-w-[210px] shrink-0 items-center gap-3 rounded-xl border border-[#E1E7F2] bg-[#FBFCFF] px-3 py-3 text-left transition hover:-translate-y-0.5 hover:border-[#BFA8FF]"
          >
            <PlayerVisual player={signal.player} size="sm" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-black text-[#101947]">{signal.player.name}</span>
              <span className="mt-0.5 block text-xs font-bold text-[#6C7195]">
                {signal.player.team} · {formatPrice(signal.player.price)}
              </span>
            </span>
            <span className="text-right">
              <span className={`block text-lg font-black ${trendClass(signal.player)}`}>{trendGlyph(signal.player)}</span>
              <span className="block text-[10px] font-black text-[#6C7195]">{signal.score ?? "—"}</span>
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
          ? "border-[#6C1DFF] bg-[#6C1DFF] text-white shadow-[0_10px_24px_rgba(108,29,255,0.20)]"
          : "border-[#E1E7F2] bg-white text-[#4D5680] hover:border-[#BFA8FF] hover:text-[#6C1DFF]"
      }`}
    >
      {label}
    </button>
  );
}

function MarketToolbar({
  search,
  onSearch,
  signal,
  onSignal,
  position,
  onPosition,
  team,
  onTeam,
  maxPrice,
  onMaxPrice,
  sortKey,
  onSortKey,
  sortDirection,
  onSortDirection,
  teams,
  resultCount,
}: {
  search: string;
  onSearch: (value: string) => void;
  signal: SignalFilter;
  onSignal: (value: SignalFilter) => void;
  position: PositionFilter;
  onPosition: (value: PositionFilter) => void;
  team: string;
  onTeam: (value: string) => void;
  maxPrice: number;
  onMaxPrice: (value: number) => void;
  sortKey: SortKey;
  onSortKey: (value: SortKey) => void;
  sortDirection: SortDirection;
  onSortDirection: () => void;
  teams: string[];
  resultCount: number;
}) {
  return (
    <section className="sticky top-2 z-20 rounded-2xl border border-[#E1E7F2] bg-white/95 p-4 shadow-[0_18px_45px_rgba(15,23,60,0.08)] backdrop-blur-xl">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">Search player market</span>
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#6C7195]">⌕</span>
          <input
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            placeholder="Search player or club"
            className="h-12 w-full rounded-xl border border-[#DCE3F0] bg-[#FBFCFF] pl-10 pr-4 text-sm font-bold text-[#101947] outline-none transition placeholder:text-[#9299B3] focus:border-[#6C1DFF] focus:ring-4 focus:ring-[#6C1DFF]/10"
          />
        </label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:flex xl:shrink-0">
          <select
            value={team}
            onChange={(event) => onTeam(event.target.value)}
            className="h-12 rounded-xl border border-[#DCE3F0] bg-white px-3 text-xs font-black text-[#101947] outline-none focus:border-[#6C1DFF]"
            aria-label="Filter by team"
          >
            <option value="">All clubs</option>
            {teams.map((club) => (
              <option key={club} value={club}>{club}</option>
            ))}
          </select>
          <select
            value={maxPrice}
            onChange={(event) => onMaxPrice(Number(event.target.value))}
            className="h-12 rounded-xl border border-[#DCE3F0] bg-white px-3 text-xs font-black text-[#101947] outline-none focus:border-[#6C1DFF]"
            aria-label="Maximum price"
          >
            <option value={0}>Any price</option>
            <option value={5}>Under £5.0m</option>
            <option value={6}>Under £6.0m</option>
            <option value={7.5}>Under £7.5m</option>
            <option value={10}>Under £10.0m</option>
          </select>
          <select
            value={sortKey}
            onChange={(event) => onSortKey(event.target.value as SortKey)}
            className="h-12 rounded-xl border border-[#DCE3F0] bg-white px-3 text-xs font-black text-[#101947] outline-none focus:border-[#6C1DFF]"
            aria-label="Sort market"
          >
            <option value="score">Market score</option>
            <option value="projected">Next GW projection</option>
            <option value="three_gw">3-GW projection</option>
            <option value="form">Form</option>
            <option value="ownership">Ownership</option>
            <option value="price_change">Price movement</option>
            <option value="price">Price</option>
          </select>
          <button
            type="button"
            onClick={onSortDirection}
            className="h-12 rounded-xl border border-[#DCE3F0] bg-white px-3 text-xs font-black text-[#6C1DFF] transition hover:border-[#6C1DFF]"
          >
            {sortDirection === "desc" ? "Highest first ↓" : "Lowest first ↑"}
          </button>
        </div>
      </div>

      <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {SIGNALS.map((item) => (
          <FilterButton key={item} active={signal === item} label={item} onClick={() => onSignal(item)} />
        ))}
        <span className="mx-1 h-9 w-px shrink-0 bg-[#E1E7F2]" />
        {POSITIONS.map((item) => (
          <FilterButton key={item} active={position === item} label={item} onClick={() => onPosition(item)} />
        ))}
        <span className="ml-auto hidden shrink-0 items-center rounded-xl bg-[#F4EFFF] px-3 py-2 text-xs font-black text-[#6C1DFF] sm:flex">
          {resultCount} players
        </span>
      </div>
    </section>
  );
}

function MarketTable({
  signals,
  selectedId,
  onSelect,
}: {
  signals: MarketSignal[];
  selectedId?: number;
  onSelect: (signal: MarketSignal) => void;
}) {
  return (
    <section className="hidden overflow-hidden rounded-2xl border border-[#E1E7F2] bg-white shadow-[0_22px_60px_rgba(15,23,60,0.08)] md:block">
      <div className="overflow-x-auto">
        <div className="min-w-[1120px]">
          <div className="grid grid-cols-[42px_minmax(190px,1.7fr)_88px_72px_68px_80px_80px_62px_70px_100px_68px] items-center gap-3 border-b border-[#E1E7F2] bg-[#F6F8FC] px-4 py-3 text-[10px] font-black uppercase tracking-[0.12em] text-[#6C7195]">
            <span>#</span><span>Player</span><span>Signal</span><span>Price</span><span>Move</span><span>Next GW</span><span>3-GW</span><span>Form</span><span>Owned</span><span>Fixture</span><span>Score</span>
          </div>
          <div className="divide-y divide-[#EDF0F6]">
            {signals.map((signal, index) => {
              const player = signal.player;
              const selected = player.id === selectedId;
              return (
                <button
                  key={`market-row-${player.id}`}
                  type="button"
                  onClick={() => onSelect(signal)}
                  className={`grid w-full grid-cols-[42px_minmax(190px,1.7fr)_88px_72px_68px_80px_80px_62px_70px_100px_68px] items-center gap-3 px-4 py-3 text-left transition ${
                    selected ? "bg-[#F4EFFF]" : "bg-white hover:bg-[#FBFCFF]"
                  }`}
                >
                  <span className="text-xs font-black text-[#9299B3]">{String(index + 1).padStart(2, "0")}</span>
                  <span className="flex min-w-0 items-center gap-3">
                    <PlayerVisual player={player} size="sm" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-black text-[#101947]">{player.name}</span>
                      <span className="block text-xs font-bold text-[#6C7195]">{player.team} · {player.position}</span>
                    </span>
                  </span>
                  <span><SignalBadge value={signal.signal} /></span>
                  <span className="text-sm font-black text-[#101947]">{formatPrice(player.price)}</span>
                  <span className={`text-sm font-black ${trendClass(player)}`}>{formatMovement(player.price_movement)}</span>
                  <span className="text-sm font-black text-[#00A85A]">{formatProjection(player.projected)}</span>
                  <span className="text-sm font-black text-[#6C1DFF]">{formatProjection(player.three_gw_projected)}</span>
                  <span className="text-sm font-black text-[#101947]">{numberValue(player.form).toFixed(1)}</span>
                  <span className="text-sm font-black text-[#101947]">{numberValue(player.ownership).toFixed(1)}%</span>
                  <span><FixturePill fixture={player.fixture ?? "TBC"} difficulty={player.fixture_difficulty ?? 3} /></span>
                  <span className="text-right text-base font-black text-[#101947]">{signal.score ?? "—"}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

function MobileMarketCards({ signals, onSelect }: { signals: MarketSignal[]; onSelect: (signal: MarketSignal) => void }) {
  return (
    <div className="grid gap-3 md:hidden">
      {signals.map((signal, index) => {
        const player = signal.player;
        return (
          <button
            key={`mobile-market-${player.id}`}
            type="button"
            onClick={() => onSelect(signal)}
            className="rounded-2xl border border-[#E1E7F2] bg-white p-4 text-left shadow-[0_14px_34px_rgba(15,23,60,0.06)] transition active:scale-[0.99]"
          >
            <div className="flex items-start gap-3">
              <span className="pt-1 text-[10px] font-black text-[#9299B3]">{String(index + 1).padStart(2, "0")}</span>
              <PlayerVisual player={player} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-base font-black text-[#101947]">{player.name}</p>
                    <p className="text-xs font-bold text-[#6C7195]">{player.team} · {player.position} · {formatPrice(player.price)}</p>
                  </div>
                  <SignalBadge value={signal.signal} />
                </div>
                <div className="mt-3 grid grid-cols-4 gap-2">
                  <MobileMetric label="Next" value={formatProjection(player.projected)} tone="green" />
                  <MobileMetric label="3-GW" value={formatProjection(player.three_gw_projected)} tone="purple" />
                  <MobileMetric label="Form" value={numberValue(player.form).toFixed(1)} />
                  <MobileMetric label="Score" value={signal.score == null ? "—" : String(signal.score)} />
                </div>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <FixturePill fixture={player.fixture ?? "TBC"} difficulty={player.fixture_difficulty ?? 3} />
                  <span className={`text-xs font-black ${trendClass(player)}`}>{trendGlyph(player)} {formatMovement(player.price_movement)}</span>
                  <span className="text-xs font-black text-[#4D5680]">{numberValue(player.ownership).toFixed(1)}% own</span>
                </div>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function MobileMetric({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "green" | "purple" }) {
  const toneClass = tone === "green" ? "text-[#00A85A]" : tone === "purple" ? "text-[#6C1DFF]" : "text-[#101947]";
  return (
    <span className="rounded-lg bg-[#F6F8FC] px-2 py-2 text-center">
      <span className="block text-[9px] font-black uppercase tracking-[0.1em] text-[#9299B3]">{label}</span>
      <span className={`mt-0.5 block text-xs font-black ${toneClass}`}>{value}</span>
    </span>
  );
}

function PlayerDetail({ signal, onClose, mobile = false }: { signal: MarketSignal; onClose?: () => void; mobile?: boolean }) {
  const player = signal.player;
  return (
    <aside className={`${mobile ? "h-full overflow-y-auto rounded-t-[26px]" : "sticky top-[168px] rounded-2xl"} border border-[#E1E7F2] bg-white p-5 shadow-[0_24px_70px_rgba(15,23,60,0.16)]`}>
      {mobile ? (
        <div className="mb-4 flex items-center justify-between">
          <span className="h-1.5 w-12 rounded-full bg-[#DCE3F0]" />
          <button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full bg-[#F2F4FA] text-lg font-black text-[#4D5680]" aria-label="Close player details">×</button>
        </div>
      ) : null}
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <PlayerVisual player={player} size="lg" />
          <div className="min-w-0">
            <p className="truncate text-2xl font-black text-[#101947]">{player.name}</p>
            <p className="mt-1 text-sm font-bold text-[#6C7195]">{player.team} · {player.position} · {formatPrice(player.price)}</p>
          </div>
        </div>
        <SignalBadge value={signal.signal} />
      </div>

      <div className="mt-5 rounded-2xl border border-[#E1E7F2] bg-[#FBFCFF] p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#6C7195]">Market score</p>
            <p className="mt-1 text-3xl font-black text-[#101947]">{signal.score ?? "—"}</p>
          </div>
          <div className={`rounded-xl border px-3 py-2 text-right ${signalTone(signal.signal)}`}>
            <p className="text-[10px] font-black uppercase tracking-[0.12em]">Trend</p>
            <p className="mt-1 text-lg font-black">{trendGlyph(player)} {player.trend ?? "flat"}</p>
          </div>
        </div>
        {signal.score != null ? (
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#E7EBF3]">
            <div className="h-full rounded-full bg-[#6C1DFF] transition-all" style={{ width: `${Math.max(0, Math.min(100, signal.score))}%` }} />
          </div>
        ) : null}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <DetailMetric label="Next GW" value={`${formatProjection(player.projected)} pts`} tone="green" />
        <DetailMetric label="3-GW total" value={`${formatProjection(player.three_gw_projected)} pts`} tone="purple" />
        <DetailMetric label="Ownership" value={`${numberValue(player.ownership).toFixed(1)}%`} />
        <DetailMetric label="Form" value={numberValue(player.form).toFixed(1)} />
        <DetailMetric label="Price movement" value={formatMovement(player.price_movement)} tone={numberValue(player.price_movement) >= 0 ? "green" : "red"} />
        <div className="rounded-xl border border-[#E1E7F2] bg-white p-3">
          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#6C7195]">Next fixture</p>
          <div className="mt-2"><FixturePill fixture={player.fixture ?? "TBC"} difficulty={player.fixture_difficulty ?? 3} /></div>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-[#E1E7F2] bg-[#F7F4FF] p-4">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-[#6C1DFF]">Market thesis</p>
        <p className="mt-2 text-sm font-semibold leading-6 text-[#4D5680]">{signal.reason || "The market engine has ranked this player from projection, fixtures, minutes, ownership and value signals."}</p>
      </div>

      {player.status !== "Available" ? (
        <div className="mt-4 rounded-xl border border-[#FFD7E3] bg-[#FFF4F7] p-3 text-sm font-bold text-[#C80046]">
          Availability: {player.status}. Treat the projection with additional caution.
        </div>
      ) : null}

      <div className="mt-5 grid grid-cols-2 gap-3">
        <Link href={`/compare?player_a=${player.api_id ?? player.id}`} className="rounded-xl border border-[#6C1DFF] bg-white px-4 py-3 text-center text-sm font-black text-[#6C1DFF] transition hover:bg-[#F4EFFF]">
          Compare
        </Link>
        <Link href={`/watchlist?player_id=${player.api_id ?? player.id}`} className="rounded-xl bg-[#6C1DFF] px-4 py-3 text-center text-sm font-black text-white shadow-[0_14px_30px_rgba(108,29,255,0.24)]">
          Watch player
        </Link>
      </div>
    </aside>
  );
}

function DetailMetric({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "green" | "purple" | "red" }) {
  const toneClass = tone === "green" ? "text-[#00A85A]" : tone === "purple" ? "text-[#6C1DFF]" : tone === "red" ? "text-[#E90052]" : "text-[#101947]";
  return (
    <div className="rounded-xl border border-[#E1E7F2] bg-white p-3">
      <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#6C7195]">{label}</p>
      <p className={`mt-1 text-xl font-black ${toneClass}`}>{value}</p>
    </div>
  );
}

function OwnedAlerts({ signals, onSelect }: { signals: MarketSignal[]; onSelect: (signal: MarketSignal) => void }) {
  return (
    <section className="rounded-2xl border border-[#E1E7F2] bg-white p-5 shadow-[0_18px_45px_rgba(15,23,60,0.06)]">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#6C1DFF]">My squad exposure</p>
          <h2 className="mt-1 text-2xl font-black text-[#101947]">Owned-player alerts</h2>
          <p className="mt-1 text-sm font-semibold text-[#6C7195]">Market pressure affecting players already in your team.</p>
        </div>
        <span className="rounded-full bg-[#F4EFFF] px-3 py-2 text-xs font-black text-[#6C1DFF]">{signals.length} alerts</span>
      </div>
      {signals.length ? (
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {signals.slice(0, 6).map((signal) => (
            <button key={`owned-${signal.player.id}`} type="button" onClick={() => onSelect(signal)} className="rounded-xl border border-[#E1E7F2] bg-[#FBFCFF] p-3 text-left transition hover:border-[#BFA8FF]">
              <div className="flex items-center gap-3">
                <PlayerVisual player={signal.player} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-black text-[#101947]">{signal.player.name}</p>
                  <p className="text-xs font-bold text-[#6C7195]">{signal.player.team} · {signal.player.position}</p>
                </div>
                <SignalBadge value={signal.signal} />
              </div>
              <p className="mt-3 line-clamp-2 text-xs font-semibold leading-5 text-[#4D5680]">{signal.reason}</p>
            </button>
          ))}
        </div>
      ) : (
        <p className="mt-4 rounded-xl bg-[#F6F8FC] p-4 text-sm font-semibold text-[#6C7195]">No owned-player market alerts are active.</p>
      )}
    </section>
  );
}

function SignalGuide({ board }: { board: MarketBoard }) {
  const groups: MarketSignal["signal"][] = ["Buy", "Watch", "Hold", "Sell", "Avoid"];
  return (
    <details className="rounded-2xl border border-[#E1E7F2] bg-white p-5 shadow-[0_18px_45px_rgba(15,23,60,0.06)]">
      <summary className="cursor-pointer list-none text-base font-black text-[#101947] marker:hidden">
        How market signals are classified <span className="float-right text-[#6C1DFF]">＋</span>
      </summary>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        {groups.map((group) => (
          <div key={group} className="rounded-xl border border-[#E1E7F2] bg-[#FBFCFF] p-3">
            <SignalBadge value={group} />
            <p className="mt-3 text-xs font-semibold leading-5 text-[#4D5680]">{board.signal_explanations[group]}</p>
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

  const [search, setSearch] = useState("");
  const [signalFilter, setSignalFilter] = useState<SignalFilter>(
    SIGNALS.includes(initialSignal as SignalFilter) ? (initialSignal as SignalFilter) : "All",
  );
  const [positionFilter, setPositionFilter] = useState<PositionFilter>(
    POSITIONS.includes(initialPosition as PositionFilter) ? (initialPosition as PositionFilter) : "All",
  );
  const [teamFilter, setTeamFilter] = useState(initialTeam);
  const [maxPrice, setMaxPrice] = useState(initialMaxPrice || 0);
  const [sortKey, setSortKey] = useState<SortKey>("score");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);

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
  const teams = Array.from(new Set(universe.map((item) => item.player.team).filter(Boolean))).sort();

  const query = search.trim().toLowerCase();
  const filteredSignals = universe
    .filter((item) => !query || item.player.name.toLowerCase().includes(query) || item.player.team.toLowerCase().includes(query))
    .filter((item) => signalFilter === "All" || signalFilter === "My squad" || item.signal === signalFilter)
    .filter((item) => signalFilter !== "My squad" || ownedIds.has(item.player.id))
    .filter((item) => positionFilter === "All" || item.player.position === positionFilter)
    .filter((item) => !teamFilter || item.player.team === teamFilter)
    .filter((item) => !maxPrice || item.player.price <= maxPrice)
    .sort((a, b) => {
      const delta = scoreForSort(a, sortKey) - scoreForSort(b, sortKey);
      if (delta !== 0) return sortDirection === "desc" ? -delta : delta;
      return a.player.name.localeCompare(b.player.name);
    });

  const selectedSignal =
    filteredSignals.find((item) => item.player.id === selectedId) ??
    universe.find((item) => item.player.id === selectedId) ??
    filteredSignals[0] ??
    universe[0];

  const buys = universe.filter((item) => item.signal === "Buy");
  const sells = universe.filter((item) => item.signal === "Sell" || item.signal === "Avoid");
  const rising = universe.filter((item) => item.player.trend === "up");
  const falling = universe.filter((item) => item.player.trend === "down");
  const averageProjection = universe.length
    ? universe.reduce((sum, item) => sum + numberValue(item.player.projected), 0) / universe.length
    : 0;
  const ticker = [...universe].sort((a, b) => {
    const movementDelta = Math.abs(numberValue(b.player.price_movement)) - Math.abs(numberValue(a.player.price_movement));
    return movementDelta || numberValue(b.score) - numberValue(a.score);
  });

  function selectSignal(item: MarketSignal, mobile = false) {
    setSelectedId(item.player.id);
    if (mobile) setMobileDetailOpen(true);
  }

  return (
    <div className="space-y-5">
      <section className="relative overflow-hidden rounded-[26px] border border-[#111832] bg-[#070B28] p-5 text-white shadow-[0_30px_80px_rgba(7,11,40,0.28)] sm:p-7">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_20%,rgba(0,230,168,0.18),transparent_32%),radial-gradient(circle_at_86%_15%,rgba(108,29,255,0.30),transparent_34%)]" />
        <div className="absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(255,255,255,.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.08)_1px,transparent_1px)] [background-size:42px_42px]" />
        <div className="relative">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-2xl">
              <div className="flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-2 rounded-full border border-[#00E6A8]/25 bg-[#00E6A8]/10 px-3 py-1.5 text-xs font-black uppercase tracking-[0.14em] text-[#A7F3D0]">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-[#00E6A8]" /> Live player market
                </span>
                <DataModeBadge source={{ mode: "real", label: "Real backend connected" }} />
              </div>
              <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-5xl">Trade the projection market, not the noise.</h1>
              <p className="mt-3 max-w-xl text-sm font-semibold leading-6 text-white/65 sm:text-base">
                Rank the live market feed returned by the model using projection, value, form, fixtures, ownership and conviction. Open any row for the full thesis.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:min-w-[560px]">
              <MarketStat label="Market depth" value={String(universe.length)} detail="ranked players" />
              <MarketStat label="Buy signals" value={String(buys.length)} detail="positive setups" />
              <MarketStat label="Risk exits" value={String(sells.length)} detail="sell or avoid" />
              <MarketStat label="Avg projection" value={averageProjection.toFixed(1)} detail="next-GW points" />
            </div>
          </div>
          <div className="mt-6 flex flex-wrap gap-2 text-xs font-black text-white/60">
            <span className="rounded-full bg-white/[0.07] px-3 py-2">↗ {rising.length} rising</span>
            <span className="rounded-full bg-white/[0.07] px-3 py-2">↘ {falling.length} falling</span>
            <span className="rounded-full bg-white/[0.07] px-3 py-2">◎ {board.owned_squad_alerts.length} squad alerts</span>
            <span className="rounded-full bg-white/[0.07] px-3 py-2">Updated from live model output</span>
          </div>
        </div>
      </section>

      <MovementTicker signals={ticker} onSelect={(item) => selectSignal(item, true)} />

      <MarketToolbar
        search={search}
        onSearch={setSearch}
        signal={signalFilter}
        onSignal={setSignalFilter}
        position={positionFilter}
        onPosition={setPositionFilter}
        team={teamFilter}
        onTeam={setTeamFilter}
        maxPrice={maxPrice}
        onMaxPrice={setMaxPrice}
        sortKey={sortKey}
        onSortKey={setSortKey}
        sortDirection={sortDirection}
        onSortDirection={() => setSortDirection((current) => (current === "desc" ? "asc" : "desc"))}
        teams={teams}
        resultCount={filteredSignals.length}
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-3">
          <div className="flex items-end justify-between gap-4 px-1">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[#6C1DFF]">Market board</p>
              <h2 className="mt-1 text-2xl font-black text-[#101947]">{filteredSignals.length} ranked players</h2>
            </div>
            {board.full_market_locked ? (
              <span className="rounded-full bg-[#FFF4D7] px-3 py-2 text-xs font-black text-[#9A6400]">Preview depth</span>
            ) : (
              <span className="rounded-full bg-[#EFFFF5] px-3 py-2 text-xs font-black text-[#008A46]">Live market feed</span>
            )}
          </div>

          {filteredSignals.length ? (
            <>
              <MarketTable signals={filteredSignals} selectedId={selectedSignal?.player.id} onSelect={(item) => selectSignal(item)} />
              <MobileMarketCards signals={filteredSignals} onSelect={(item) => selectSignal(item, true)} />
            </>
          ) : (
            <section className="rounded-2xl border border-dashed border-[#CDD4E3] bg-white p-10 text-center shadow-[0_18px_45px_rgba(15,23,60,0.05)]">
              <p className="text-xl font-black text-[#101947]">No players match this market screen.</p>
              <p className="mt-2 text-sm font-semibold text-[#6C7195]">Clear one or more filters to restore market depth.</p>
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setSignalFilter("All");
                  setPositionFilter("All");
                  setTeamFilter("");
                  setMaxPrice(0);
                }}
                className="mt-5 rounded-xl bg-[#6C1DFF] px-5 py-3 text-sm font-black text-white"
              >
                Clear filters
              </button>
            </section>
          )}
        </div>

        <div className="hidden xl:block">{selectedSignal ? <PlayerDetail signal={selectedSignal} /> : null}</div>
      </div>

      <OwnedAlerts signals={board.owned_squad_alerts} onSelect={(item) => selectSignal(item, true)} />

      {board.full_market_locked ? (
        <section className="rounded-[22px] border border-[#17002F] bg-[#17002F] p-6 text-white shadow-[0_24px_60px_rgba(55,0,60,0.18)]">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#A7F3D0]">Market depth limited</p>
          <h2 className="mt-2 text-2xl font-black">Unlock deeper ranked market coverage</h2>
          <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-white/65">Higher-tier depth exposes the additional market coverage returned by the backend while keeping the same live projection model and ranking tools.</p>
          <Link href="/pricing" className="mt-5 inline-flex rounded-xl bg-[#00E6A8] px-5 py-3 text-sm font-black text-[#05070D]">View plans</Link>
        </section>
      ) : null}

      {directory.length ? (
        <details className="rounded-2xl border border-[#E1E7F2] bg-white p-5 shadow-[0_18px_45px_rgba(15,23,60,0.06)]">
          <summary className="cursor-pointer list-none text-base font-black text-[#101947] marker:hidden">
            Open head-to-head player comparison <span className="float-right text-[#6C1DFF]">＋</span>
          </summary>
          <div className="mt-5"><CompareAnyTwoPlayers directory={directory} /></div>
        </details>
      ) : null}

      <SignalGuide board={board} />

      {mobileDetailOpen && selectedSignal ? (
        <div className="fixed inset-0 z-[80] flex items-end bg-[#05070D]/55 p-0 backdrop-blur-sm xl:hidden" onClick={() => setMobileDetailOpen(false)}>
          <div className="max-h-[88vh] w-full" onClick={(event) => event.stopPropagation()}>
            <PlayerDetail signal={selectedSignal} mobile onClose={() => setMobileDetailOpen(false)} />
          </div>
        </div>
      ) : null}
    </div>
  );
}