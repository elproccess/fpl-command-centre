"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ApiRequestError, getGameweekCommandCentre, getImportTeamData, getSquadPlayerProjections, STRICT_BACKEND } from "@/lib/api";
import {
  appStateFromImport,
  commandCentrePayloadFromImport,
  DEMO_ENTRY_ID,
  FPL_ENTRY_COOKIE,
  FPL_EVENT_COOKIE,
  importedTeamFromResponse,
  IMPORTED_TEAM_ENTRY_COOKIE,
  IMPORTED_TEAM_EVENT_COOKIE,
  playersFromImport,
  readBrowserCookie,
  readImportedTeam,
  saveImportedTeam,
} from "@/lib/imported-team";
import type { CommandCentre, DataSourceStatus, Player, StoredImportedTeam, UserGameState } from "@/lib/types";
import { AppShell } from "./app-shell";
import { BackgroundAnalysisStrip } from "./background-analysis-strip";
import { MarketSignalCard, SquadHealthCard } from "./cards";
import { DeadlineStrip } from "./fpl-ui";
import { PlannerTimeline } from "./planner-timeline";
import { PlayerVisual } from "./player-visual";
import { usePolledAnalysis } from "./polled-analysis";
import { EmptyState, ErrorState, LoadingSpinner, LoadingState, TrustWarning } from "./states";

// Merges in real per-player projected points/ownership from the squad-health analysis (already
// computed as part of the background precompute, so this is usually an instant cache hit) in
// place of playersFromImport's zero-value placeholders. Falls back to the raw imported player
// untouched if enrichment hasn't resolved yet or a given player isn't found in the response.
function withRealProjections(players: Player[], enriched: Player[]): Player[] {
  if (!enriched.length) return players;
  const byId = new Map(enriched.map((player) => [player.api_id ?? player.id, player]));
  return players.map((player) => {
    const match = byId.get(player.api_id ?? player.id);
    if (!match) return player;
    return {
      ...player,
      projected: match.projected,
      three_gw_projected: match.three_gw_projected,
      ownership: match.ownership,
      form: match.form,
      price_movement: match.price_movement,
      trend: match.trend,
    };
  });
}

type DashboardStatus = "loading" | "missing" | "ready" | "error";
type CommandCentreStatus = "idle" | "loading" | "ready" | "error";

type DashboardDebug = {
  import_request_started: boolean;
  import_request_finished: boolean;
  imported_entry_id: string;
  imported_event: string;
  imported_squad_count: number;
  displayed_squad_count: number;
  using_imported_squad: boolean;
  using_mock_data: boolean;
  strict_backend: boolean;
  command_centre_request_started: boolean;
  command_centre_request_finished: boolean;
  command_centre_endpoint: string;
  command_centre_error: string;
  import_error: string;
};

const LIGHTWEIGHT_COMMAND_TIMEOUT_MS = 90000;
const FULL_COMMAND_TIMEOUT_MS = 120000;

const initialDebug: DashboardDebug = {
  import_request_started: false,
  import_request_finished: false,
  imported_entry_id: "",
  imported_event: "",
  imported_squad_count: 0,
  displayed_squad_count: 0,
  using_imported_squad: false,
  using_mock_data: false,
  strict_backend: STRICT_BACKEND,
  command_centre_request_started: false,
  command_centre_request_finished: false,
  command_centre_endpoint: "POST /gameweek-command-centre/dashboard",
  command_centre_error: "",
  import_error: "",
};

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Dashboard request failed.";
}

function eventParam(value: string | null | undefined) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : undefined;
}

// Same cookie/query/stored resolution the load effect below always ran inline - pulled out so
// both the effect and the display-cache seed (see readDashboardCache) resolve identity the exact
// same way, rather than risking the two drifting apart into different entry_id/event values.
function resolveAuthoritativeIdentity(queryEntryId: string, queryEvent: number | undefined) {
  const stored = readImportedTeam();
  // My Team is rendered on the server and resolves the imported team from these cookies.
  // The Dashboard must use the same identity source instead of treating a saved localStorage
  // roster as current merely because its entry ID and gameweek still match.
  const cookieEntryId = (
    readBrowserCookie(FPL_ENTRY_COOKIE) ??
    readBrowserCookie(IMPORTED_TEAM_ENTRY_COOKIE) ??
    ""
  ).trim();
  const cookieEvent = eventParam(
    readBrowserCookie(FPL_EVENT_COOKIE) ??
    readBrowserCookie(IMPORTED_TEAM_EVENT_COOKIE),
  );
  const entryId = cookieEntryId || queryEntryId || stored?.entry_id || "";
  const event = cookieEvent ?? queryEvent ?? eventParam(stored?.event ? String(stored.event) : undefined);
  return { entryId, event };
}

type DashboardDisplayCacheEntry = {
  imported: StoredImportedTeam;
  commandCentre: CommandCentre | null;
  dataSource: DataSourceStatus | undefined;
  savedAt: number;
};

// Module-level (not component state) so it survives this component unmounting and remounting on
// route navigation within the same tab - the whole point is to skip the blank-screen reload on a
// return visit. Deliberately does NOT replace the effect's own re-import below: this only decides
// whether the user sees a spinner while that re-check runs, never whether the re-check happens -
// a stale local roster must still never be trusted as current on its own (see
// resolveAuthoritativeIdentity's own comment on why the Dashboard always re-imports).
const DASHBOARD_DISPLAY_CACHE_TTL_MS = 3 * 60 * 60 * 1000;
const dashboardDisplayCache = new Map<string, DashboardDisplayCacheEntry>();

// Keyed by entryId ONLY, not entryId+event - see squad/page.tsx's identical squadCacheKey for
// the full explanation: an "event" read from a stored cookie/localStorage value can itself be
// stale relative to a fresh resolution (found live: an off-season planning_event vs raw gameweek
// mismatch), so a stale entry keyed under the OLD event value never gets overwritten and can
// flash back a genuinely different squad on a later visit. One slot per entry, always
// overwritten by the most recent real fetch, removes that stale-orphan-slot possibility.
function dashboardCacheKey(entryId: string) {
  return entryId;
}

function readDashboardDisplayCache(entryId: string): DashboardDisplayCacheEntry | null {
  if (!entryId) return null;
  const key = dashboardCacheKey(entryId);
  const entry = dashboardDisplayCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.savedAt > DASHBOARD_DISPLAY_CACHE_TTL_MS) {
    dashboardDisplayCache.delete(key);
    return null;
  }
  return entry;
}

function writeDashboardDisplayCache(entryId: string, snapshot: Omit<DashboardDisplayCacheEntry, "savedAt">) {
  if (!entryId) return;
  dashboardDisplayCache.set(dashboardCacheKey(entryId), { ...snapshot, savedAt: Date.now() });
}

function commandCentreErrorMessage(error: unknown) {
  const message = errorMessage(error);
  if (message.toLowerCase().includes("abort") || message.toLowerCase().includes("aborted")) {
    return `Command Centre failed/timed out. ${message}`;
  }
  return `Command Centre failed/timed out. ${message}`;
}

function importedTeamFromDashboardFetch(response: Parameters<typeof importedTeamFromResponse>[0], requestedEvent?: number) {
  const imported = importedTeamFromResponse(response);
  if (!requestedEvent) return imported;
  return {
    ...imported,
    event: requestedEvent,
    gameweek: requestedEvent,
  };
}

function projected(player?: Player | null) {
  const value = player?.projected;
  return value != null && Number.isFinite(value) ? value : null;
}

function formatProjected(value: number | null | undefined, loading = false) {
  if (loading) return "…";
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value.toFixed(1)} pts`;
}

function formatPrice(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "—";
  return `£${value.toFixed(1)}m`;
}

function riskTone(value: string) {
  if (value === "High" || value === "Critical") return "border-[#FFD0DF] bg-[#FFF0F5] text-[#C80046]";
  if (value === "Medium" || value === "Fragile") return "border-[#FFE0A3] bg-[#FFF8E8] text-[#A86B00]";
  return "border-[#BDEFD2] bg-[#EFFFF5] text-[#008B49]";
}

function roleFor(player: Player, captainId?: number, viceCaptainId?: number) {
  if (player.id === captainId) return "C" as const;
  if (player.id === viceCaptainId) return "V" as const;
  return undefined;
}

function PlayerRoleBadge({ role, compact = false }: { role?: "C" | "V"; compact?: boolean }) {
  if (!role) return null;
  return (
    <span
      className={`absolute z-20 grid place-items-center rounded-full border-2 border-white font-black text-white shadow-[0_6px_16px_rgba(0,0,0,0.28)] ${
        compact ? "-right-1 -top-1 h-5 w-5 text-[8px]" : "-right-1.5 -top-1.5 h-6 w-6 text-[10px]"
      } ${role === "C" ? "bg-[#FFB800]" : "bg-[#3C80FF]"}`}
    >
      {role}
    </span>
  );
}

function DesktopPitchPlayer({ player, role, loading }: { player: Player; role?: "C" | "V"; loading?: boolean }) {
  const noFixtureData = !loading && player.team_has_fixture === false;
  return (
    <div className="group flex min-w-0 flex-col items-center">
      <div className="relative">
        <span className="absolute inset-x-2 bottom-0 h-7 rounded-full bg-black/22 blur-md transition group-hover:bg-black/30" />
        <div className="relative rounded-full ring-2 ring-white/20 transition duration-200 group-hover:-translate-y-1 group-hover:ring-white/45">
          <PlayerVisual player={player} size="md" />
        </div>
        <PlayerRoleBadge role={role} />
      </div>
      <div className="relative mt-1.5 w-[104px] overflow-hidden rounded-lg border border-white/16 bg-[#06172B]/88 px-2 py-1.5 text-center shadow-[0_8px_18px_rgba(0,0,0,0.24)] backdrop-blur-md">
        <p className="truncate text-[11px] font-black leading-tight text-white">{player.name}</p>
        <div className="mt-1 flex items-center justify-center gap-1.5">
          <span className="text-[9px] font-bold text-white/48">{player.team}</span>
          <span className="h-1 w-1 rounded-full bg-white/25" />
          <span className={`text-[9px] font-black ${noFixtureData ? "text-[#FFD58A]" : "text-[#9FF3CC]"}`}>
            {noFixtureData ? "No fixture" : formatProjected(projected(player), loading)}
          </span>
        </div>
      </div>
    </div>
  );
}

function rowWidthClass(count: number) {
  if (count <= 1) return "max-w-[170px]";
  if (count === 2) return "max-w-[390px]";
  if (count === 3) return "max-w-[590px]";
  if (count === 4) return "max-w-[760px]";
  return "max-w-[900px]";
}

function DesktopPitchRow({ players, captainId, viceCaptainId, loading }: { players: Player[]; captainId?: number; viceCaptainId?: number; loading?: boolean }) {
  if (!players.length) return <div />;
  return (
    <div className={`mx-auto flex w-full items-center justify-around gap-2 ${rowWidthClass(players.length)}`}>
      {players.map((player) => (
        <DesktopPitchPlayer key={player.id} player={player} role={roleFor(player, captainId, viceCaptainId)} loading={loading} />
      ))}
    </div>
  );
}

function PitchMarkings() {
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      <div className="absolute inset-[14px] rounded-[22px] border-2 border-white/48" />
      <div className="absolute left-[14px] right-[14px] top-1/2 h-px -translate-y-1/2 bg-white/42" />
      <div className="absolute left-1/2 top-1/2 h-36 w-36 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/42" />
      <div className="absolute left-1/2 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/65" />
      <div className="absolute left-1/2 top-[14px] h-[92px] w-[42%] -translate-x-1/2 border-x-2 border-b-2 border-white/42" />
      <div className="absolute left-1/2 top-[14px] h-[40px] w-[19%] -translate-x-1/2 border-x-2 border-b-2 border-white/42" />
      <div className="absolute bottom-[14px] left-1/2 h-[92px] w-[42%] -translate-x-1/2 border-x-2 border-t-2 border-white/42" />
      <div className="absolute bottom-[14px] left-1/2 h-[40px] w-[19%] -translate-x-1/2 border-x-2 border-t-2 border-white/42" />
      <div className="absolute left-1/2 top-[78px] h-2 w-2 -translate-x-1/2 rounded-full bg-white/55" />
      <div className="absolute bottom-[78px] left-1/2 h-2 w-2 -translate-x-1/2 rounded-full bg-white/55" />
      <div className="absolute left-1/2 top-[14px] h-2 w-[15%] -translate-x-1/2 -translate-y-full rounded-t-lg border-x-2 border-t-2 border-white/35" />
      <div className="absolute bottom-[14px] left-1/2 h-2 w-[15%] -translate-x-1/2 translate-y-full rounded-b-lg border-x-2 border-b-2 border-white/35" />
    </div>
  );
}

function DesktopPitch({ players, captainId, viceCaptainId, loading }: { players: Player[]; captainId?: number; viceCaptainId?: number; loading?: boolean }) {
  const rows = (["FWD", "MID", "DEF", "GK"] as const).map((position) => players.filter((player) => player.position === position));
  return (
    <div className="relative hidden min-h-[700px] overflow-hidden rounded-[26px] border border-[#0A7B46] bg-[#0B9B55] shadow-[0_26px_55px_rgba(4,90,49,0.22),inset_0_0_0_1px_rgba(255,255,255,0.12)] md:block">
      <div className="absolute inset-0 bg-[repeating-linear-gradient(90deg,rgba(255,255,255,0.055)_0,rgba(255,255,255,0.055)_12.5%,rgba(0,0,0,0.018)_12.5%,rgba(0,0,0,0.018)_25%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.035),rgba(0,0,0,0.08))]" />
      <PitchMarkings />
      <div className="relative z-10 grid min-h-[700px] grid-rows-[1fr_1.08fr_1.08fr_.9fr] content-between px-8 py-9 lg:px-12 lg:py-10">
        {rows.map((row, index) => (
          <div key={index} className="grid content-center">
            <DesktopPitchRow players={row} captainId={captainId} viceCaptainId={viceCaptainId} loading={loading} />
          </div>
        ))}
      </div>
      <div className="absolute bottom-4 left-4 z-20 flex items-center gap-2 rounded-full border border-white/14 bg-[#062318]/54 px-3 py-1.5 text-[10px] font-black text-white/72 backdrop-blur-md">
        <span className={`h-2 w-2 rounded-full ${loading ? "animate-pulse bg-[#FFB800]" : "bg-[#A7F3D0]"}`} /> {loading ? "Loading projections" : "Live projections"}
      </div>
    </div>
  );
}

function MobilePitchPlayer({ player, role, loading }: { player: Player; role?: "C" | "V"; loading?: boolean }) {
  const noFixtureData = !loading && player.team_has_fixture === false;
  return (
    <div className="flex min-w-0 flex-col items-center">
      <div className="relative">
        <div className="rounded-full ring-1 ring-white/25">
          <PlayerVisual player={player} size="sm" />
        </div>
        <PlayerRoleBadge role={role} compact />
      </div>
      <div className="mt-1 w-full max-w-[66px] rounded-md border border-white/12 bg-[#06172B]/88 px-1 py-1 text-center backdrop-blur-md">
        <p className="truncate text-[8px] font-black leading-tight text-white">{player.name}</p>
        <p className={`mt-0.5 truncate text-[8px] font-black ${noFixtureData ? "text-[#FFD58A]" : "text-[#9FF3CC]"}`}>
          {noFixtureData ? "No fixture" : formatProjected(projected(player), loading)}
        </p>
      </div>
    </div>
  );
}

function MobilePitchRow({ players, captainId, viceCaptainId, loading }: { players: Player[]; captainId?: number; viceCaptainId?: number; loading?: boolean }) {
  if (!players.length) return <div />;
  return (
    <div className="grid w-full items-start gap-1" style={{ gridTemplateColumns: `repeat(${players.length}, minmax(0, 1fr))` }}>
      {players.map((player) => (
        <MobilePitchPlayer key={player.id} player={player} role={roleFor(player, captainId, viceCaptainId)} loading={loading} />
      ))}
    </div>
  );
}

function MobilePitch({ players, captainId, viceCaptainId, loading }: { players: Player[]; captainId?: number; viceCaptainId?: number; loading?: boolean }) {
  const rows = (["FWD", "MID", "DEF", "GK"] as const).map((position) => players.filter((player) => player.position === position));
  return (
    <div className="relative min-h-[590px] overflow-hidden rounded-[22px] border border-[#087744] bg-[#0B9B55] shadow-[0_20px_45px_rgba(4,90,49,0.20)] md:hidden">
      <div className="absolute inset-0 bg-[repeating-linear-gradient(90deg,rgba(255,255,255,0.055)_0,rgba(255,255,255,0.055)_16.66%,rgba(0,0,0,0.018)_16.66%,rgba(0,0,0,0.018)_33.33%)]" />
      <div className="absolute inset-[9px] rounded-[17px] border border-white/45" />
      <div className="absolute left-[9px] right-[9px] top-1/2 h-px bg-white/40" />
      <div className="absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/40" />
      <div className="absolute left-1/2 top-[9px] h-16 w-[46%] -translate-x-1/2 border-x border-b border-white/40" />
      <div className="absolute bottom-[9px] left-1/2 h-16 w-[46%] -translate-x-1/2 border-x border-t border-white/40" />
      <div className="relative z-10 grid min-h-[590px] grid-rows-[1fr_1.08fr_1.08fr_.88fr] content-between px-2.5 py-7">
        {rows.map((row, index) => (
          <div key={index} className="grid content-center">
            <MobilePitchRow players={row} captainId={captainId} viceCaptainId={viceCaptainId} loading={loading} />
          </div>
        ))}
      </div>
    </div>
  );
}

function SquadPitch({ players, captainId, viceCaptainId, loading }: { players: Player[]; captainId?: number; viceCaptainId?: number; loading?: boolean }) {
  return (
    <>
      <DesktopPitch players={players} captainId={captainId} viceCaptainId={viceCaptainId} loading={loading} />
      <MobilePitch players={players} captainId={captainId} viceCaptainId={viceCaptainId} loading={loading} />
    </>
  );
}

type DashboardGlyphName =
  | "captain"
  | "check"
  | "decision"
  | "engine"
  | "health"
  | "market"
  | "planner"
  | "route"
  | "squad"
  | "transfer"
  | "warning";

function DashboardGlyph({
  name,
  className = "h-5 w-5",
}: {
  name: DashboardGlyphName;
  className?: string;
}) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.9,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  const paths: Record<DashboardGlyphName, ReactNode> = {
    captain: (
      <>
        <circle cx="12" cy="12" r="8" />
        <path d="M15.5 8.5a5 5 0 1 0 0 7" />
      </>
    ),
    check: <path d="m5 12 4 4 10-10" />,
    decision: (
      <>
        <path d="M5 6h14v12H5z" />
        <path d="m8 10 2 2 5-5" />
        <path d="M8 15h8" />
      </>
    ),
    engine: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" />
      </>
    ),
    health: (
      <>
        <path d="M12 20s-7-3.9-7-9.8A4.2 4.2 0 0 1 12 7a4.2 4.2 0 0 1 7 3.2C19 16.1 12 20 12 20Z" />
        <path d="M8 12h2l1-2 2 4 1-2h2" />
      </>
    ),
    market: (
      <>
        <path d="M4 18V9M10 18V5M16 18V12" />
        <path d="m3 7 5-4 4 3 8-4" />
      </>
    ),
    planner: (
      <>
        <rect x="4" y="5" width="16" height="15" rx="2" />
        <path d="M8 3v4M16 3v4M7.5 11h3M13.5 11h3M7.5 15h3M13.5 15h3" />
      </>
    ),
    route: (
      <>
        <circle cx="5" cy="17" r="2" />
        <circle cx="19" cy="7" r="2" />
        <path d="M7 17h3c4 0 2-10 7-10" />
      </>
    ),
    squad: (
      <>
        <circle cx="8" cy="8" r="3" />
        <circle cx="17" cy="9" r="2.5" />
        <path d="M3 20c0-4 2-6 5-6s5 2 5 6" />
        <path d="M14 15c3.5-.5 6 1 6 5" />
      </>
    ),
    transfer: (
      <>
        <path d="M4 8h14" />
        <path d="m14 4 4 4-4 4" />
        <path d="M20 16H6" />
        <path d="m10 12-4 4 4 4" />
      </>
    ),
    warning: (
      <>
        <path d="M12 3 21 20H3L12 3Z" />
        <path d="M12 8v5M12 17h.01" />
      </>
    ),
  };

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} {...common}>
      {paths[name]}
    </svg>
  );
}

function DashboardSectionHeading({
  eyebrow,
  title,
  body,
  action,
}: {
  eyebrow: string;
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#6C1DFF]">{eyebrow}</p>
        <h2 className="mt-2 text-2xl font-black tracking-[-0.035em] text-[#15052B] sm:text-3xl">{title}</h2>
        {body ? <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-[#776A80]">{body}</p> : null}
      </div>
      {action}
    </div>
  );
}

function OperatingMetric({
  label,
  value,
  detail,
  tone = "default",
}: {
  label: string;
  value: string;
  detail?: string;
  tone?: "default" | "green" | "purple" | "amber";
}) {
  const valueTone =
    tone === "green"
      ? "text-[#008D57]"
      : tone === "purple"
        ? "text-[#6C1DFF]"
        : tone === "amber"
          ? "text-[#AD6900]"
          : "text-[#15052B]";

  return (
    <div className="min-w-0 border-t border-[#E9E2F0] bg-white px-4 py-4 sm:border-l sm:border-t-0 sm:px-5">
      <p className="text-[9px] font-black uppercase tracking-[0.13em] text-[#8A7E93]">{label}</p>
      <p className={`mt-1.5 truncate text-xl font-black tracking-[-0.025em] sm:text-2xl ${valueTone}`}>{value}</p>
      {detail ? <p className="mt-1 truncate text-[10px] font-semibold text-[#81758A]">{detail}</p> : null}
    </div>
  );
}

function OperatingNode({
  index,
  icon,
  label,
  value,
  active,
}: {
  index: number;
  icon: DashboardGlyphName;
  label: string;
  value: string;
  active?: boolean;
}) {
  return (
    <div className="relative min-w-0">
      <div className="flex min-w-0 items-center gap-3">
        <span
          className={`relative z-10 grid h-9 w-9 shrink-0 place-items-center rounded-[12px] border ${
            active
              ? "border-[#8CFFD5]/30 bg-[#8CFFD5] text-[#063D2A] shadow-[0_10px_24px_rgba(140,255,213,0.16)]"
              : "border-white/12 bg-white/[0.07] text-white/68"
          }`}
        >
          <DashboardGlyph name={icon} className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="text-[8px] font-black uppercase tracking-[0.12em] text-white/38">
            {String(index).padStart(2, "0")} · {label}
          </p>
          <p className="mt-1 truncate text-xs font-black text-white">{value}</p>
        </div>
      </div>
    </div>
  );
}

function DashboardHero({
  state,
  players,
  commandCentre,
  commandStatus,
  projectionsLoading,
}: {
  state: UserGameState;
  players: Player[];
  commandCentre: CommandCentre | null;
  commandStatus: CommandCentreStatus;
  projectionsLoading: boolean;
}) {
  const starters = players.slice(0, 11);
  const currentCaptain =
    players.find((player) => player.role === "captain") ??
    starters[0] ??
    players[0];
  const projectedTotal = starters.reduce((sum, player) => sum + (projected(player) ?? 0), 0);
  const healthScore = commandCentre?.squad_health.score;
  // See DecisionBrief's identical comment - a lightweight best_move is a real placeholder object
  // (route_id "lightweight_roll_reference"), not an analyzed recommendation, so the hero headline
  // must not present it as one.
  const move = commandCentre?.lightweight ? undefined : commandCentre?.best_move;
  const analysisReady = commandStatus === "ready";
  const statusLabel =
    commandStatus === "ready"
      ? commandCentre?.lightweight
        ? "Quick decision ready"
        : "Full command state ready"
      : commandStatus === "error"
        ? "Analysis needs attention"
        : "Decision engine running";

  return (
    <section className="relative mb-6 overflow-hidden rounded-[30px] border border-[#D8C9F4] bg-white shadow-[0_30px_80px_rgba(46,14,68,0.10)]">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -right-24 -top-32 h-80 w-80 rounded-full bg-[#6C1DFF]/10 blur-3xl" />
        <div className="absolute bottom-[-120px] left-[28%] h-64 w-64 rounded-full bg-[#00A86B]/8 blur-3xl" />
        <div className="absolute inset-0 opacity-[0.035] [background-image:linear-gradient(#6C1DFF_1px,transparent_1px),linear-gradient(90deg,#6C1DFF_1px,transparent_1px)] [background-size:48px_48px]" />
      </div>

      <div className="relative grid lg:grid-cols-[minmax(0,1fr)_410px]">
        <div className="p-5 sm:p-7 lg:p-8">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[#6C1DFF] px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.14em] text-white">
              Matchday OS Beta
            </span>
            <span className="rounded-full border border-[#BEEAD2] bg-[#EDFFF5] px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.12em] text-[#008D57]">
              {state.gameweek_label} operating state
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#E3DAEC] bg-white/80 px-3 py-1.5 text-[9px] font-black text-[#786B82]">
              {!analysisReady && commandStatus !== "error" ? <LoadingSpinner className="h-3 w-3 text-[#6C1DFF]" /> : null}
              {statusLabel}
            </span>
          </div>

          <p className="mt-6 text-[10px] font-black uppercase tracking-[0.18em] text-[#6C1DFF]">Gameweek operating brief</p>
          <h2 className="mt-2 max-w-4xl text-4xl font-black leading-[0.98] tracking-[-0.052em] text-[#15052B] sm:text-5xl">
            {state.team_name}
            <span className="mt-1 flex items-center gap-2.5 text-[#6C1DFF]">
              {!move && commandStatus !== "error" ? <LoadingSpinner className="h-7 w-7 shrink-0" /> : null}
              {move?.move || (commandStatus === "error" ? "Decision unavailable" : "Decision state building")}
            </span>
          </h2>

          <p className="mt-5 max-w-3xl text-sm font-semibold leading-7 text-[#695D73] sm:text-base">
            Your current XI, this gameweek&apos;s action, captaincy and the route after it are resolved as one connected squad state.
          </p>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/transfers"
              className="inline-flex items-center justify-center gap-2 rounded-[14px] bg-[#6C1DFF] px-5 py-3 text-sm font-black text-white shadow-[0_16px_36px_rgba(108,29,255,0.23)] transition hover:-translate-y-0.5 hover:bg-[#7A2EFF]"
            >
              Open this GW decision
              <DashboardGlyph name="transfer" className="h-4 w-4" />
            </Link>
            <Link
              href="/planner"
              className="inline-flex items-center justify-center gap-2 rounded-[14px] border border-[#D7C9E8] bg-white px-5 py-3 text-sm font-black text-[#281337] transition hover:border-[#BDA6EA] hover:bg-[#FAF7FF]"
            >
              Follow the multi-GW route
              <DashboardGlyph name="route" className="h-4 w-4 text-[#6C1DFF]" />
            </Link>
          </div>
        </div>

        <div className="relative overflow-hidden border-t border-[#E6DDED] bg-[#11091B] p-5 text-white sm:p-6 lg:border-l lg:border-t-0">
          <div className="pointer-events-none absolute -right-12 -top-16 text-[210px] font-black leading-none text-white/[0.035]">
            {state.gameweek}
          </div>
          <div className="pointer-events-none absolute -bottom-24 -left-20 h-56 w-56 rounded-full bg-[#6C1DFF]/25 blur-3xl" />

          <div className="relative">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.15em] text-[#BFAAFF]">Decision chain</p>
                <h3 className="mt-1 text-xl font-black">One squad state</h3>
              </div>
              <span className={`h-2.5 w-2.5 rounded-full ${analysisReady ? "bg-[#8CFFD5] shadow-[0_0_16px_#8CFFD5]" : "animate-pulse bg-[#FFB800]"}`} />
            </div>

            <div className="relative mt-6 space-y-5">
              <div className="absolute bottom-4 left-[17px] top-4 w-px bg-[linear-gradient(#6C1DFF,#8CFFD5)] opacity-45" />
              <OperatingNode index={1} icon="squad" label="Current XI" value={`${starters.length} starters loaded`} active />
              <OperatingNode index={2} icon="decision" label="This GW" value={move?.recommended_action || "Calculating action"} active={Boolean(move)} />
              <OperatingNode index={3} icon="captain" label="Captaincy" value={currentCaptain?.name || "Current armband"} active={Boolean(currentCaptain)} />
              <OperatingNode index={4} icon="route" label="Future route" value={commandCentre?.planner?.length ? `${commandCentre.planner.length} GWs mapped` : "Route preparing"} active={Boolean(commandCentre?.planner?.length)} />
            </div>

            <div className="mt-6 rounded-[18px] border border-white/10 bg-white/[0.055] p-4">
              <p className="text-[8px] font-black uppercase tracking-[0.13em] text-white/38">Decision signal</p>
              <div className="mt-2 flex items-end justify-between gap-3">
                <div>
                  <p className="text-2xl font-black text-[#8CFFD5]">
                    {move ? `${move.expected_gain > 0 ? "+" : ""}${move.expected_gain}` : "—"}
                  </p>
                  <p className="mt-1 text-[9px] font-bold text-white/44">Expected gain</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-black text-white">{move?.confidence_band || "Pending"}</p>
                  <p className="mt-1 text-[9px] font-bold text-white/44">Confidence</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="relative grid border-t border-[#E9E2F0] sm:grid-cols-4">
        <OperatingMetric
          label="Projected XI"
          value={projectionsLoading ? "…" : projectedTotal > 0 ? `${projectedTotal.toFixed(1)} pts` : "—"}
          detail="Current starting eleven"
          tone="purple"
        />
        <OperatingMetric
          label="Squad health"
          value={healthScore == null ? "—" : `${Math.round(healthScore)}%`}
          detail={commandCentre?.squad_health.grade ?? "Analysis preparing"}
          tone={healthScore != null && healthScore >= 70 ? "green" : "amber"}
        />
        <OperatingMetric label="Free transfers" value={String(state.free_transfers)} detail="Available this GW" />
        <OperatingMetric label="Bank" value={`£${state.bank.toFixed(1)}m`} detail={state.deadline_label} />
      </div>
    </section>
  );
}

function CommandCentrePanel({
  status,
  elapsedSeconds,
  error,
  upgrading,
  upgradeError,
  isLightweight,
  onLoadFull,
  onRetry,
}: {
  status: CommandCentreStatus;
  elapsedSeconds: number;
  error: string;
  upgrading: boolean;
  upgradeError: string;
  isLightweight: boolean;
  onLoadFull: () => void;
  onRetry: () => void;
}) {
  const ready = status === "ready";
  const statusCopy =
    status === "loading"
      ? `Building the decision state${elapsedSeconds ? ` · ${elapsedSeconds}s` : ""}`
      : status === "error"
        ? "The analysis engine needs attention"
        : ready && isLightweight
          ? "Quick decision state is available"
          : "Full operating state is online";

  return (
    <section className="overflow-hidden rounded-[22px] border border-[#E1D8EC] bg-white shadow-[0_18px_45px_rgba(44,14,64,0.065)]">
      <div className="flex items-start justify-between gap-4 p-5">
        <div className="flex min-w-0 gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[14px] bg-[#F0E8FF] text-[#6C1DFF]">
            <DashboardGlyph name="engine" />
          </span>
          <div className="min-w-0">
            <p className="text-[9px] font-black uppercase tracking-[0.15em] text-[#6C1DFF]">Analysis engine</p>
            <h3 className="mt-1 text-lg font-black text-[#15052B]">{statusCopy}</h3>
            <p className="mt-2 text-xs font-semibold leading-5 text-[#776A80]">
              The imported squad stays visible while deeper route, market and planner layers finish.
            </p>
          </div>
        </div>
        <span className={`mt-1 h-3 w-3 shrink-0 rounded-full ${status === "loading" || upgrading ? "animate-pulse bg-[#FFB800]" : status === "error" ? "bg-[#E90052]" : "bg-[#00C853]"}`} />
      </div>

      <div className="grid grid-cols-2 border-t border-[#EEE7F3]">
        <button
          type="button"
          onClick={onRetry}
          disabled={status === "loading" || upgrading}
          className="border-r border-[#EEE7F3] px-4 py-3 text-xs font-black text-[#6C1DFF] transition hover:bg-[#FAF7FF] disabled:cursor-wait disabled:opacity-45"
        >
          {status === "loading" ? "Running…" : "Refresh"}
        </button>
        <button
          type="button"
          onClick={onLoadFull}
          disabled={status === "loading" || upgrading || (ready && !isLightweight)}
          className="px-4 py-3 text-xs font-black text-[#15052B] transition hover:bg-[#FAF7FF] disabled:cursor-not-allowed disabled:opacity-45"
        >
          {upgrading ? "Loading full state…" : ready && !isLightweight ? "Full state loaded" : "Load full state"}
        </button>
      </div>

      {status === "error" ? <div className="border-t border-[#EEE7F3] p-4"><ErrorState message={error || "Command Centre failed/timed out."} /></div> : null}
      {upgradeError ? <div className="border-t border-[#EEE7F3] p-4"><ErrorState message={`Full analysis could not load: ${upgradeError}`} /></div> : null}
    </section>
  );
}

function DecisionBrief({
  commandCentre,
  captain,
  vice,
  status,
}: {
  commandCentre: CommandCentre | null;
  captain: Player;
  vice: Player;
  status: CommandCentreStatus;
}) {
  // A lightweight response's best_move is a real object (route_id "lightweight_roll_reference",
  // see gameweek_command_centre.py) but it's a deliberate placeholder, not an analyzed
  // recommendation - the real multi-gw planner search is explicitly skipped to keep the
  // lightweight response fast. Rendering it identically to a finished decision (found live: "This
  // GW Decision: Roll transfer" with full Gain/Confidence/Action styling) reads as a real answer
  // that then gets silently swapped out from under the user once the full analysis lands seconds
  // later - confusing/looks broken, even though neither value was ever fake. Treat it the same as
  // "still calculating" until the real (non-lightweight) result arrives.
  const isLightweightMove = Boolean(commandCentre?.lightweight);
  const move = isLightweightMove ? undefined : commandCentre?.best_move;

  return (
    <section className="relative overflow-hidden rounded-[24px] border border-[#CDBAF7] bg-[linear-gradient(145deg,#FFFFFF_0%,#F2E9FF_100%)] shadow-[0_22px_55px_rgba(71,23,107,0.11)]">
      <div className="pointer-events-none absolute -right-12 -top-16 text-[180px] font-black leading-none text-[#6C1DFF]/[0.045]">01</div>
      <div className="relative p-5">
        <div className="flex items-center justify-between gap-3">
          <span className="rounded-full bg-[#6C1DFF] px-3 py-1 text-[8px] font-black uppercase tracking-[0.13em] text-white">
            This GW decision
          </span>
          {move ? (
            <span className={`rounded-full border px-3 py-1 text-[9px] font-black ${riskTone(move.risk_level)}`}>
              {move.risk_level} risk
            </span>
          ) : isLightweightMove ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#E3DAEC] bg-white/80 px-3 py-1 text-[9px] font-black text-[#786B82]">
              <LoadingSpinner className="h-3 w-3 text-[#6C1DFF]" />
              Calculating
            </span>
          ) : null}
        </div>

        <h3 className="mt-5 flex items-center gap-2.5 text-2xl font-black leading-[1.05] tracking-[-0.035em] text-[#15052B]">
          {!move && status !== "error" ? <LoadingSpinner className="h-6 w-6 shrink-0" /> : null}
          {move?.move || (status === "error" ? "Recommendation unavailable" : "Decision calculating")}
        </h3>

        {move ? (
          <>
            <p className="mt-3 text-sm font-semibold leading-6 text-[#695D73]">
              {move.why[0] || "The current move is being evaluated against the rest of the squad route."}
            </p>

            <div className="mt-5 grid grid-cols-3 gap-2">
              <div className="rounded-[14px] border border-[#DDEFE7] bg-[#F3FFF8] p-3">
                <p className="text-[8px] font-black uppercase tracking-[0.1em] text-[#008D57]">Gain</p>
                <p className="mt-1 text-lg font-black text-[#008D57]">{move.expected_gain > 0 ? "+" : ""}{move.expected_gain}</p>
              </div>
              <div className="rounded-[14px] border border-[#E4DAEF] bg-white/72 p-3">
                <p className="text-[8px] font-black uppercase tracking-[0.1em] text-[#83768D]">Confidence</p>
                <p className="mt-1 truncate text-sm font-black text-[#15052B]">{move.confidence_band}</p>
              </div>
              <div className="rounded-[14px] border border-[#F0DDAF] bg-[#FFF9E9] p-3">
                <p className="text-[8px] font-black uppercase tracking-[0.1em] text-[#A46800]">Action</p>
                <p className="mt-1 truncate text-sm font-black text-[#8C5700]">{move.recommended_action}</p>
              </div>
            </div>
          </>
        ) : (
          <p className="mt-3 text-sm font-semibold leading-6 text-[#695D73]">
            {isLightweightMove
              ? "The full planner is computing the real recommendation in the background - this updates automatically."
              : "The current XI remains available while the decision engine resolves the recommendation."}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 border-t border-[#DED1EC] bg-white/65">
        {[
          { label: "Current captain", player: captain, tone: "text-[#A46600]", badge: "C" },
          { label: "Current vice", player: vice, tone: "text-[#245EC7]", badge: "V" },
        ].map(({ label, player, tone, badge }, index) => (
          <div key={label} className={`flex min-w-0 items-center gap-3 p-4 ${index ? "border-l border-[#DED1EC]" : ""}`}>
            <div className="relative shrink-0">
              <PlayerVisual player={player} size="sm" />
              <span className={`absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full border-2 border-white text-[7px] font-black text-white ${badge === "C" ? "bg-[#FFB800]" : "bg-[#3C80FF]"}`}>
                {badge}
              </span>
            </div>
            <div className="min-w-0">
              <p className={`text-[8px] font-black uppercase tracking-[0.11em] ${tone}`}>{label}</p>
              <p className="mt-1 truncate text-xs font-black text-[#15052B]">{player.name}</p>
              <p className="mt-0.5 text-[9px] font-bold text-[#81758A]">{formatProjected(projected(player))}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function RiskSummary({ risks }: { risks: string[] }) {
  return (
    <section className="rounded-[22px] border border-[#E4DBED] bg-white p-5 shadow-[0_18px_45px_rgba(44,14,64,0.055)]">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-[13px] bg-[#FFF4DA] text-[#A46600]">
            <DashboardGlyph name="warning" className="h-4 w-4" />
          </span>
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#A46600]">Deadline watch</p>
            <h3 className="mt-1 text-lg font-black text-[#15052B]">Pressure before lock</h3>
          </div>
        </div>
        <Link href="/squad/health" className="text-[10px] font-black text-[#6C1DFF]">Open health →</Link>
      </div>

      <div className="mt-4 space-y-2">
        {risks.length ? (
          risks.slice(0, 3).map((risk, index) => (
            <div key={`${risk}-${index}`} className="flex items-start gap-3 rounded-[13px] border border-[#F0DDAF] bg-[#FFF9E9] p-3">
              <span className="mt-1 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#FFE9B7] text-[8px] font-black text-[#A46600]">
                {index + 1}
              </span>
              <p className="text-xs font-semibold leading-5 text-[#725521]">{risk}</p>
            </div>
          ))
        ) : (
          <div className="flex items-center gap-3 rounded-[13px] border border-[#C5EBD7] bg-[#F3FFF8] p-4">
            <span className="grid h-7 w-7 place-items-center rounded-full bg-[#DFFFF0] text-[#008D57]">
              <DashboardGlyph name="check" className="h-3.5 w-3.5" />
            </span>
            <p className="text-xs font-black text-[#008D57]">No material deadline risks detected.</p>
          </div>
        )}
      </div>
    </section>
  );
}

function BenchRail({ players, loading }: { players: Player[]; loading?: boolean }) {
  return (
    <section className="mt-4 overflow-hidden rounded-[22px] border border-[#E4DDEC] bg-white shadow-[0_18px_45px_rgba(44,14,64,0.055)]">
      <div className="flex items-center justify-between gap-4 border-b border-[#EEE8F3] px-4 py-4 sm:px-5">
        <div>
          <p className="text-[9px] font-black uppercase tracking-[0.15em] text-[#6C1DFF]">Squad layer 02</p>
          <h3 className="mt-1 text-lg font-black text-[#15052B]">Bench state</h3>
        </div>
        <span className="rounded-full bg-[#F0E8FF] px-3 py-1 text-[9px] font-black text-[#6C1DFF]">{players.length} substitutes</span>
      </div>

      <div className="flex snap-x gap-3 overflow-x-auto p-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:grid md:grid-cols-4 md:overflow-visible">
        {players.map((player, index) => (
          <article key={player.id} className="w-[210px] shrink-0 snap-start rounded-[17px] border border-[#E9E3EF] bg-[#FBFAFD] p-3 md:w-auto">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-[9px] bg-[#17052D] text-[9px] font-black text-white">{index + 1}</span>
              <PlayerVisual player={player} size="sm" />
              <div className="min-w-0">
                <p className="truncate text-xs font-black text-[#15052B]">{player.name}</p>
                <p className="mt-0.5 text-[9px] font-bold text-[#81758A]">{player.position} · {player.team}</p>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="rounded-[10px] bg-white p-2">
                <p className="text-[7px] font-black uppercase text-[#8A7E93]">Projection</p>
                <p className="mt-1 text-[10px] font-black text-[#008D57]">{formatProjected(projected(player), loading)}</p>
              </div>
              <div className="rounded-[10px] bg-white p-2">
                <p className="text-[7px] font-black uppercase text-[#8A7E93]">Price</p>
                <p className="mt-1 text-[10px] font-black text-[#15052B]">{formatPrice(player.price)}</p>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function SquadSnapshot({ players, loading }: { players: Player[]; loading?: boolean }) {
  return (
    <section className="mt-8">
      <DashboardSectionHeading
        eyebrow="Squad registry"
        title="All 15 players"
        body="The complete imported squad remains available beneath the operating view."
        action={
          <Link href="/squad" className="rounded-[12px] border border-[#D6C8E8] bg-white px-4 py-2.5 text-xs font-black text-[#6C1DFF] shadow-sm">
            Open My Team
          </Link>
        }
      />

      <div className="mt-4 flex snap-x gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {players.map((player) => (
          <article key={`${player.id}-${player.role}`} className="w-[220px] shrink-0 snap-start rounded-[18px] border border-[#E4DDEC] bg-white p-4 shadow-[0_14px_34px_rgba(44,14,64,0.05)]">
            <div className="flex min-w-0 items-center gap-3">
              <PlayerVisual player={player} size="sm" />
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-[#15052B]">{player.name}</p>
                <p className="mt-0.5 text-[10px] font-bold text-[#81758A]">{player.team} · {player.position}</p>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="rounded-[10px] bg-[#F7F3FB] p-2">
                <p className="text-[7px] font-black uppercase text-[#8A7E93]">Next GW</p>
                <p className="mt-1 text-[10px] font-black text-[#008D57]">{formatProjected(projected(player), loading)}</p>
              </div>
              <div className="rounded-[10px] bg-[#F7F3FB] p-2">
                <p className="text-[7px] font-black uppercase text-[#8A7E93]">Owned</p>
                <p className="mt-1 text-[10px] font-black text-[#15052B]">{loading ? "…" : `${player.ownership ?? 0}%`}</p>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function RoutePreviewCard({
  route,
  highlighted,
  index,
}: {
  route: CommandCentre["transfer_preview"][number];
  highlighted?: boolean;
  index: number;
}) {
  return (
    <article className={`relative w-[286px] shrink-0 snap-start overflow-hidden rounded-[22px] border p-5 transition md:w-auto ${highlighted ? "border-[#BCA4F5] bg-[linear-gradient(145deg,#FFFFFF,#F2E9FF)] shadow-[0_20px_46px_rgba(108,29,255,0.11)]" : "border-[#E3DCEB] bg-white shadow-[0_14px_32px_rgba(44,14,64,0.05)]"}`}>
      <span className={`absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full text-[10px] font-black ${highlighted ? "bg-[#6C1DFF] text-white" : "bg-[#F0E8FF] text-[#6C1DFF]"}`}>
        {index + 1}
      </span>
      <p className="pr-10 text-[9px] font-black uppercase tracking-[0.14em] text-[#6C1DFF]">{route.title}</p>
      <h3 className="mt-3 pr-8 text-xl font-black leading-tight text-[#15052B]">{route.move}</h3>
      <div className="mt-5 flex items-end justify-between gap-3">
        <div>
          <p className="text-[8px] font-black uppercase tracking-[0.1em] text-[#8A7E93]">Expected gain</p>
          <p className="mt-1 text-3xl font-black text-[#008D57]">{route.expected_gain > 0 ? "+" : ""}{route.expected_gain}</p>
        </div>
        <div className="text-right">
          <span className={`rounded-full border px-2.5 py-1 text-[8px] font-black ${riskTone(route.risk)}`}>{route.risk}</span>
          <p className="mt-2 text-[9px] font-black text-[#6C1DFF]">{route.confidence}</p>
        </div>
      </div>
      {route.why[0] ? <p className="mt-4 line-clamp-3 text-xs font-semibold leading-5 text-[#695D73]">{route.why[0]}</p> : null}
    </article>
  );
}

function AnalysisPlayerCard({
  label,
  player,
  value,
  tone,
}: {
  label: string;
  player: Player;
  value: string;
  tone: "green" | "purple";
}) {
  return (
    <article className="relative overflow-hidden rounded-[22px] border border-[#E2DAEA] bg-white p-5 shadow-[0_18px_42px_rgba(44,14,64,0.055)]">
      <div className={`absolute inset-x-0 top-0 h-1 ${tone === "green" ? "bg-[#00A86B]" : "bg-[#6C1DFF]"}`} />
      <p className={`text-[9px] font-black uppercase tracking-[0.15em] ${tone === "green" ? "text-[#008D57]" : "text-[#6C1DFF]"}`}>{label}</p>
      <div className="mt-4 flex min-w-0 items-center gap-3">
        <PlayerVisual player={player} size="md" />
        <div className="min-w-0">
          <p className="truncate text-lg font-black text-[#15052B]">{player.name}</p>
          <p className="mt-0.5 text-[10px] font-bold text-[#81758A]">{player.team} · {player.position}</p>
        </div>
      </div>
      <p className={`mt-5 text-3xl font-black ${tone === "green" ? "text-[#008D57]" : "text-[#6C1DFF]"}`}>{value}</p>
      <p className="mt-1 text-[9px] font-semibold text-[#81758A]">Model recommendation · separate from current C/V</p>
    </article>
  );
}

function MobileDisclosure({
  title,
  summary,
  children,
}: {
  title: string;
  summary: string;
  children: ReactNode;
}) {
  return (
    <details className="rounded-[22px] border border-[#E2DAEA] bg-white shadow-[0_18px_42px_rgba(44,14,64,0.055)] md:hidden">
      <summary className="cursor-pointer list-none p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-lg font-black text-[#15052B]">{title}</p>
            <p className="mt-1 text-xs font-semibold text-[#81758A]">{summary}</p>
          </div>
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#F0E8FF] text-lg font-black text-[#6C1DFF]">+</span>
        </div>
      </summary>
      <div className="border-t border-[#E9E2F0] p-4">{children}</div>
    </details>
  );
}

function ImportedSquadLoaded({
  state,
  imported,
  commandCentre,
  commandStatus,
  commandElapsedSeconds,
  commandError,
  commandUpgrading,
  commandUpgradeError,
  onRetryCommandCentre,
  onLoadFullCommandCentre,
}: {
  state: UserGameState;
  imported: StoredImportedTeam;
  commandCentre: CommandCentre | null;
  commandStatus: CommandCentreStatus;
  commandElapsedSeconds: number;
  commandError: string;
  commandUpgrading: boolean;
  commandUpgradeError: string;
  onRetryCommandCentre: () => void;
  onLoadFullCommandCentre: () => void;
}) {
  const rawPlayers = playersFromImport(imported);
  const projectionsState = usePolledAnalysis(
    () => getSquadPlayerProjections(commandCentrePayloadFromImport(imported)),
    [imported.entry_id, imported.event],
    "dashboard-projections",
  );
  const players = withRealProjections(rawPlayers, projectionsState.phase === "ready" ? projectionsState.data : []);
  const projectionsLoading = projectionsState.phase !== "ready";
  const isLightweight = Boolean(commandCentre?.lightweight);
  const starters = players.slice(0, 11);
  const bench = players.slice(11, 15);

  const currentCaptain =
    players.find((player) => player.role === "captain") ??
    starters[0] ??
    players[0];
  const currentVice =
    players.find((player) => player.role === "vice captain") ??
    starters.find((player) => player.id !== currentCaptain?.id) ??
    players[1] ??
    currentCaptain;

  const recommendedCaptain =
    !isLightweight && commandCentre?.captain_pick?.id
      ? commandCentre.captain_pick
      : currentCaptain;
  const recommendedVice =
    !isLightweight && commandCentre?.vice_captain?.id
      ? commandCentre.vice_captain
      : currentVice;

  const topRisks = commandCentre?.risk_alerts ?? [];

  return (
    <>
      <DeadlineStrip state={state} />
      {imported.entry_id === DEMO_ENTRY_ID ? (
        <div className="rounded-2xl border-2 border-dashed border-[#6C1DFF] bg-[#F5EFFF] px-5 py-3 text-sm font-bold text-[#3C2752]">
          <span className="mr-2 rounded-md bg-[#6C1DFF] px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-white">Demo</span>
          Sample squad on real 2026/27 fixtures and projections. Import your own team once the
          Gameweek 1 deadline passes — FPL keeps everyone&apos;s picks private until then.
        </div>
      ) : null}
      <BackgroundAnalysisStrip entryId={imported.entry_id} gameweek={imported.event} />

      <DashboardHero
        state={state}
        players={players}
        commandCentre={commandCentre}
        commandStatus={commandStatus}
        projectionsLoading={projectionsLoading}
      />

      <section className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="min-w-0">
          <section className="overflow-hidden rounded-[26px] border border-[#DCD2E8] bg-white shadow-[0_24px_60px_rgba(44,14,64,0.075)]">
            <div className="flex flex-col gap-3 border-b border-[#EEE8F3] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-[13px] bg-[#F0E8FF] text-[#6C1DFF]">
                  <DashboardGlyph name="squad" className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-[9px] font-black uppercase tracking-[0.15em] text-[#6C1DFF]">Squad layer 01 · current state</p>
                  <h2 className="mt-1 text-xl font-black text-[#15052B]">{state.formation} starting XI</h2>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full border border-[#F0DDAF] bg-[#FFF9E9] px-3 py-1 text-[9px] font-black text-[#A46600]">C · {currentCaptain?.name ?? "TBC"}</span>
                <span className="rounded-full border border-[#D7E4FF] bg-[#F1F6FF] px-3 py-1 text-[9px] font-black text-[#245EC7]">V · {currentVice?.name ?? "TBC"}</span>
              </div>
            </div>

            <div className="p-3 sm:p-4">
              <SquadPitch
                players={starters}
                captainId={currentCaptain?.id}
                viceCaptainId={currentVice?.id}
                loading={projectionsLoading}
              />
            </div>
          </section>

          <BenchRail players={bench} loading={projectionsLoading} />
        </div>

        <aside className="space-y-4 xl:sticky xl:top-5">
          <DecisionBrief
            commandCentre={commandCentre}
            captain={currentCaptain}
            vice={currentVice}
            status={commandStatus}
          />
          <RiskSummary risks={topRisks} />
          <CommandCentrePanel
            status={commandStatus}
            elapsedSeconds={commandElapsedSeconds}
            error={commandError}
            upgrading={commandUpgrading}
            upgradeError={commandUpgradeError}
            isLightweight={isLightweight}
            onRetry={onRetryCommandCentre}
            onLoadFull={onLoadFullCommandCentre}
          />
        </aside>
      </section>

      {commandCentre && isLightweight ? (
        <section className="mt-8 overflow-hidden rounded-[24px] border border-[#CDBAF7] bg-[linear-gradient(145deg,#FFFFFF,#F1E8FF)] shadow-[0_20px_50px_rgba(108,29,255,0.09)]">
          <div className="grid lg:grid-cols-[1fr_auto] lg:items-center">
            <div className="p-5 sm:p-6">
              <p className="text-[9px] font-black uppercase tracking-[0.15em] text-[#6C1DFF]">Quick operating state online</p>
              <h2 className="mt-2 text-2xl font-black text-[#15052B]">{commandCentre.best_move.move || "No strong move yet"}</h2>
              <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-[#695D73]">
                The squad and immediate decision are usable now. Route, planner and market layers continue loading separately.
              </p>
            </div>
            <button
              type="button"
              onClick={onLoadFullCommandCentre}
              disabled={commandUpgrading}
              className="m-5 rounded-[14px] bg-[#6C1DFF] px-5 py-3 text-sm font-black text-white shadow-[0_14px_30px_rgba(108,29,255,0.22)] disabled:cursor-wait disabled:opacity-55 lg:m-6"
            >
              {commandUpgrading ? "Loading full state…" : "Load complete dashboard state"}
            </button>
          </div>
        </section>
      ) : null}

      {commandCentre && !isLightweight ? (
        <>
          <section className="mt-9">
            <DashboardSectionHeading
              eyebrow="System modules online"
              title="Health and captaincy layer"
              body="Recommendation cards remain separate from the current captain and vice shown on the imported XI."
            />
            <div className="mt-4 grid items-stretch gap-4 md:grid-cols-3">
              <SquadHealthCard health={commandCentre.squad_health} compact />
              <AnalysisPlayerCard
                label="Recommended captain"
                player={recommendedCaptain}
                value={formatProjected(projected(recommendedCaptain))}
                tone="green"
              />
              <AnalysisPlayerCard
                label="Recommended vice"
                player={recommendedVice}
                value={formatProjected(projected(recommendedVice))}
                tone="purple"
              />
            </div>
          </section>

          {commandCentre.transfer_preview.length ? (
            <section className="mt-10">
              <DashboardSectionHeading
                eyebrow="Decision lanes"
                title="Compare viable transfer paths"
                body="Three routes from the same current squad state, ranked by expected gain, risk and confidence."
                action={
                  <Link href="/transfers" className="rounded-[12px] border border-[#D6C8E8] bg-white px-4 py-2.5 text-xs font-black text-[#6C1DFF] shadow-sm">
                    Open Decision Centre
                  </Link>
                }
              />
              <div className="mt-4 flex snap-x gap-4 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:grid md:grid-cols-3 md:overflow-visible">
                {commandCentre.transfer_preview.map((route, index) => (
                  <RoutePreviewCard key={route.id} route={route} highlighted={index === 0} index={index} />
                ))}
              </div>
            </section>
          ) : null}

          {commandCentre.planner.length ? (
            <section className="mt-10">
              <DashboardSectionHeading
                eyebrow="Route engine"
                title="The decision connected to future GWs"
                body="Follow the current move through the planner without leaving the Dashboard operating state."
                action={
                  <Link href="/planner" className="hidden rounded-[12px] border border-[#D6C8E8] bg-white px-4 py-2.5 text-xs font-black text-[#6C1DFF] shadow-sm md:inline-flex">
                    Open full planner
                  </Link>
                }
              />

              <div className="mt-4 md:hidden">
                <MobileDisclosure
                  title="Planner route"
                  summary={`${commandCentre.planner.length} gameweeks from the recommended route`}
                >
                  <PlannerTimeline steps={commandCentre.planner} />
                </MobileDisclosure>
              </div>

              <div className="mt-4 hidden overflow-hidden rounded-[24px] border border-[#DDD3E8] bg-white p-5 shadow-[0_20px_48px_rgba(44,14,64,0.06)] md:block">
                <PlannerTimeline steps={commandCentre.planner} />
              </div>
            </section>
          ) : null}

          {commandCentre.market_alerts.length ? (
            <section className="mt-10">
              <DashboardSectionHeading
                eyebrow="Market signal layer"
                title="Players moving around your decision"
                body="Market alerts remain connected to the same gameweek and imported squad context."
                action={
                  <Link href="/market" className="rounded-[12px] border border-[#D6C8E8] bg-white px-4 py-2.5 text-xs font-black text-[#6C1DFF] shadow-sm">
                    Open market
                  </Link>
                }
              />
              <div className="mt-4 flex snap-x gap-4 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:grid md:grid-cols-2 md:overflow-visible xl:grid-cols-5">
                {commandCentre.market_alerts.map((signal) => (
                  <div key={`${signal.player.id}-${signal.signal}`} className="w-[280px] shrink-0 snap-start md:w-auto">
                    <MarketSignalCard signal={signal} />
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <div className="mt-6">
            <TrustWarning
              show={Boolean(commandCentre.best_move.fallback_used)}
              reason={commandCentre.best_move.fallback_reason ?? "Command centre reported fallback mode."}
            />
          </div>
        </>
      ) : null}

      <SquadSnapshot players={players} loading={projectionsLoading} />
    </>
  );
}


export function ImportedDashboardFlow() {
  const searchParams = useSearchParams();
  const queryEntryId = searchParams.get("entry_id")?.trim() ?? "";
  const queryEvent = eventParam(searchParams.get("event") ?? searchParams.get("gameweek"));

  // Resolved once per mount (lazy initializer, not recomputed every render) and reused below to
  // seed every piece of visible state - so a return visit to this page (e.g. navigating away and
  // back) shows what was already loaded immediately instead of blanking to a spinner. The effect
  // further down still re-imports and re-checks the command centre regardless of this cache hit -
  // this only changes whether the user watches that happen on a blank screen.
  const [initialCache] = useState<DashboardDisplayCacheEntry | null>(() => {
    if (typeof window === "undefined") return null;
    const { entryId } = resolveAuthoritativeIdentity(queryEntryId, queryEvent);
    return readDashboardDisplayCache(entryId);
  });

  const [status, setStatus] = useState<DashboardStatus>(initialCache ? "ready" : "loading");
  const [commandStatus, setCommandStatus] = useState<CommandCentreStatus>(initialCache?.commandCentre ? "ready" : "idle");
  const [commandStartedAt, setCommandStartedAt] = useState<number | null>(null);
  const [commandElapsedSeconds, setCommandElapsedSeconds] = useState(0);
  const [commandError, setCommandError] = useState("");
  const [commandUpgrading, setCommandUpgrading] = useState(false);
  const [commandUpgradeError, setCommandUpgradeError] = useState("");
  const [debug, setDebug] = useState<DashboardDebug>(initialDebug);
  const [imported, setImported] = useState<StoredImportedTeam | null>(initialCache?.imported ?? null);
  const [commandCentre, setCommandCentre] = useState<CommandCentre | null>(initialCache?.commandCentre ?? null);
  const [dataSource, setDataSource] = useState<DataSourceStatus | undefined>(initialCache?.dataSource);

  // background=true is the instant-paint upgrade path: the lightweight panel stays on
  // screen while the full request runs, and the result merges in without a blank reload.
  // Returns whether the request succeeded, so callers can chain the lightweight -> full upgrade.
  const commandCentreCancelledRef = useRef(false);
  useEffect(() => {
    commandCentreCancelledRef.current = false;
    return () => {
      commandCentreCancelledRef.current = true;
    };
  }, []);

  const requestCommandCentre = useCallback(async (team: StoredImportedTeam, mode: "lightweight" | "full" = "lightweight", opts: { background?: boolean; isRetry?: boolean } = {}): Promise<boolean> => {
    const background = Boolean(opts.background);

    const isRetry = Boolean(opts.isRetry);
    if (background) {
      setCommandUpgrading(true);
      if (!isRetry) setCommandUpgradeError("");
    } else {
      if (!isRetry) {
        setCommandCentre(null);
        setCommandElapsedSeconds(0);
        setCommandStartedAt(Date.now());
      }
      setCommandStatus("loading");
      setCommandError("");
      setDebug((current) => ({
        ...current,
        command_centre_request_started: true,
        command_centre_request_finished: false,
        command_centre_error: "",
        using_mock_data: false,
      }));
    }

    try {
      const basePayload = commandCentrePayloadFromImport(team);
      const commandPayload = mode === "lightweight"
        ? { ...basePayload, lightweight: true, mode: "lightweight", include_heavy: false }
        : { ...basePayload, lightweight: false, mode: "full", include_heavy: true };
      const commandCentreResult = await getGameweekCommandCentre(commandPayload, {
        timeoutMs: mode === "lightweight" ? LIGHTWEIGHT_COMMAND_TIMEOUT_MS : FULL_COMMAND_TIMEOUT_MS,
        disableFallback: true,
        throwOnPending: true,
        apiName: mode === "lightweight" ? "getImportedLightweightGameweekCommandCentre" : "getImportedFullGameweekCommandCentre",
      });
      setCommandCentre(commandCentreResult.data);
      setDataSource(commandCentreResult.source);
      if (background) {
        setCommandUpgrading(false);
      } else {
        setCommandStatus("ready");
        setDebug((current) => ({
          ...current,
          command_centre_request_finished: true,
          using_mock_data: commandCentreResult.source.mode === "mock",
        }));
      }
      return true;
    } catch (error) {
      // The real analysis is genuinely still computing (backend cache_status pending/running,
      // not a failure) - see api.ts's requestJson, which now throws analysisPending instead of
      // silently returning mock data for disableFallback callers. Keep the UI in a "still
      // computing" state and poll again shortly, exactly like BackgroundAnalysisStrip already
      // does for the per-tab precompute status - never fall through to the error/mock path for
      // this, since it isn't an error.
      if (error instanceof ApiRequestError && error.analysisPending) {
        if (commandCentreCancelledRef.current) return false;
        window.setTimeout(() => {
          if (commandCentreCancelledRef.current) return;
          void requestCommandCentre(team, mode, { background, isRetry: true });
        }, 3000);
        return false;
      }
      const message = commandCentreErrorMessage(error);
      if (background) {
        setCommandUpgrading(false);
        setCommandUpgradeError(message);
      } else {
        setCommandError(message);
        setCommandStatus("error");
        setDebug((current) => ({
          ...current,
          command_centre_request_finished: true,
          command_centre_error: message,
          using_mock_data: false,
        }));
      }
      return false;
    }
  }, []);

  // Instant paint with lightweight data, then fetch full panels in the background and merge them in.
  // Returns once the full dashboard fetch itself resolves (not just once it's kicked off),
  // so callers can sequence work that would otherwise contend with it for the same
  // GIL-bound synchronous backend work - see prefetchOtherTabs's caller below.
  const loadCommandCentreProgressive = useCallback(async (team: StoredImportedTeam): Promise<boolean> => {
    const lightweightOk = await requestCommandCentre(team, "lightweight");
    if (lightweightOk) {
      return requestCommandCentre(team, "full", { background: true });
    }
    return false;
  }, [requestCommandCentre]);

  useEffect(() => {
    if (commandStatus !== "loading" || !commandStartedAt) return;
    const timer = window.setInterval(() => {
      setCommandElapsedSeconds(Math.floor((Date.now() - commandStartedAt) / 1000));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [commandStartedAt, commandStatus]);

  useEffect(() => {
    let cancelled = false;

    function updateDebug(patch: Partial<DashboardDebug>) {
      if (!cancelled) setDebug((current) => ({ ...current, ...patch }));
    }

    // Captured once at mount (initialCache itself never changes after that - see its own
    // useState) - a return visit that already has something on screen must keep showing it
    // while this re-import/re-check runs in the background, instead of blanking to a spinner
    // first. This never skips the re-check itself (see resolveAuthoritativeIdentity's comment on
    // why a stale local roster must never be trusted as current on its own).
    const hadCache = Boolean(initialCache);

    async function load() {
      if (!hadCache) {
        setStatus("loading");
        setImported(null);
        setCommandCentre(null);
        setCommandStatus("idle");
        setDataSource(undefined);
      }
      setCommandError("");
      setCommandElapsedSeconds(0);
      setCommandStartedAt(null);
      setDebug({
        ...initialDebug,
        imported_entry_id: "",
        imported_event: "",
        strict_backend: STRICT_BACKEND,
      });

      let nextImport: StoredImportedTeam | null = null;
      const { entryId: authoritativeEntryId, event: authoritativeEvent } = resolveAuthoritativeIdentity(queryEntryId, queryEvent);

      updateDebug({
        imported_entry_id: authoritativeEntryId,
        imported_event: authoritativeEvent ? String(authoritativeEvent) : "",
      });

      if (!authoritativeEntryId) {
        updateDebug({ import_error: "No imported team found. Import your FPL team first." });
        if (!cancelled && !hadCache) setStatus("missing");
        return;
      }

      // Always refresh the current 15-player squad from the backend. The saved browser object is
      // only an identity fallback above; it is never trusted as the displayed roster.
      try {
        updateDebug({
          import_request_started: true,
          import_request_finished: false,
          import_error: "",
        });

        const importedResult = await getImportTeamData(
          authoritativeEntryId,
          authoritativeEvent,
        );

        nextImport = importedTeamFromDashboardFetch(
          importedResult.data,
          authoritativeEvent,
        );

        saveImportedTeam(nextImport);
        updateDebug({ import_request_finished: true });
      } catch (error) {
        updateDebug({
          import_request_finished: true,
          import_error: errorMessage(error),
        });
        // A transient refresh failure must not blank out an already-showing cached dashboard -
        // only surface the error state for a genuine cold load with nothing on screen yet.
        if (!cancelled && !hadCache) setStatus("error");
        return;
      }

      if (!nextImport || nextImport.squad.length === 0) {
        updateDebug({ import_error: "No imported team found. Import your FPL team first." });
        if (!cancelled && !hadCache) setStatus("missing");
        return;
      }

      const squadCount = nextImport.squad.length;
      updateDebug({
        imported_entry_id: nextImport.entry_id,
        imported_event: String(nextImport.event),
        imported_squad_count: squadCount,
        displayed_squad_count: squadCount,
        using_imported_squad: squadCount > 0,
        using_mock_data: false,
      });
      if (!cancelled) {
        setImported(nextImport);
        setStatus("ready");
        // The backend's /squad-health/import/{entry_id} endpoint (which importTeam() above
        // already called) schedules background precompute for every heavy tab itself, so
        // there's no client-side prefetch to kick off here anymore.
        void loadCommandCentreProgressive(nextImport);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [queryEntryId, queryEvent, loadCommandCentreProgressive, initialCache]);

  // Keeps the display cache current with whatever's actually on screen (initial cached paint,
  // fresh re-import, lightweight-then-full command centre upgrade) - see initialCache's own
  // comment for why a return visit reads this instead of starting blank.
  useEffect(() => {
    if (!imported) return;
    const { entryId } = resolveAuthoritativeIdentity(queryEntryId, queryEvent);
    if (!entryId) return;
    writeDashboardDisplayCache(entryId, { imported, commandCentre, dataSource });
  }, [imported, commandCentre, dataSource, queryEntryId, queryEvent]);

  const shellState = useMemo(() => (imported ? appStateFromImport(imported) : {
    manager_name: "Manager",
    team_name: "Import your team",
    team_id_label: "Not imported",
    gameweek: 1,
    gameweek_label: "GW–",
    deadline_label: "Import your FPL team to continue",
    formation: "3-4-3",
    bank: 0,
    free_transfers: 1,
    current_tier: "Free" as const,
  }), [imported]);

  return (
    <AppShell title="Your Gameweek Plan" eyebrow={imported ? `${shellState.team_name} - imported ${shellState.gameweek_label}` : "Imported team command centre"} state={shellState} dataSource={dataSource}>
      {status === "loading" ? <LoadingState label="Loading imported squad" /> : null}

      {status === "missing" ? (
        <div className="space-y-4">
          <EmptyState title="No imported team found. Import your FPL team first." body="The dashboard needs a stored FPL import or an entry_id/event URL to build the command-centre request." />
          <Link href="/import" className="inline-flex rounded-xl bg-[#6C1DFF] px-4 py-3 text-sm font-black text-white">
            Import team
          </Link>
        </div>
      ) : null}

      {status === "error" ? (
        <section className="rounded-2xl border border-[#E8DEF8] bg-white p-6 shadow-[0_18px_45px_rgba(55,0,60,0.08)]">
          <h2 className="text-2xl font-black text-[#17002F]">Could not import team</h2>
          <div className="mt-4">
            <ErrorState message={debug.import_error || "Import failed."} />
          </div>
          <Link href="/import" className="mt-5 inline-flex rounded-xl bg-[#6C1DFF] px-4 py-3 text-sm font-black text-white">
            Import again
          </Link>
        </section>
      ) : null}

      {status === "ready" && imported ? (
        <ImportedSquadLoaded
          state={shellState}
          imported={imported}
          commandCentre={commandCentre}
          commandStatus={commandStatus}
          commandElapsedSeconds={commandElapsedSeconds}
          commandError={commandError}
          commandUpgrading={commandUpgrading}
          commandUpgradeError={commandUpgradeError}
          onRetryCommandCentre={() => void loadCommandCentreProgressive(imported)}
          onLoadFullCommandCentre={() => void requestCommandCentre(imported, "full", { background: true })}
        />
      ) : null}
    </AppShell>
  );
}