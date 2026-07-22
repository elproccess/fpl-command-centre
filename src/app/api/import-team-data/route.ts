import { NextRequest, NextResponse } from "next/server";
import {
  FPL_ENTRY_COOKIE,
  FPL_EVENT_COOKIE,
  IMPORTED_TEAM_ENTRY_COOKIE,
  IMPORTED_TEAM_EVENT_COOKIE,
} from "@/lib/imported-team";

const BACKEND_API_BASE_URL =
  process.env.BACKEND_API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "http://127.0.0.1:8000";

const IMPORT_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function positiveInt(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.floor(value);
  }

  if (typeof value === "string" && /^\d+$/.test(value.trim())) {
    const parsed = Number.parseInt(value.trim(), 10);
    return parsed > 0 ? parsed : undefined;
  }

  return undefined;
}

function asPositiveEvent(value: string | undefined | null): string {
  if (!value || !/^\d+$/.test(value.trim())) return "";
  return value.trim();
}

function entryIdFromRequest(request: NextRequest): string {
  return (
    request.nextUrl.searchParams.get("entry_id")?.trim() ??
    request.cookies.get(IMPORTED_TEAM_ENTRY_COOKIE)?.value ??
    request.cookies.get(FPL_ENTRY_COOKIE)?.value ??
    ""
  );
}

/**
 * This is the planner/display GW.
 * It should NOT be used to fetch the imported squad snapshot from the backend.
 */
function plannerEventFromRequest(request: NextRequest): string {
  return asPositiveEvent(
    request.nextUrl.searchParams.get("event") ??
      request.nextUrl.searchParams.get("gameweek") ??
      request.nextUrl.searchParams.get("gw") ??
      request.cookies.get(FPL_EVENT_COOKIE)?.value,
  );
}

/**
 * This is the imported squad snapshot GW.
 * This is what should be sent to /squad-health/import/:entry_id?event=...
 *
 * If missing, we deliberately call the backend without ?event so it can auto-resolve
 * the latest available squad snapshot. We do NOT fall back to planner event here.
 */
function importedSquadEventFromRequest(request: NextRequest): string {
  return asPositiveEvent(
    request.nextUrl.searchParams.get("import_event") ??
      request.nextUrl.searchParams.get("squad_event") ??
      request.cookies.get(IMPORTED_TEAM_EVENT_COOKIE)?.value,
  );
}

function resolveImportedSquadEvent(payload: Record<string, unknown>): number | undefined {
  const entryHistory =
    typeof payload.entry_history === "object" && payload.entry_history !== null
      ? (payload.entry_history as Record<string, unknown>)
      : {};

  const candidates = [
    payload.gameweek,
    payload.resolved_gameweek,
    payload.event,
    payload.resolved_event,
    entryHistory.event,
    payload.current_event,
  ];

  for (const candidate of candidates) {
    const value = positiveInt(candidate);
    if (value) return value;
  }

  return undefined;
}

function resolvePlannerEvent(
  payload: Record<string, unknown>,
  requestedPlannerEvent: string,
  squadSnapshotEvent: number,
): number {
  const candidates = [
    requestedPlannerEvent,
    payload.planning_event,
    payload.next_event,
    payload.current_planning_event,
    payload.current_event,
    squadSnapshotEvent,
  ];

  for (const candidate of candidates) {
    const value = positiveInt(candidate);
    if (value) return value;
  }

  return squadSnapshotEvent;
}

function buildBackendImportUrl(entryId: string, importedSquadEvent: string): string {
  const base = BACKEND_API_BASE_URL.replace(/\/$/, "");
  const path = `/squad-health/import/${encodeURIComponent(entryId)}`;

  if (!importedSquadEvent) return `${base}${path}`;

  return `${base}${path}?event=${encodeURIComponent(importedSquadEvent)}`;
}

function setEntryCookies(response: NextResponse, entryId: string) {
  for (const name of [FPL_ENTRY_COOKIE, IMPORTED_TEAM_ENTRY_COOKIE]) {
    response.cookies.set(name, entryId, {
      httpOnly: false,
      sameSite: "lax",
      path: "/",
      maxAge: IMPORT_COOKIE_MAX_AGE,
    });
  }
}

function setPlannerEventCookie(response: NextResponse, event: number) {
  response.cookies.set(FPL_EVENT_COOKIE, String(event), {
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    maxAge: IMPORT_COOKIE_MAX_AGE,
  });
}

function setImportedSquadEventCookie(response: NextResponse, event: number) {
  response.cookies.set(IMPORTED_TEAM_EVENT_COOKIE, String(event), {
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    maxAge: IMPORT_COOKIE_MAX_AGE,
  });
}

export async function GET(request: NextRequest) {
  const entryId = entryIdFromRequest(request);
  const requestedPlannerEvent = plannerEventFromRequest(request);
  const requestedImportedSquadEvent = importedSquadEventFromRequest(request);

  console.log("[import-team-data] entryId", entryId);
  console.log("[import-team-data] requested planner event", requestedPlannerEvent || "(missing)");
  console.log("[import-team-data] requested imported squad event", requestedImportedSquadEvent || "(auto)");

  if (!entryId) {
    return NextResponse.json({ error: "missing_entry_id" }, { status: 400 });
  }

  const backendUrl = buildBackendImportUrl(entryId, requestedImportedSquadEvent);

  console.log("[import-team-data] backend base", BACKEND_API_BASE_URL);
  console.log("[import-team-data] backend url", backendUrl);

  let response: Response;

  try {
    response = await fetch(backendUrl, { cache: "no-store" });
  } catch (error) {
    return NextResponse.json(
      {
        error: "backend_import_request_failed",
        message: error instanceof Error ? error.message : "Backend import request failed",
      },
      { status: 502 },
    );
  }

  const body = await response.text();

  if (!response.ok) {
    return NextResponse.json(
      {
        error: "backend_import_failed",
        status: response.status,
        message: body.slice(0, 500),
      },
      { status: response.status },
    );
  }

  let payload: Record<string, unknown>;

  try {
    payload = JSON.parse(body) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_import_response" }, { status: 502 });
  }

  const squadSnapshotEvent = resolveImportedSquadEvent(payload);

  if (!squadSnapshotEvent) {
    return NextResponse.json({ error: "missing_squad_snapshot_event" }, { status: 502 });
  }

  const plannerEvent = resolvePlannerEvent(
    payload,
    requestedPlannerEvent,
    squadSnapshotEvent,
  );

  console.log("[import-team-data] backend gameweek", payload.gameweek);
  console.log("[import-team-data] backend planning_event", payload.planning_event);
  console.log("[import-team-data] squad snapshot event", squadSnapshotEvent);
  console.log("[import-team-data] planner event", plannerEvent);

  const nextResponse = NextResponse.json(payload);

  setEntryCookies(nextResponse, entryId);
  setPlannerEventCookie(nextResponse, plannerEvent);
  setImportedSquadEventCookie(nextResponse, squadSnapshotEvent);

  return nextResponse;
}