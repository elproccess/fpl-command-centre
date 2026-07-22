import { NextRequest, NextResponse } from "next/server";
import {
  FPL_ENTRY_COOKIE,
  FPL_EVENT_COOKIE,
  IMPORTED_TEAM_ENTRY_COOKIE,
  IMPORTED_TEAM_EVENT_COOKIE,
} from "@/lib/imported-team";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BACKEND_API_BASE_URL =
  process.env.BACKEND_API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "http://127.0.0.1:8000";

const IMPORT_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

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

function requestOrigin(request: NextRequest): string {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = forwardedHost ?? request.headers.get("host");

  const forwardedProto = request.headers.get("x-forwarded-proto");
  const proto =
    forwardedProto ??
    request.nextUrl.protocol.replace(/:$/, "") ??
    "http";

  return host ? `${proto}://${host}` : new URL(request.url).origin;
}

function redirectToImportError(
  request: NextRequest,
  error: string,
  params: Record<string, string | number | undefined> = {},
) {
  const origin = requestOrigin(request);
  const url = new URL("/import", origin);

  url.searchParams.set("error", error);

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      url.searchParams.set(key, String(value));
    }
  }

  return NextResponse.redirect(url, { status: 303 });
}

function requestedSquadSnapshotEventFromForm(formData: FormData): string {
  const raw =
    formData.get("gameweek") ??
    formData.get("event") ??
    formData.get("gw") ??
    "";

  const value = String(raw).trim();

  return /^\d+$/.test(value) ? value : "";
}

/**
 * This is the imported squad snapshot GW.
 * Example: backend may return gameweek 38 because that is the latest real squad snapshot.
 *
 * Do NOT use planning_event here.
 */
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

/**
 * This is the planner/display GW.
 * Example: backend may return planning_event 1 for the upcoming forecast start.
 */
function resolvePlanningEvent(
  payload: Record<string, unknown>,
  requestedSquadSnapshotEvent: string,
  squadSnapshotEvent: number,
): number | undefined {
  const candidates = [
    payload.planning_event,
    payload.next_event,
    payload.current_planning_event,
    payload.current_event,
    requestedSquadSnapshotEvent,
    squadSnapshotEvent,
  ];

  for (const candidate of candidates) {
    const value = positiveInt(candidate);
    if (value) return value;
  }

  return undefined;
}

function buildBackendImportUrl(entryId: string, squadSnapshotEvent: string): string {
  const base = BACKEND_API_BASE_URL.replace(/\/$/, "");
  const path = `/squad-health/import/${encodeURIComponent(entryId)}`;

  if (!squadSnapshotEvent) return `${base}${path}`;

  return `${base}${path}?event=${encodeURIComponent(squadSnapshotEvent)}`;
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

export async function POST(request: NextRequest) {
  const formData = await request.formData();

  const entryId = String(formData.get("team_id") ?? "").trim();
  const requestedSquadSnapshotEvent = requestedSquadSnapshotEventFromForm(formData);

  console.log("[import-team] form keys", Array.from(formData.keys()));
  console.log("[import-team] entryId", entryId);
  console.log("[import-team] requested squad snapshot event", requestedSquadSnapshotEvent || "(auto)");

  if (!entryId) {
    return redirectToImportError(request, "missing_team_id");
  }

  const backendUrl = buildBackendImportUrl(entryId, requestedSquadSnapshotEvent);

  console.log("[import-team] backend base", BACKEND_API_BASE_URL);
  console.log("[import-team] backend url", backendUrl);

  let backendResponse: Response;

  try {
    backendResponse = await fetch(backendUrl, {
      cache: "no-store",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Backend import request failed";

    console.warn("[import-team] backend import request failed", {
      entryId,
      requestedSquadSnapshotEvent,
      message,
    });

    return redirectToImportError(request, "import_failed", {
      status: "network_error",
      message,
    });
  }

  const backendBody = await backendResponse.text();

  if (!backendResponse.ok) {
    const message = backendBody.slice(0, 500);

    console.warn("[import-team] backend import failed", {
      entryId,
      requestedSquadSnapshotEvent,
      status: backendResponse.status,
      message,
    });

    return redirectToImportError(request, "import_failed", {
      status: backendResponse.status,
      message,
    });
  }

  let payload: Record<string, unknown>;

  try {
    payload = JSON.parse(backendBody) as Record<string, unknown>;
  } catch {
    console.warn("[import-team] backend returned invalid JSON", {
      entryId,
      requestedSquadSnapshotEvent,
      bodyPreview: backendBody.slice(0, 500),
    });

    return redirectToImportError(request, "invalid_import_response");
  }

  const squadSnapshotEvent = resolveImportedSquadEvent(payload);

  if (!squadSnapshotEvent) {
    return redirectToImportError(request, "missing_squad_snapshot_event");
  }

  const planningEvent = resolvePlanningEvent(
    payload,
    requestedSquadSnapshotEvent,
    squadSnapshotEvent,
  );

  if (!planningEvent) {
    return redirectToImportError(request, "missing_planning_event");
  }

  console.log("[import-team] backend gameweek", payload.gameweek);
  console.log("[import-team] backend planning_event", payload.planning_event);
  console.log("[import-team] squad snapshot event", squadSnapshotEvent);
  console.log("[import-team] planning event", planningEvent);

  const origin = requestOrigin(request);
  const redirectUrl = new URL("/dashboard", origin);

  redirectUrl.searchParams.set("entry_id", entryId);

  // Planner/display GW.
  redirectUrl.searchParams.set("event", String(planningEvent));

  // Imported squad snapshot GW.
  redirectUrl.searchParams.set("import_event", String(squadSnapshotEvent));

  const redirect = NextResponse.redirect(redirectUrl, { status: 303 });

  setEntryCookies(redirect, entryId);
  setPlannerEventCookie(redirect, planningEvent);
  setImportedSquadEventCookie(redirect, squadSnapshotEvent);

  return redirect;
}