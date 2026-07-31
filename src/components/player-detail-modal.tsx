"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getPlayerDetailCard, getPlayerGameweekProjections } from "@/lib/api";
import { formatPrice, FixturePill } from "@/components/fpl-ui";
import { SignalBadge } from "@/components/badges";
import { PlayerVisual } from "@/components/player-visual";
import type { Player, PlayerDetailCard, PlayerGameweekProjection } from "@/lib/types";

type PlayerDetailContextValue = {
  open: (player: Player) => void;
};

const PlayerDetailContext = createContext<PlayerDetailContextValue | null>(null);

// Every tab (Dashboard, My Team, Transfers, Scenarios, Planner, Captaincy, Compare, Watchlist -
// Market keeps its own richer inline row/panel) wraps player rows/chips in a button that calls
// this instead of duplicating a fetch-and-render-a-card story per page.
export function usePlayerDetail(): PlayerDetailContextValue {
  const ctx = useContext(PlayerDetailContext);
  if (!ctx) {
    throw new Error("usePlayerDetail must be used within a PlayerDetailProvider (mounted once in AppShell).");
  }
  return ctx;
}

export function PlayerDetailProvider({ children }: { children: React.ReactNode }) {
  const [activePlayer, setActivePlayer] = useState<Player | null>(null);

  const value = useMemo<PlayerDetailContextValue>(() => ({ open: (player: Player) => setActivePlayer(player) }), []);

  return (
    <PlayerDetailContext.Provider value={value}>
      {children}
      {activePlayer ? <PlayerDetailModal player={activePlayer} onClose={() => setActivePlayer(null)} /> : null}
    </PlayerDetailContext.Provider>
  );
}

type LoadState =
  | { phase: "loading" }
  | { phase: "ready"; card: PlayerDetailCard | null; gameweeks: PlayerGameweekProjection[] }
  | { phase: "error" };

function DetailMetric({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "green" | "purple" | "red" }) {
  const valueClass =
    tone === "green" ? "text-[#00A568]" : tone === "purple" ? "text-[#6C1DFF]" : tone === "red" ? "text-[#C80046]" : "text-[#0A1031]";
  return (
    <div className="rounded-xl border border-[#E1E7F2] bg-white p-3">
      <p className="text-[10px] font-black uppercase tracking-[0.1em] text-[#6C7195]">{label}</p>
      <p className={`mt-1 truncate text-lg font-black ${valueClass}`}>{value}</p>
    </div>
  );
}

function difficultyTone(difficulty: number | null) {
  if (difficulty == null) return "border-[#E1E7F2] bg-[#F6F8FC] text-[#6C7195]";
  if (difficulty <= 2) return "border-[#00C853]/30 bg-[#00C853]/12 text-[#008B3A]";
  if (difficulty === 3) return "border-[#FFB800]/35 bg-[#FFB800]/14 text-[#9A6900]";
  return "border-[#E90052]/25 bg-[#E90052]/10 text-[#C80046]";
}

function GameweekStrip({ gameweeks }: { gameweeks: PlayerGameweekProjection[] }) {
  if (!gameweeks.length) return null;
  const maxPoints = Math.max(1, ...gameweeks.map((gw) => gw.points));
  return (
    <div className="mt-4 rounded-2xl border border-[#E1E7F2] bg-white p-4">
      <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#6C7195]">Projection by gameweek</p>
      <div className="mt-3 space-y-2">
        {gameweeks.map((gw) => (
          <div key={gw.gameweek} className="flex items-center gap-3">
            <span className="w-9 shrink-0 text-xs font-black text-[#6C7195]">GW{gw.gameweek}</span>
            {gw.opponent ? (
              <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-black ${difficultyTone(gw.difficulty)}`}>
                {gw.opponent}
                {gw.home_away ? ` (${gw.home_away})` : ""}
              </span>
            ) : null}
            <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-[#EEF1F8]">
              <div className="h-full rounded-full bg-[#00A568]" style={{ width: `${Math.max(6, Math.min(100, (gw.points / maxPoints) * 100))}%` }} />
            </div>
            <span className="w-10 shrink-0 text-right text-xs font-black text-[#0A1031]">{gw.points.toFixed(1)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PlayerDetailModal({ player, onClose }: { player: Player; onClose: () => void }) {
  const [state, setState] = useState<LoadState>({ phase: "loading" });

  useEffect(() => {
    let cancelled = false;
    setState({ phase: "loading" });
    Promise.all([getPlayerDetailCard(player.id), getPlayerGameweekProjections(player.id)])
      .then(([cardResult, gwResult]) => {
        if (cancelled) return;
        setState({ phase: "ready", card: cardResult.data, gameweeks: gwResult.data });
      })
      .catch(() => {
        if (cancelled) return;
        setState({ phase: "error" });
      });
    return () => {
      cancelled = true;
    };
  }, [player.id]);

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const card = state.phase === "ready" ? state.card : null;
  const gameweeks = state.phase === "ready" ? state.gameweeks : [];
  const displayPlayer = card?.player ?? player;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center bg-[#05070D]/55 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-[26px] border border-[#E1E7F2] bg-white p-5 shadow-[0_24px_70px_rgba(15,23,60,0.2)] sm:rounded-[26px] sm:p-6"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`${displayPlayer.name} player details`}
      >
        <div className="mb-4 flex items-center justify-between sm:hidden">
          <span className="h-1.5 w-12 rounded-full bg-[#DCE3F0]" />
          <button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full bg-[#F2F4FA] text-lg font-black text-[#4D5680]" aria-label="Close player details">
            ×
          </button>
        </div>

        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <PlayerVisual player={displayPlayer} size="lg" />
            <div className="min-w-0">
              <p className="truncate text-2xl font-black text-[#0A1031]">{displayPlayer.name}</p>
              <p className="mt-1 text-sm font-bold text-[#6C7195]">
                {displayPlayer.team} · {displayPlayer.position} · {formatPrice(displayPlayer.price)}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {card ? <SignalBadge value={card.signal} /> : null}
            <button
              type="button"
              onClick={onClose}
              className="hidden h-9 w-9 place-items-center rounded-full bg-[#F2F4FA] text-lg font-black text-[#4D5680] sm:grid"
              aria-label="Close player details"
            >
              ×
            </button>
          </div>
        </div>

        {state.phase === "loading" ? (
          <div className="mt-5 space-y-3">
            <div className="h-24 animate-pulse rounded-2xl bg-[#F1F3F8]" />
            <div className="grid grid-cols-2 gap-3">
              <div className="h-16 animate-pulse rounded-xl bg-[#F1F3F8]" />
              <div className="h-16 animate-pulse rounded-xl bg-[#F1F3F8]" />
              <div className="h-16 animate-pulse rounded-xl bg-[#F1F3F8]" />
              <div className="h-16 animate-pulse rounded-xl bg-[#F1F3F8]" />
            </div>
          </div>
        ) : state.phase === "error" ? (
          <p className="mt-5 rounded-xl border border-dashed border-[#E1E7F2] bg-[#FBFCFF] p-4 text-sm font-semibold text-[#6C7195]">
            Couldn&apos;t load this player&apos;s full stats right now — try again in a moment.
          </p>
        ) : (
          <>
            {card?.market_score != null ? (
              <div className="mt-5 rounded-2xl border border-[#E1E7F2] bg-[#FBFCFF] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#6C7195]">Market score</p>
                    <p className="mt-1 text-3xl font-black text-[#0A1031]">{card.market_score.toFixed(0)}</p>
                  </div>
                  {displayPlayer.fixture ? (
                    <div className="text-right">
                      <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#6C7195]">Next fixture</p>
                      <div className="mt-1"><FixturePill fixture={displayPlayer.fixture} difficulty={displayPlayer.fixture_difficulty ?? 3} /></div>
                    </div>
                  ) : null}
                </div>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#E7EBF3]">
                  <div className="h-full rounded-full bg-[#6C1DFF] transition-all" style={{ width: `${Math.max(0, Math.min(100, card.market_score))}%` }} />
                </div>
              </div>
            ) : null}

            <div className="mt-4 grid grid-cols-2 gap-3">
              <DetailMetric label="Next GW" value={`${displayPlayer.projected.toFixed(1)} pts`} tone="green" />
              <DetailMetric label="Ownership" value={`${(displayPlayer.ownership ?? 0).toFixed(1)}%`} />
              {card?.total_points != null ? <DetailMetric label="Total points" value={String(card.total_points)} /> : null}
              {card?.points_per_game != null ? <DetailMetric label="Points per game" value={card.points_per_game.toFixed(1)} /> : null}
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3">
              {card?.expected_goals != null ? <DetailMetric label="xG (season)" value={card.expected_goals.toFixed(2)} tone="purple" /> : null}
              {card?.expected_assists != null ? <DetailMetric label="xA (season)" value={card.expected_assists.toFixed(2)} tone="purple" /> : null}
              {card ? <DetailMetric label="Minutes" value={String(card.minutes)} /> : null}
              {card ? <DetailMetric label="Starts" value={String(card.starts)} /> : null}
            </div>

            <GameweekStrip gameweeks={gameweeks} />

            {card?.reasons.length ? (
              <div className="mt-4 rounded-2xl border border-[#E1E7F2] bg-[#F7F4FF] p-4">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-[#6C1DFF]">Market thesis</p>
                <ul className="mt-2 space-y-1.5">
                  {card.reasons.map((reason, index) => (
                    <li key={index} className="text-sm font-semibold leading-6 text-[#4D5680]">{reason}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {displayPlayer.status !== "Available" ? (
              <div className="mt-4 rounded-xl border border-[#FFD7E3] bg-[#FFF4F7] p-3 text-sm font-bold text-[#C80046]">
                Availability: {displayPlayer.status}. Treat the projection with additional caution.
              </div>
            ) : null}

            <div className="mt-5 grid grid-cols-2 gap-3">
              <Link
                href={`/compare?player_a=${displayPlayer.id}`}
                onClick={onClose}
                className="rounded-xl border border-[#6C1DFF] bg-white px-4 py-3 text-center text-sm font-black text-[#6C1DFF] transition hover:bg-[#F4EFFF]"
              >
                Compare
              </Link>
              <Link
                href={`/watchlist?player_id=${displayPlayer.id}`}
                onClick={onClose}
                className="rounded-xl bg-[#6C1DFF] px-4 py-3 text-center text-sm font-black text-white shadow-[0_14px_30px_rgba(108,29,255,0.24)]"
              >
                Watch player
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
