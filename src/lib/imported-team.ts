import type { ImportTeamResponse, ImportedSquadPick, Player, StoredImportedTeam, UserGameState } from "./types";

export const IMPORTED_TEAM_STORAGE_KEY = "matchday_os_imported_team";
export const FPL_ENTRY_COOKIE = "fpl_entry_id";
export const FPL_EVENT_COOKIE = "fpl_event";
export const IMPORTED_TEAM_ENTRY_COOKIE = "matchday_os_entry_id";
export const IMPORTED_TEAM_EVENT_COOKIE = "matchday_os_event";
// Reserved entry id the backend serves a demo squad for (real 2026/27 players/fixtures/
// projections, sample squad) while FPL hides everyone's picks until the GW1 deadline.
// Must match DEMO_ENTRY_ID in fpl-os-backend/app/services/squad_health.py.
export const DEMO_ENTRY_ID = "999999999";

const IMPORTED_TEAM_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

// Shared by every client component that needs to resolve the current entry_id/event the same way
// the server-rendered pages do (via cookies()) - reads the identical cookie names client-side.
// Originally private to imported-dashboard-flow.tsx; pulled out here once squad/page.tsx needed
// the exact same resolution to avoid the two drifting apart.
export function readBrowserCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;

  const prefix = `${name}=`;
  const match = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix));

  if (!match) return undefined;

  try {
    return decodeURIComponent(match.slice(prefix.length));
  } catch {
    return match.slice(prefix.length);
  }
}

const IMPORTED_BASE_STATE: UserGameState = {
  manager_name: "Manager",
  team_name: "Imported team",
  team_id_label: "Imported",
  gameweek: 1,
  gameweek_label: "GW1",
  deadline_label: "Deadline pending",
  formation: "3-4-3",
  bank: 0,
  free_transfers: 1,
  current_tier: "Free",
};

function asNumber(value: unknown, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) return value;

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }

  return fallback;
}

function asNullableNumber(value: unknown) {
  const parsed = asNumber(value, Number.NaN);
  return Number.isFinite(parsed) ? parsed : null;
}

function pickPlayerId(pick: ImportedSquadPick) {
  return asNumber(pick.player_id ?? pick.element ?? pick.id, 0);
}

function resolvedImportEvent(response: ImportTeamResponse) {
  // planning_event MUST win when present - it's the same value the backend's own
  // schedule_precompute() plans from (see squad_health.py's import router), not the raw
  // squad-snapshot gameweek. Found live: during the off-season the two genuinely differ
  // (e.g. gameweek=38, the last finished GW, vs planning_event=1, the first GW with real
  // seeded projection data for the new season) - preferring the raw gameweek here meant
  // every planner/dashboard/scenarios/market request built its start_gw from 38 while
  // precompute had already computed and cached everything under start_gw=1, so the two
  // could never converge on the same cache_key and the "instant load from precompute"
  // path was permanently unreachable.
  const candidates = [
    response.planning_event,
    response.gameweek,
    response.resolved_gameweek,
    response.event,
    response.resolved_event,
    response.current_event,
    response.entry_history?.event,
  ];

  for (const candidate of candidates) {
    const value = asNumber(candidate, 0);
    if (value > 0) return value;
  }

  throw new Error("Import response did not include a resolved gameweek/event.");
}

// Mirrors the API route's own resolveImportedSquadEvent (see api/import-team-data/route.ts) -
// deliberately does NOT consider planning_event, unlike resolvedImportEvent above. This is the
// actual gameweek the backend fetched picks for, and the only value safe to persist back into
// IMPORTED_TEAM_EVENT_COOKIE.
function resolvedSquadSnapshotEvent(response: ImportTeamResponse) {
  const candidates = [
    response.gameweek,
    response.resolved_gameweek,
    response.event,
    response.resolved_event,
    response.current_event,
    response.entry_history?.event,
  ];

  for (const candidate of candidates) {
    const value = asNumber(candidate, 0);
    if (value > 0) return value;
  }

  return undefined;
}

function positionLabel(value: ImportedSquadPick["position"]): Player["position"] {
  if (value === "GK" || value === "DEF" || value === "MID" || value === "FWD") return value;
  if (value === 1 || value === "1") return "GK";
  if (value === 2 || value === "2") return "DEF";
  if (value === 3 || value === "3") return "MID";
  if (value === 4 || value === "4") return "FWD";
  return "MID";
}

function statusLabel(value: unknown): Player["status"] {
  if (value === "d") return "Doubt";
  if (value === "i") return "Injured";
  if (value === "s") return "Suspended";
  return "Available";
}

function pickPrice(pick: ImportedSquadPick) {
  const raw = pick as ImportedSquadPick & {
    now_cost?: unknown;
    cost?: unknown;
  };

  const price = asNumber(pick.price ?? raw.now_cost ?? raw.cost, 0);

  // FPL often stores prices as 56 instead of 5.6.
  return price > 25 ? Number((price / 10).toFixed(1)) : price;
}

export function importedTeamFromResponse(response: ImportTeamResponse): StoredImportedTeam {
  // event now follows resolvedImportEvent()'s planning_event-first priority (see there) - it's
  // both the squad snapshot identity and the gameweek every downstream request plans from.
  const event = resolvedImportEvent(response);
  const squadGameweek = event;
  const freeTransfers = asNumber(
    response.free_transfers ?? response.entry_history?.free_transfers,
    IMPORTED_BASE_STATE.free_transfers,
  );

  return {
    entry_id: String(response.entry_id),
    event,
    gameweek: squadGameweek,
    squad_snapshot_event: resolvedSquadSnapshotEvent(response) ?? event,
    team_name: response.team_name ?? undefined,
    squad: Array.isArray(response.squad) ? response.squad : [],
    imported_at: new Date().toISOString(),
    bank: asNullableNumber(response.bank),
    free_transfers: freeTransfers,
    entry_history: response.entry_history,
  };
}

export function saveImportedTeam(imported: StoredImportedTeam) {
  if (typeof window === "undefined") return;

  const value = JSON.stringify(imported);

  try {
    window.localStorage.setItem(IMPORTED_TEAM_STORAGE_KEY, value);
  } catch {
    // Query params/cookies can still recover the import if persistent storage is blocked.
  }

  try {
    window.sessionStorage.setItem(IMPORTED_TEAM_STORAGE_KEY, value);
  } catch {
    // Query params/cookies can still recover the import if session storage is blocked.
  }

  try {
    // FPL_EVENT_COOKIE carries the planning target (imported.gameweek/event, planning_event-first
    // per resolvedImportEvent) - every planner/dashboard/scenarios/market request plans from this.
    // IMPORTED_TEAM_EVENT_COOKIE carries the squad SNAPSHOT identity instead
    // (imported.squad_snapshot_event) - the route replays this as an explicit ?event= specifically
    // to /squad-health/import/:entry_id (see route.ts's own resolveImportedSquadEvent/
    // importedSquadEventFromRequest comments on why it must never fall back to the planning
    // event). Found live: writing imported.gameweek here too silently overwrote the server's
    // correct snapshot-event cookie with the planning event on every save, so the very next
    // /squad-health/import call re-resolved a DIFFERENT (often bogus, not-yet-locked) gameweek's
    // picks instead of reusing the squad the user was already looking at - the root cause of the
    // Dashboard/My Team squad mismatch.
    document.cookie = `${FPL_ENTRY_COOKIE}=${encodeURIComponent(imported.entry_id)}; path=/; max-age=${IMPORTED_TEAM_COOKIE_MAX_AGE}; samesite=lax`;
    document.cookie = `${FPL_EVENT_COOKIE}=${encodeURIComponent(String(imported.gameweek))}; path=/; max-age=${IMPORTED_TEAM_COOKIE_MAX_AGE}; samesite=lax`;
    document.cookie = `${IMPORTED_TEAM_ENTRY_COOKIE}=${encodeURIComponent(imported.entry_id)}; path=/; max-age=${IMPORTED_TEAM_COOKIE_MAX_AGE}; samesite=lax`;
    document.cookie = `${IMPORTED_TEAM_EVENT_COOKIE}=${encodeURIComponent(String(imported.squad_snapshot_event))}; path=/; max-age=${IMPORTED_TEAM_COOKIE_MAX_AGE}; samesite=lax`;
  } catch {
    // Server pages can still use URL params on pages that expose them.
  }
}

export function readImportedTeam(): StoredImportedTeam | null {
  if (typeof window === "undefined") return null;

  const value =
    window.localStorage.getItem(IMPORTED_TEAM_STORAGE_KEY) ??
    window.sessionStorage.getItem(IMPORTED_TEAM_STORAGE_KEY);

  if (!value) return null;

  try {
    const parsed = JSON.parse(value) as StoredImportedTeam;
    if (!parsed.entry_id || !Array.isArray(parsed.squad)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function importedTeamMatches(imported: StoredImportedTeam | null, entryId: string, event?: number) {
  if (!imported) return false;
  if (imported.entry_id !== entryId) return false;
  return !event || imported.event === event || imported.gameweek === event;
}

export function commandCentrePayloadFromImport(imported: StoredImportedTeam) {
  return {
    gameweek: imported.event,
    start_gw: imported.event,
    horizon: 5,
    bank: imported.bank ?? IMPORTED_BASE_STATE.bank,
    free_transfers: imported.free_transfers ?? IMPORTED_BASE_STATE.free_transfers,
    max_hits: 2,
    risk_profile: "balanced",
    entry_id: imported.entry_id,
    squad: imported.squad
      .map((pick, index) => ({
        player_id: pickPlayerId(pick),
        multiplier: asNumber(pick.multiplier, index < 11 ? 1 : 0),
        is_captain: Boolean(pick.is_captain),
        is_vice_captain: Boolean(pick.is_vice_captain),
        squad_position: asNumber(pick.squad_position, index + 1),
      }))
      .filter((pick) => pick.player_id > 0),
  };
}

export function playersFromImport(imported: StoredImportedTeam): Player[] {
  return imported.squad.map((pick, index) => {
    const id = pickPlayerId(pick) || index + 1;
    const name =
      pick.web_name ||
      [pick.first_name, pick.second_name].filter(Boolean).join(" ") ||
      `Imported Player ${id}`;

    return {
      id,
      api_id: id,
      code: asNumber(pick.code, 0) || undefined,
      name,
      team: pick.team_short_name ?? pick.team ?? "TBC",
      position: positionLabel(pick.position),
      price: pickPrice(pick),
      projected: 0,
      fixture: "TBC",
      fixture_difficulty: 3,
      ownership: 0,
      form: 0,
      three_gw_projected: 0,
      price_movement: 0,
      trend: "flat",
      status: statusLabel(pick.status),
      risk: pick.news ? "Medium" : "Low",
      role: pick.is_captain
        ? "captain"
        : pick.is_vice_captain
          ? "vice captain"
          : asNumber(pick.multiplier, index < 11 ? 1 : 0) === 0
            ? "bench"
            : "starter",
    };
  });
}

export function appStateFromImport(imported: StoredImportedTeam): UserGameState {
  return {
    ...IMPORTED_BASE_STATE,
    team_name: imported.team_name?.trim() || `FPL Team ${imported.entry_id}`,
    team_id_label: imported.entry_id,
    gameweek: imported.event,
    gameweek_label: `GW${imported.event}`,
    bank: imported.bank ?? IMPORTED_BASE_STATE.bank,
    free_transfers: imported.free_transfers ?? IMPORTED_BASE_STATE.free_transfers,
  };
}
