"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { PlayerCard } from "@/components/cards";
import { PlayerVisual } from "@/components/player-visual";
import { RouteError } from "@/components/route-error";
import { SavedSquadHealthPanel } from "@/components/saved-squad-health-panel";
import { LoadingState } from "@/components/states";
import { SquadHealthEmbed } from "@/components/squad-health-embed";
import { getImportTeamData, getSquadHealthDiagnostics } from "@/lib/api";
import {
  appStateFromImport,
  commandCentrePayloadFromImport,
  FPL_ENTRY_COOKIE,
  FPL_EVENT_COOKIE,
  IMPORTED_TEAM_ENTRY_COOKIE,
  IMPORTED_TEAM_EVENT_COOKIE,
  importedTeamFromResponse,
  playersFromImport,
  readBrowserCookie,
  readImportedTeam,
  saveImportedTeam,
} from "@/lib/imported-team";
import { getPlayerImageUrl } from "@/lib/player-images";
import {
  healthSource,
  importedOnlyDiagnostics,
  importedSafeDiagnostics,
  mergeSources,
  unavailableSource,
  unwrap,
  withTabTimeout,
} from "@/lib/squad-roster-shared";
import type { DataSourceStatus, Player, SquadHealthDiagnostics, SquadIssue, UserGameState } from "@/lib/types";

function eventParam(value: string | null | undefined) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : undefined;
}

// Same identity resolution Dashboard uses (see imported-dashboard-flow.tsx's own
// resolveAuthoritativeIdentity) - cookies first (what the server-rendered pages trust), then the
// localStorage snapshot as an identity fallback only, never trusted as the current roster itself.
function resolveAuthoritativeIdentity() {
  const stored = readImportedTeam();
  const cookieEntryId = (readBrowserCookie(FPL_ENTRY_COOKIE) ?? readBrowserCookie(IMPORTED_TEAM_ENTRY_COOKIE) ?? "").trim();
  const cookieEvent = eventParam(readBrowserCookie(FPL_EVENT_COOKIE) ?? readBrowserCookie(IMPORTED_TEAM_EVENT_COOKIE));
  const entryId = cookieEntryId || stored?.entry_id || "";
  const event = cookieEvent ?? eventParam(stored?.event ? String(stored.event) : undefined);
  return { entryId, event };
}

type SquadRosterData = {
  appState: UserGameState;
  squadPlayers: Player[];
  diagnostics: SquadHealthDiagnostics;
  dataSource: DataSourceStatus;
  // True when squad_health hadn't finished computing yet at fetch time (see
  // loadSquadRosterDataClient) - squadPlayers/diagnostics are the safe imported-only fallback,
  // not real projections. Found live: this page previously fetched once and never checked
  // again, silently showing 0/— for every projection with no indication it was still
  // computing, until the user happened to reload after the background job finished.
  analysisPending?: boolean;
};

type SquadDisplayCacheEntry = SquadRosterData & { savedAt: number };

// Module-level (not component state) so it survives this page unmounting/remounting on route
// navigation within the same tab - same fix, same reasoning as imported-dashboard-flow.tsx's own
// dashboardDisplayCache: skip the blank-screen reload on a return visit without skipping the
// re-check itself (this still always re-fetches in the background regardless of a cache hit).
const SQUAD_DISPLAY_CACHE_TTL_MS = 3 * 60 * 60 * 1000;
const squadDisplayCache = new Map<string, SquadDisplayCacheEntry>();

// Keyed by entryId ONLY, not entryId+event. The "event" read from a stored cookie/localStorage
// value (see resolveAuthoritativeIdentity) can itself be stale relative to a fresh resolution -
// found live: if the resolved planning gameweek ever changes between visits (e.g. an off-season
// planning_event vs raw gameweek resolution difference), a stale entry under the OLD event value
// never gets overwritten or cleaned up, and can get served again as the initial cache hit,
// briefly flashing a genuinely different squad before the fresh fetch corrects it. One slot per
// entry, always overwritten by the most recent real fetch, makes that stale-orphan-slot
// impossible - there is nowhere else for old data to hide.
function squadCacheKey(entryId: string) {
  return entryId;
}

function readSquadDisplayCache(entryId: string): SquadDisplayCacheEntry | null {
  if (!entryId) return null;
  const key = squadCacheKey(entryId);
  const entry = squadDisplayCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.savedAt > SQUAD_DISPLAY_CACHE_TTL_MS) {
    squadDisplayCache.delete(key);
    return null;
  }
  return entry;
}

function writeSquadDisplayCache(entryId: string, snapshot: SquadRosterData) {
  if (!entryId) return;
  squadDisplayCache.set(squadCacheKey(entryId), { ...snapshot, savedAt: Date.now() });
}

// Client-side equivalent of use-command-centre.ts's loadSquadRosterData() - that function can't
// be called from here at all (it imports next/headers via loadImportedContext, which breaks the
// client bundle) - see squad-roster-shared.ts for the pure helpers this reuses verbatim rather
// than reimplementing the diagnostics-merging logic a second time.
async function loadSquadRosterDataClient(entryId: string, event: number | undefined): Promise<SquadRosterData> {
  const importedResult = await getImportTeamData(entryId, event);
  const imported = importedTeamFromResponse(importedResult.data);
  saveImportedTeam(imported);
  const appState = appStateFromImport(imported);
  const payload = commandCentrePayloadFromImport(imported);
  const players = playersFromImport(imported);

  const [diagnostics, health] = await Promise.all([
    withTabTimeout(getSquadHealthDiagnostics(payload), "/squad-health/analyse"),
    healthSource(),
  ]);
  const diagnosticsData = diagnostics ? importedOnlyDiagnostics(unwrap(diagnostics), players) : importedSafeDiagnostics(players);
  const analysedById = new Map(diagnostics ? unwrap(diagnostics).players.map((player) => [player.id, player] as const) : []);
  const analysisPending = diagnostics?.analysisStatus === "pending" || diagnostics?.analysisStatus === "running";
  const squadPlayers = players.map((player) => {
    const analysed = analysedById.get(player.id);
    if (analysed) return { ...player, projected: analysed.projected, ownership: analysed.ownership };
    // NaN, not the raw imported default of 0 - projected(player) below (and every renderer that
    // uses it) already treats a non-finite value as "no data yet" and shows "—"/"Calculating...".
    // Player.projected is a required `number` across the whole app, so this stays a number rather
    // than becoming null, which would ripple that type change through every other consumer.
    return analysisPending ? { ...player, projected: Number.NaN } : player;
  });

  return {
    appState,
    squadPlayers,
    diagnostics: diagnosticsData,
    dataSource: mergeSources(health, importedResult.source, diagnostics?.source ?? unavailableSource("/squad-health/analyse", "Squad health analysis timed out.")),
    analysisPending,
  };
}

// Bounded retry while squad_health is still computing in the background - same reasoning as
// Planner's own status-poll backoff (see planner-content.tsx's PLANNER_INITIAL_STATUS_DELAYS_MS):
// short delays first so real projections can still appear promptly, backing off once it's
// clearly going to take longer than a first-fetch race.
const SQUAD_PENDING_RETRY_DELAYS_MS = [4000, 8000, 15000, 30000, 30000, 30000] as const;

function projected(player?: Player | null) {
  const value = player?.projected;
  return value != null && Number.isFinite(value) ? value : null;
}

function formatProjected(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value.toFixed(1)} pts`;
}

function formatPrice(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "—";
  return `£${value.toFixed(1)}m`;
}

function uniqueIssues(diagnostics: SquadHealthDiagnostics) {
  const map = new Map<string, SquadIssue>();
  [
    ...diagnostics.urgent_issues,
    ...diagnostics.minutes_risk_list,
    ...diagnostics.injury_suspension_risk_list,
    ...diagnostics.weak_bench_alerts,
    ...diagnostics.fixture_problem_areas,
  ].forEach((issue) => map.set(issue.id, issue));
  return [...map.values()];
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

function DesktopPitchPlayer({ player, role }: { player: Player; role?: "C" | "V" }) {
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
          <span className="text-[9px] font-black text-[#9FF3CC]">{formatProjected(projected(player))}</span>
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

function DesktopPitchRow({ players, captainId, viceCaptainId }: { players: Player[]; captainId?: number; viceCaptainId?: number }) {
  if (!players.length) return <div />;
  return (
    <div className={`mx-auto flex w-full items-center justify-around gap-2 ${rowWidthClass(players.length)}`}>
      {players.map((player) => (
        <DesktopPitchPlayer key={player.id} player={player} role={roleFor(player, captainId, viceCaptainId)} />
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

function DesktopPitch({ players, captainId, viceCaptainId }: { players: Player[]; captainId?: number; viceCaptainId?: number }) {
  const rows = (["FWD", "MID", "DEF", "GK"] as const).map((position) => players.filter((player) => player.position === position));

  return (
    <div className="relative hidden min-h-[680px] overflow-hidden rounded-[22px] border border-[#0A7B46] bg-[#0B9B55] shadow-[0_26px_55px_rgba(4,90,49,0.22),inset_0_0_0_1px_rgba(255,255,255,0.12)] md:block">
      <div className="absolute inset-0 bg-[repeating-linear-gradient(90deg,rgba(255,255,255,0.055)_0,rgba(255,255,255,0.055)_12.5%,rgba(0,0,0,0.018)_12.5%,rgba(0,0,0,0.018)_25%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.035),rgba(0,0,0,0.08))]" />
      <PitchMarkings />
      <div className="relative z-10 grid min-h-[680px] grid-rows-[1fr_1.08fr_1.08fr_.9fr] content-between px-8 py-9 lg:px-12 lg:py-10">
        {rows.map((row, index) => (
          <div key={index} className="grid content-center">
            <DesktopPitchRow players={row} captainId={captainId} viceCaptainId={viceCaptainId} />
          </div>
        ))}
      </div>
      <div className="absolute bottom-4 left-4 z-20 flex items-center gap-2 rounded-full border border-white/14 bg-[#062318]/54 px-3 py-1.5 text-[10px] font-black text-white/72 backdrop-blur-md">
        <span className="h-2 w-2 rounded-full bg-[#A7F3D0]" /> Live projections
      </div>
    </div>
  );
}

function MobilePitchPlayer({ player, role }: { player: Player; role?: "C" | "V" }) {
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
        <p className="mt-0.5 truncate text-[8px] font-black text-[#9FF3CC]">{formatProjected(projected(player))}</p>
      </div>
    </div>
  );
}

function MobilePitchRow({ players, captainId, viceCaptainId }: { players: Player[]; captainId?: number; viceCaptainId?: number }) {
  if (!players.length) return <div />;
  return (
    <div className="grid w-full items-start gap-1" style={{ gridTemplateColumns: `repeat(${players.length}, minmax(0, 1fr))` }}>
      {players.map((player) => (
        <MobilePitchPlayer key={player.id} player={player} role={roleFor(player, captainId, viceCaptainId)} />
      ))}
    </div>
  );
}

function MobilePitch({ players, captainId, viceCaptainId }: { players: Player[]; captainId?: number; viceCaptainId?: number }) {
  const rows = (["FWD", "MID", "DEF", "GK"] as const).map((position) => players.filter((player) => player.position === position));

  return (
    <div className="relative min-h-[570px] overflow-hidden rounded-[20px] border border-[#087744] bg-[#0B9B55] shadow-[0_20px_45px_rgba(4,90,49,0.20)] md:hidden">
      <div className="absolute inset-0 bg-[repeating-linear-gradient(90deg,rgba(255,255,255,0.055)_0,rgba(255,255,255,0.055)_16.66%,rgba(0,0,0,0.018)_16.66%,rgba(0,0,0,0.018)_33.33%)]" />
      <div className="absolute inset-[9px] rounded-[17px] border border-white/45" />
      <div className="absolute left-[9px] right-[9px] top-1/2 h-px bg-white/40" />
      <div className="absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/40" />
      <div className="absolute left-1/2 top-[9px] h-16 w-[46%] -translate-x-1/2 border-x border-b border-white/40" />
      <div className="absolute bottom-[9px] left-1/2 h-16 w-[46%] -translate-x-1/2 border-x border-t border-white/40" />
      <div className="relative z-10 grid min-h-[570px] grid-rows-[1fr_1.08fr_1.08fr_.88fr] content-between px-2.5 py-7">
        {rows.map((row, index) => (
          <div key={index} className="grid content-center">
            <MobilePitchRow players={row} captainId={captainId} viceCaptainId={viceCaptainId} />
          </div>
        ))}
      </div>
    </div>
  );
}

function SquadPitch({ players, captainId, viceCaptainId }: { players: Player[]; captainId?: number; viceCaptainId?: number }) {
  return (
    <>
      <DesktopPitch players={players} captainId={captainId} viceCaptainId={viceCaptainId} />
      <MobilePitch players={players} captainId={captainId} viceCaptainId={viceCaptainId} />
    </>
  );
}

function HeroOverviewMetric({
  label,
  value,
  detail,
  tone = "default",
}: {
  label: string;
  value: string;
  detail?: string;
  tone?: "default" | "positive" | "warning";
}) {
  const valueClass = tone === "positive" ? "text-[#008D4F]" : tone === "warning" ? "text-[#B77900]" : "text-[#12002D]";

  return (
    <div className="min-w-0 border-r border-[#E7EAF1] px-2 py-2.5 last:border-r-0 sm:px-4 sm:py-3">
      <p className="truncate text-[7px] font-black uppercase tracking-[0.06em] text-[#858CA3] sm:text-[9px] sm:tracking-[0.11em]">{label}</p>
      <p className={`mt-1 truncate text-[12px] font-black tracking-[-0.025em] sm:text-lg ${valueClass}`}>{value}</p>
      {detail ? <p className="mt-0.5 hidden truncate text-[9px] font-semibold text-[#777F99] sm:block">{detail}</p> : null}
    </div>
  );
}

function heroPlayers(starters: Player[]) {
  if (!starters.length) return [];
  const captain = starters.find((player) => player.role === "captain") ?? [...starters].sort((a, b) => (projected(b) ?? 0) - (projected(a) ?? 0))[0];
  const supporting = [...starters]
    .filter((player) => player.id !== captain?.id)
    .sort((a, b) => (projected(b) ?? 0) - (projected(a) ?? 0))
    .slice(0, 2);
  return supporting.length === 2 ? [supporting[0], captain, supporting[1]].filter(Boolean) as Player[] : [captain, ...supporting].filter(Boolean) as Player[];
}

type HeroSlot = "left" | "center" | "right";

const squadHeroSlotClass: Record<HeroSlot, string> = {
  left: "absolute bottom-0 left-0 z-10 h-[154px] w-[112px] sm:h-[205px] sm:w-[150px] lg:h-[226px] lg:w-[166px]",
  center:
    "absolute bottom-0 left-1/2 z-30 h-[196px] w-[148px] -translate-x-1/2 sm:h-[254px] sm:w-[190px] lg:h-[282px] lg:w-[210px]",
  right: "absolute bottom-0 right-0 z-20 h-[154px] w-[112px] sm:h-[205px] sm:w-[150px] lg:h-[226px] lg:w-[166px]",
};

const squadHeroFallbackClass: Record<HeroSlot, string> = {
  left: "absolute bottom-3 left-1/2 -translate-x-1/2 scale-[0.82] sm:bottom-5 sm:scale-100 lg:scale-[1.08]",
  center: "absolute bottom-4 left-1/2 -translate-x-1/2 scale-[1.02] sm:bottom-6 sm:scale-[1.28] lg:bottom-7 lg:scale-[1.42]",
  right: "absolute bottom-3 left-1/2 -translate-x-1/2 scale-[0.82] sm:bottom-5 sm:scale-100 lg:scale-[1.08]",
};

function SquadHeroPlayer({ player, slot }: { player: Player; slot: HeroSlot }) {
  // Use the exact same player-photo source as the Planner hero. Do not render a kit
  // behind a valid photo: that was the cause of the random shirts showing through.
  const photo = getPlayerImageUrl(player);

  return (
    <div className={squadHeroSlotClass[slot]}>
      <span
        className={`absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-[#2A0757]/20 blur-md ${
          slot === "center" ? "h-8 w-24 sm:h-10 sm:w-32" : "h-6 w-16 sm:h-8 sm:w-24"
        }`}
      />

      {photo ? (
        <Image
          src={photo}
          alt=""
          fill
          priority={slot === "center"}
          sizes={
            slot === "center"
              ? "(max-width: 639px) 148px, (max-width: 1023px) 190px, 210px"
              : "(max-width: 639px) 112px, (max-width: 1023px) 150px, 166px"
          }
          className="object-contain object-bottom drop-shadow-[0_18px_22px_rgba(38,7,78,0.22)] sm:drop-shadow-[0_24px_28px_rgba(38,7,78,0.24)]"
        />
      ) : (
        <div
          className={`[&>span]:overflow-visible [&>span]:rounded-none [&>span]:bg-transparent [&>span]:p-0 [&_img]:object-contain [&_img]:drop-shadow-[0_16px_20px_rgba(38,7,78,0.22)] ${squadHeroFallbackClass[slot]}`}
        >
          <PlayerVisual player={player} size="xl" preferPhoto={false} />
        </div>
      )}
    </div>
  );
}

function SquadHeroArtwork({ players }: { players: Player[] }) {
  const selected = players.slice(0, 3);
  const slots: HeroSlot[] = selected.length === 1 ? ["center"] : selected.length === 2 ? ["left", "center"] : ["left", "center", "right"];

  return (
    <div
      className="pointer-events-none absolute -top-8 right-1 z-20 h-[196px] w-[214px] sm:-top-14 sm:right-4 sm:h-[254px] sm:w-[330px] lg:-top-16 lg:right-8 lg:h-[282px] lg:w-[382px]"
      aria-hidden
    >
      <div className="absolute bottom-4 left-1/2 h-24 w-36 -translate-x-1/2 rounded-full bg-[#6C1DFF]/10 blur-2xl sm:h-32 sm:w-56 lg:h-36 lg:w-64" />
      {selected.map((player, index) => (
        <SquadHeroPlayer key={player.id} player={player} slot={slots[index]} />
      ))}
    </div>
  );
}

function TeamOverviewHero({ state, diagnostics, starters }: { state: UserGameState; diagnostics: SquadHealthDiagnostics; starters: Player[] }) {
  const score = diagnostics.health.score;
  const projectedTotal = starters.reduce((sum, player) => sum + (projected(player) ?? 0), 0);
  const issues = uniqueIssues(diagnostics);
  const artworkPlayers = heroPlayers(starters);
  const healthTone = score != null && score < 40 ? "warning" : "positive";

  return (
    <section className="mb-6 mt-12 sm:mt-16">
      <div className="relative overflow-visible rounded-[22px] border border-[#CDBBFF] bg-[linear-gradient(135deg,#FFFFFF_0%,#FCFAFF_58%,#F3ECFF_100%)] shadow-[0_24px_70px_rgba(55,0,60,0.10)] sm:rounded-[28px]">
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]">
          <div className="absolute -right-20 -top-28 h-72 w-72 rounded-full bg-[#6C1DFF]/[0.08] blur-3xl" />
          <div className="absolute left-[43%] top-12 h-24 w-24 rotate-12 border-r-[18px] border-t-[18px] border-[#6C1DFF]/[0.045]" />
          <div className="absolute right-5 top-6 text-[58px] font-black leading-none text-[#37003C]/[0.07] sm:right-9 sm:text-[76px]">XI</div>
        </div>

        <SquadHeroArtwork players={artworkPlayers} />

        <div className="relative z-10 min-h-[212px] px-4 pb-[104px] pt-5 pr-[154px] sm:min-h-[250px] sm:px-7 sm:pb-[112px] sm:pt-7 sm:pr-[300px] lg:px-9 lg:pr-[370px]">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[#6C1DFF] px-3 py-1 text-[9px] font-black uppercase tracking-[0.13em] text-white shadow-[0_8px_18px_rgba(108,29,255,0.20)] sm:text-[10px]">
              {state.gameweek_label}
            </span>
            <span className={`rounded-full border px-3 py-1 text-[9px] font-black uppercase tracking-[0.11em] sm:text-[10px] ${riskTone(diagnostics.health.grade)}`}>
              {diagnostics.health.grade}
            </span>
          </div>

          <p className="mt-4 text-[9px] font-black uppercase tracking-[0.15em] text-[#63577A] sm:text-[11px] sm:tracking-[0.18em]">Team overview</p>
          <h2 className="mt-2 max-w-[13rem] break-words text-[1.55rem] font-black leading-[1.05] tracking-[-0.045em] text-[#12002D] sm:max-w-xl sm:text-4xl lg:text-[2.55rem]">
            {state.team_name}
          </h2>
          <p className="mt-2 max-w-[13rem] text-[11px] font-semibold leading-5 text-[#5F5878] sm:max-w-xl sm:text-sm sm:leading-6">
            {state.formation} formation · {issues.length} active {issues.length === 1 ? "flag" : "flags"}
          </p>
        </div>

        <div className="absolute inset-x-3 bottom-3 z-30 grid grid-cols-4 overflow-hidden rounded-xl border border-[#E0E5EF] bg-white/95 shadow-[0_12px_32px_rgba(15,23,60,0.08)] backdrop-blur sm:inset-x-6 sm:bottom-5 lg:inset-x-8">
          <HeroOverviewMetric label="Projected XI" value={projectedTotal > 0 ? projectedTotal.toFixed(1) : "—"} detail="Next gameweek" />
          <HeroOverviewMetric label="Squad health" value={score == null ? "—" : `${Math.round(score)}%`} detail={diagnostics.health.grade} tone={healthTone} />
          <HeroOverviewMetric label="Free transfers" value={String(state.free_transfers)} detail="Available" />
          <HeroOverviewMetric label="Bank" value={`£${state.bank.toFixed(1)}m`} detail={state.deadline_label} />
        </div>
      </div>
    </section>
  );
}

function HealthGauge({ score }: { score: number | null }) {
  const safeScore = score == null ? 0 : Math.max(0, Math.min(100, score));
  const angle = safeScore * 3.6;
  return (
    <div className="relative grid h-32 w-32 shrink-0 place-items-center rounded-full" style={{ background: `conic-gradient(#00C853 ${angle}deg, #EDF1F7 ${angle}deg)` }}>
      <div className="grid h-[88px] w-[88px] place-items-center rounded-full bg-white shadow-[inset_0_0_0_1px_#E1E7F2]">
        <div className="text-center">
          <p className="text-2xl font-black text-[#070B28]">{score == null ? "—" : Math.round(score)}</p>
          <p className="text-[9px] font-black uppercase tracking-[0.12em] text-[#6C7195]">Health</p>
        </div>
      </div>
    </div>
  );
}

function RiskBar({ label, value, tone }: { label: string; value: number | null; tone: "amber" | "pink" }) {
  const safeValue = value == null ? 0 : Math.max(0, Math.min(100, value));
  const fill = tone === "amber" ? "bg-[#E79A00]" : "bg-[#E90052]";
  const text = tone === "amber" ? "text-[#B57700]" : "text-[#C80046]";
  return (
    <div>
      <div className="flex items-center justify-between gap-3 text-xs font-black">
        <span className="text-[#4D5680]">{label}</span>
        <span className={text}>{value == null ? "—" : `${Math.round(value)}%`}</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#EDF1F7]">
        <div className={`h-full rounded-full ${fill}`} style={{ width: `${safeValue}%` }} />
      </div>
    </div>
  );
}

function SquadHealthSummary({ diagnostics }: { diagnostics: SquadHealthDiagnostics }) {
  const issues = uniqueIssues(diagnostics);
  const suspensionCount = diagnostics.injury_suspension_risk_list.length;
  const rotationCount = diagnostics.minutes_risk_list.length;
  return (
    <section className="rounded-[24px] border border-[#E3DDEA] bg-white p-5 shadow-[0_18px_48px_rgba(35,18,62,0.07)]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#6C1DFF]">Team health</p>
          <h3 className="mt-2 text-xl font-black tracking-[-0.025em] text-[#101533]">Squad availability</h3>
        </div>
        <span className={`rounded-full border px-3 py-1 text-[10px] font-black ${riskTone(diagnostics.health.grade)}`}>{diagnostics.health.grade}</span>
      </div>

      <div className="mt-5 grid grid-cols-[132px_minmax(0,1fr)] items-center gap-4">
        <HealthGauge score={diagnostics.health.score} />
        <div className="space-y-3">
          {[
            { label: "Players flagged", value: issues.length, tone: "bg-[#E8FBF2] text-[#00A568]" },
            { label: "Status risks", value: suspensionCount, tone: "bg-[#FFF0F4] text-[#D13362]" },
            { label: "Rotation risks", value: rotationCount, tone: "bg-[#FFF6E6] text-[#CF7A00]" },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-3">
              <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-black ${item.tone}`}>{item.value}</span>
              <p className="text-xs font-bold text-[#655B75]">{item.label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-5 space-y-3">
        <RiskBar label="Minutes risk" value={diagnostics.health.minutes_risk} tone="amber" />
        <RiskBar label="Status risk" value={diagnostics.health.injury_risk} tone="pink" />
      </div>

      <Link href="/squad/health" className="mt-5 flex min-h-11 items-center justify-center rounded-xl border border-[#DCCEFF] bg-[#F8F4FF] px-4 text-sm font-black text-[#6C1DFF] transition hover:bg-[#F1E8FF]">
        View full squad health <span className="ml-2">›</span>
      </Link>
    </section>
  );
}

function TeamFacts({ state, starters }: { state: UserGameState; starters: Player[] }) {
  const projectedTotal = starters.reduce((sum, player) => sum + (projected(player) ?? 0), 0);
  const items = [
    { label: "Formation", value: state.formation, detail: "Starting shape" },
    { label: "Projected XI", value: projectedTotal > 0 ? formatProjected(projectedTotal) : "—", detail: "Next gameweek" },
    { label: "Free transfers", value: String(state.free_transfers), detail: "Available now" },
    { label: "Bank", value: `£${state.bank.toFixed(1)}m`, detail: state.deadline_label },
  ];

  return (
    <section className="rounded-[22px] border border-[#E1E7F2] bg-white p-5 shadow-[0_18px_45px_rgba(15,23,60,0.07)]">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-black text-[#070B28]">Team facts</h3>
        <span className="rounded-full bg-[#F1E8FF] px-3 py-1 text-xs font-black text-[#6C1DFF]">{state.gameweek_label}</span>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        {items.map((item) => (
          <div key={item.label} className="rounded-2xl border border-[#E8EDF6] bg-[#FBFCFF] p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#6C7195]">{item.label}</p>
            <p className="mt-2 text-xl font-black text-[#101947]">{item.value}</p>
            <p className="mt-1 truncate text-[11px] font-semibold text-[#6C7195]">{item.detail}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function ActionIcon({ type }: { type: "planner" | "scenario" | "captain" | "health" }) {
  const icon = type === "planner"
    ? <><path d="M5 4.5h10v11H5z" strokeLinejoin="round" /><path d="M7.5 2.8v3.4M12.5 2.8v3.4M7.5 9h5M7.5 12h3" strokeLinecap="round" /></>
    : type === "scenario"
      ? <><circle cx="7" cy="7" r="2.5" /><circle cx="13" cy="13" r="2.5" /><path d="m8.8 8.8 2.4 2.4M12.2 6.2l1.8-1.8M5.8 13.8 4 15.6" strokeLinecap="round" /></>
      : type === "captain"
        ? <><circle cx="10" cy="10" r="6.4" /><path d="M12.8 7.3a4 4 0 1 0 0 5.4" strokeLinecap="round" /></>
        : <path d="M10 16.4S3.7 12.9 3.7 7.7A3.55 3.55 0 0 1 10 5.45a3.55 3.55 0 0 1 6.3 2.25c0 5.2-6.3 8.7-6.3 8.7Z" strokeLinejoin="round" />;
  return <svg aria-hidden="true" viewBox="0 0 20 20" className="h-5 w-5 fill-none stroke-current stroke-[1.8]">{icon}</svg>;
}

function QuickActions() {
  const actions = [
    { href: "/planner", title: "Transfer planner", copy: "Plan your next moves", type: "planner" as const },
    { href: "/scenarios", title: "Scenario simulator", copy: "Test different decisions", type: "scenario" as const },
    { href: "/captaincy", title: "Captaincy assistant", copy: "Pick the best captain", type: "captain" as const },
    { href: "/squad/health", title: "Squad health", copy: "Check your team status", type: "health" as const },
  ];
  return (
    <section className="rounded-[24px] border border-[#E3DDEA] bg-white p-5 shadow-[0_18px_48px_rgba(35,18,62,0.07)]">
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#6C1DFF]">Quick actions</p>
      <div className="mt-3 divide-y divide-[#EEE9F3]">
        {actions.map((action) => (
          <Link key={action.href} href={action.href} className="group flex items-center gap-3 py-3 first:pt-1 last:pb-0">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#F2ECFF] text-[#6C1DFF] transition group-hover:bg-[#6C1DFF] group-hover:text-white"><ActionIcon type={action.type} /></span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-black text-[#101533]">{action.title}</span>
              <span className="mt-0.5 block truncate text-xs font-semibold text-[#81798F]">{action.copy}</span>
            </span>
            <span className="text-xl font-black text-[#7D7191] transition group-hover:translate-x-1 group-hover:text-[#6C1DFF]">›</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function NextFixtureCard({ player, deadline }: { player?: Player; deadline: string }) {
  const fixture = player?.fixture && player.fixture !== "TBC" ? player.fixture : "Fixture pending";
  return (
    <section className="rounded-[24px] border border-[#E3DDEA] bg-white p-5 shadow-[0_18px_48px_rgba(35,18,62,0.07)]">
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#6C1DFF]">Next fixture</p>
      <div className="mt-5 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate text-2xl font-black tracking-[-0.035em] text-[#101533]">{fixture}</p>
          <p className="mt-1 truncate text-xs font-semibold text-[#81798F]">{deadline}</p>
        </div>
        {player ? <PlayerVisual player={player} size="lg" /> : <span className="grid h-20 w-20 place-items-center rounded-2xl bg-[#F2ECFF] text-lg font-black text-[#6C1DFF]">GW</span>}
      </div>
      <div className="mt-5 rounded-2xl bg-[#F8F6FB] p-4">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-black text-[#655B75]">Captain projection</span>
          <span className="text-sm font-black text-[#00A568]">{formatProjected(projected(player))}</span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#E6E0EC]">
          <div className="h-full w-3/5 rounded-full bg-[linear-gradient(90deg,#16B979,#FFB800,#F47A2B)]" />
        </div>
      </div>
    </section>
  );
}

function InsightsAtGlance({ state, diagnostics, starters }: { state: UserGameState; diagnostics: SquadHealthDiagnostics; starters: Player[] }) {
  const total = starters.reduce((sum, player) => sum + (projected(player) ?? 0), 0);
  const issues = uniqueIssues(diagnostics).length;
  const items = [
    { label: "Projected XI", value: total > 0 ? formatProjected(total) : "—", detail: "Next gameweek", tone: "text-[#00A568]" },
    { label: "Squad health", value: diagnostics.health.score == null ? "—" : `${Math.round(diagnostics.health.score)}%`, detail: diagnostics.health.grade, tone: "text-[#6C1DFF]" },
    { label: "Active flags", value: String(issues), detail: issues ? "Review before deadline" : "Squad clear", tone: issues ? "text-[#D97706]" : "text-[#00A568]" },
    { label: "Transfer position", value: `${state.free_transfers} FT · £${state.bank.toFixed(1)}m`, detail: "Available now", tone: "text-[#1987E8]" },
  ];
  return (
    <section className="mt-5 rounded-[24px] border border-[#E3DDEA] bg-white p-5 shadow-[0_18px_48px_rgba(35,18,62,0.07)] sm:p-6">
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#6C1DFF]">Insights at a glance</p>
      <div className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-[#E8E2EE] bg-[#E8E2EE] lg:grid-cols-4">
        {items.map((item) => (
          <div key={item.label} className="min-w-0 bg-white p-4">
            <p className="text-[9px] font-black uppercase tracking-[0.12em] text-[#81798F]">{item.label}</p>
            <p className={`mt-2 truncate text-lg font-black tracking-[-0.025em] ${item.tone}`}>{item.value}</p>
            <p className="mt-1 truncate text-[11px] font-semibold text-[#81798F]">{item.detail}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function RecommendedFix({ diagnostics }: { diagnostics: SquadHealthDiagnostics }) {
  const fix = diagnostics.recommended_fix;
  return (
    <section className="overflow-hidden rounded-[22px] border border-[#D8C9FF] bg-[linear-gradient(145deg,#F8F4FF,#F2ECFF)] shadow-[0_18px_45px_rgba(108,29,255,0.09)]">
      <div className="p-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#6C1DFF]">Recommended focus</p>
          <span className={`rounded-full border px-3 py-1 text-[10px] font-black ${riskTone(fix.risk)}`}>{fix.confidence} confidence</span>
        </div>
        <h3 className="mt-3 text-2xl font-black leading-tight text-[#17002F]">{fix.action}</h3>
        <p className="mt-3 text-sm font-semibold leading-6 text-[#4D5680]">{fix.why}</p>
        {fix.why_this_could_be_wrong ? (
          <details className="mt-4 rounded-xl border border-[#D8C9FF] bg-white/65 p-3">
            <summary className="cursor-pointer text-xs font-black text-[#6C1DFF]">What could change this?</summary>
            <p className="mt-2 text-xs font-semibold leading-5 text-[#5D4A70]">{fix.why_this_could_be_wrong}</p>
          </details>
        ) : null}
      </div>
      <div className="grid grid-cols-2 border-t border-[#D8C9FF] bg-white/55">
        <Link href="/transfers" className="px-4 py-3 text-center text-sm font-black text-[#6C1DFF]">Review transfers</Link>
        <Link href="/planner" className="border-l border-[#D8C9FF] px-4 py-3 text-center text-sm font-black text-[#17002F]">Open planner</Link>
      </div>
    </section>
  );
}

function FlagSummary({ diagnostics }: { diagnostics: SquadHealthDiagnostics }) {
  const items = [
    { label: "Urgent", count: diagnostics.urgent_issues.length, tone: "text-[#C80046] bg-[#FFF0F5]" },
    { label: "Minutes", count: diagnostics.minutes_risk_list.length, tone: "text-[#B57700] bg-[#FFF8E8]" },
    { label: "Status", count: diagnostics.injury_suspension_risk_list.length, tone: "text-[#C80046] bg-[#FFF0F5]" },
    { label: "Bench", count: diagnostics.weak_bench_alerts.length, tone: "text-[#6C1DFF] bg-[#F1E8FF]" },
  ];
  const topIssues = uniqueIssues(diagnostics).slice(0, 3);

  return (
    <section className="rounded-[22px] border border-[#E1E7F2] bg-white p-5 shadow-[0_18px_45px_rgba(15,23,60,0.07)]">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-black text-[#070B28]">Flags and pressure</h3>
        <Link href="/squad/health" className="text-xs font-black text-[#6C1DFF]">View all →</Link>
      </div>
      <div className="mt-4 grid grid-cols-4 gap-2">
        {items.map((item) => (
          <div key={item.label} className={`rounded-xl px-2 py-3 text-center ${item.tone}`}>
            <p className="text-xl font-black">{item.count}</p>
            <p className="mt-1 text-[9px] font-black uppercase tracking-[0.08em]">{item.label}</p>
          </div>
        ))}
      </div>
      <div className="mt-4 space-y-2">
        {topIssues.length ? (
          topIssues.map((issue) => (
            <div key={issue.id} className="flex items-start gap-3 rounded-xl border border-[#E8EDF6] bg-[#FBFCFF] p-3">
              <PlayerVisual player={issue.affected_player} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-black text-[#101947]">{issue.affected_player.name}</p>
                  <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-black ${riskTone(issue.severity)}`}>{issue.severity}</span>
                </div>
                <p className="mt-1 line-clamp-2 text-xs font-semibold leading-5 text-[#6C7195]">{issue.reason}</p>
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-xl border border-[#BDEFD2] bg-[#EFFFF5] p-4 text-sm font-bold text-[#008B49]">No material squad flags detected.</div>
        )}
      </div>
    </section>
  );
}

function BenchRail({ players }: { players: Player[] }) {
  return (
    <section className="border-t border-[#E5DFEA] bg-white px-3 py-4 sm:px-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#6C1DFF]">Bench</p>
          <h3 className="mt-1 text-lg font-black text-[#101533]">Substitutes</h3>
        </div>
        <span className="rounded-full bg-[#F2ECFF] px-3 py-1 text-[10px] font-black text-[#6C1DFF]">{players.length} players</span>
      </div>
      <div className="flex snap-x gap-2.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:grid md:grid-cols-4 md:overflow-visible">
        {players.map((player, index) => (
          <article key={player.id} className="w-[205px] shrink-0 snap-start rounded-2xl border border-[#E8E2EE] bg-[#FAF9FC] p-3 md:w-auto">
            <div className="flex items-center gap-2.5">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[#F2ECFF] text-[10px] font-black text-[#6C1DFF]">{index + 1}</span>
              <PlayerVisual player={player} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-black text-[#101533]">{player.name}</p>
                <p className="truncate text-[10px] font-bold text-[#81798F]">{player.position} · {player.team}</p>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between rounded-xl bg-white px-3 py-2">
              <span className="text-[9px] font-black uppercase tracking-[0.08em] text-[#81798F]">Projection</span>
              <span className="text-[11px] font-black text-[#00A568]">{formatProjected(projected(player))}</span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function MobileDisclosure({ title, summary, children }: { title: string; summary: string; children: React.ReactNode }) {
  return (
    <details className="rounded-[22px] border border-[#E1E7F2] bg-white shadow-[0_18px_45px_rgba(15,23,60,0.07)] md:hidden">
      <summary className="cursor-pointer list-none p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-lg font-black text-[#070B28]">{title}</p>
            <p className="mt-1 text-xs font-semibold text-[#6C7195]">{summary}</p>
          </div>
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#F1E8FF] text-lg font-black text-[#6C1DFF]">+</span>
        </div>
      </summary>
      <div className="border-t border-[#E1E7F2] p-4">{children}</div>
    </details>
  );
}

export default function SquadPage() {
  // Seeded synchronously (lazy initializer, computed once) so a return visit to this page shows
  // what was already loaded instantly instead of blanking to a spinner - same fix, same pattern
  // as imported-dashboard-flow.tsx's own initialCache. The effect below still always re-fetches
  // in the background regardless of a cache hit - this only changes whether the user watches
  // that happen on a blank screen.
  const [initialCache] = useState<SquadDisplayCacheEntry | null>(() => {
    if (typeof window === "undefined") return null;
    const { entryId } = resolveAuthoritativeIdentity();
    return readSquadDisplayCache(entryId);
  });

  const [data, setData] = useState<SquadRosterData | null>(initialCache);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    const hadCache = Boolean(initialCache);

    async function load(retryAttempt: number) {
      const { entryId, event } = resolveAuthoritativeIdentity();
      if (!entryId) {
        if (!cancelled && !hadCache) setError(new Error("Import required. Import your FPL team before opening /squad."));
        return;
      }
      try {
        const fresh = await loadSquadRosterDataClient(entryId, event);
        if (cancelled) return;
        setData(fresh);
        setError(null);
        writeSquadDisplayCache(entryId, fresh);

        // squad_health was still computing - real projections aren't in yet (see
        // loadSquadRosterDataClient's analysisPending). Retry on a bounded backoff instead of
        // silently leaving 0/— on screen forever with nothing to ever refresh it.
        if (fresh.analysisPending && retryAttempt < SQUAD_PENDING_RETRY_DELAYS_MS.length) {
          const delay = SQUAD_PENDING_RETRY_DELAYS_MS[retryAttempt];
          retryTimer = setTimeout(() => {
            void load(retryAttempt + 1);
          }, delay);
        }
      } catch (err) {
        // A transient refresh failure must not blank out an already-showing cached roster - only
        // surface the error state for a genuine cold load with nothing on screen yet.
        if (!cancelled && !hadCache) setError(err);
      }
    }

    void load(0);
    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [initialCache]);

  if (!data && error) {
    return <RouteError title="My Team" route="/squad" error={error} />;
  }

  if (!data) {
    return (
      <AppShell title="My Team" eyebrow="Squad structure, projections and health">
        <LoadingState label="Loading your team" />
      </AppShell>
    );
  }

  const { appState, squadPlayers, diagnostics, dataSource } = data;
  const starters = squadPlayers.slice(0, 11);
  const bench = squadPlayers.slice(11);
  const captain = starters.find((player) => player.role === "captain") ?? starters[0];
  const viceCaptain = starters.find((player) => player.role === "vice captain") ?? starters.find((player) => player.id !== captain?.id) ?? starters[1];

  return (
    <AppShell title="My Team" eyebrow="Squad structure, projections and health" state={appState} dataSource={dataSource}>
      <TeamOverviewHero state={appState} diagnostics={diagnostics} starters={starters} />

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.55fr)_360px] 2xl:grid-cols-[minmax(0,1.65fr)_390px]">
        <div className="min-w-0 overflow-hidden rounded-[26px] border border-[#E3DDEA] bg-white shadow-[0_22px_58px_rgba(35,18,62,0.08)]">
          <div className="flex flex-col gap-3 px-4 pb-4 pt-5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#6C1DFF]">Starting XI</p>
              <h2 className="mt-1 text-2xl font-black tracking-[-0.03em] text-[#101533]">{appState.formation} setup</h2>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-[#FFF6E6] px-3 py-1.5 text-[10px] font-black text-[#B86B00]">C · {captain?.name ?? "TBC"}</span>
              <span className="rounded-full bg-[#EEF4FF] px-3 py-1.5 text-[10px] font-black text-[#245EC7]">V · {viceCaptain?.name ?? "TBC"}</span>
            </div>
          </div>
          <div className="px-3 sm:px-5">
            <SquadPitch players={starters} captainId={captain?.id} viceCaptainId={viceCaptain?.id} />
          </div>
          <BenchRail players={bench} />
        </div>

        <aside className="space-y-4">
          <QuickActions />
          <SquadHealthSummary diagnostics={diagnostics} />
          <NextFixtureCard player={captain} deadline={appState.deadline_label} />
          <RecommendedFix diagnostics={diagnostics} />
          <FlagSummary diagnostics={diagnostics} />
          <TeamFacts state={appState} starters={starters} />
        </aside>
      </div>

      <InsightsAtGlance state={appState} diagnostics={diagnostics} starters={starters} />

      <div className="mt-6 space-y-4 md:hidden">
        <MobileDisclosure title="Full health diagnostics" summary="Player risks, fixtures, minutes and squad pressure">
          <SquadHealthEmbed />
        </MobileDisclosure>
        <MobileDisclosure title="Saved health history" summary="Compare this squad with previous gameweeks">
          <SavedSquadHealthPanel entryId={appState.team_id_label} currentGameweek={appState.gameweek} />
        </MobileDisclosure>
        <MobileDisclosure title="All player cards" summary="Full metrics for the starting XI and bench">
          <div>
            <h3 className="text-lg font-black text-[#070B28]">Starting XI</h3>
            <div className="mt-3 grid gap-3">
              {starters.map((player) => <PlayerCard key={player.id} player={player} />)}
            </div>
            <h3 className="mt-6 text-lg font-black text-[#070B28]">Bench</h3>
            <div className="mt-3 grid gap-3">
              {bench.map((player) => <PlayerCard key={player.id} player={player} compact />)}
            </div>
          </div>
        </MobileDisclosure>
      </div>

      <div className="mt-8 hidden space-y-8 md:block">
        <section className="rounded-[24px] border border-[#E1E7F2] bg-white p-6 shadow-[0_22px_60px_rgba(15,23,60,0.08)] lg:p-8">
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[#6C1DFF]">Deep analysis</p>
              <h2 className="mt-2 text-3xl font-black text-[#070B28]">Full squad health diagnostics</h2>
            </div>
            <Link href="/squad/health" className="rounded-xl border border-[#D8C9FF] bg-[#F8F5FF] px-4 py-3 text-sm font-black text-[#6C1DFF]">Open dedicated view</Link>
          </div>
          <SquadHealthEmbed />
        </section>

        <SavedSquadHealthPanel entryId={appState.team_id_label} currentGameweek={appState.gameweek} />

        <section>
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[#6C1DFF]">Player detail</p>
              <h2 className="mt-2 text-3xl font-black text-[#070B28]">Starting XI</h2>
            </div>
            <span className="rounded-full bg-[#EFFFF5] px-3 py-1 text-xs font-black text-[#008B49]">11 starters</span>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {starters.map((player) => <PlayerCard key={player.id} player={player} />)}
          </div>
        </section>

        <section>
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[#6C1DFF]">Substitutes</p>
              <h2 className="mt-2 text-3xl font-black text-[#070B28]">Bench detail</h2>
            </div>
            <span className="rounded-full bg-[#F1E8FF] px-3 py-1 text-xs font-black text-[#6C1DFF]">{bench.length} players</span>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {bench.map((player) => <PlayerCard key={player.id} player={player} compact />)}
          </div>
        </section>
      </div>
    </AppShell>
  );
}