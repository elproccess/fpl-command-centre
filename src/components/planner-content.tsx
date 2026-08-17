"use client";

import Image from "next/image";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { PlayerVisual, TeamShirtImage } from "@/components/player-visual";
import { getPlayerImageUrl } from "@/lib/player-images";
import { StillComputingPanel } from "@/components/polled-analysis";
import { ErrorState } from "@/components/states";
import { ApiRequestError, adaptPlannerRoute, emptyPlannerRoute, getAnalysisStatus, getMarketBoard, getSquadPlayerProjections, planMultiGw } from "@/lib/api";
import type { ConfidenceBand, MultiGwPlanner, PlannerRoute, PlannerStep, Player, RiskLevel, RiskProfile } from "@/lib/types";

const PLANNER_STATUS_LABEL: Record<string, string> = {
  fixture_calendar_stale: "Fixture calendar is stale",
  new_season_fixtures_missing: "New season fixtures not loaded yet",
  season_complete: "Requested gameweek is beyond the loaded season",
};

// Poll /analysis/status (lightweight - reads a cached row, does not recompute) fast enough to
// actually show GW1 as soon as the backend has it, and keep filling in GW2-5 as each one
// finishes, instead of lagging behind real backend progress. Found live: the old 5s/10s/20s/30s
// initial backoff plus a 30s steady-state interval was tuned for a backend job that took
// ~70s+; after cutting real DB round-trips per plan from 208 to ~50 (see the backend's
// decision_centre.py/squad_health.py/scenario_simulator.py fixes), GW1 is typically ready by
// ~13-15s and each subsequent gameweek step lands roughly a second apart - the old delays meant
// a user could be looking at a bare spinner for 30-65s after the backend already had GW1 ready,
// then watching a stale streaming snapshot for up to 30s after later gameweeks had already
// finished. This is a status-only poll (no heavy recompute triggered), so a short, near-constant
// cadence here costs one cheap read per tick, not another full plan computation.
const PLANNER_INITIAL_STATUS_DELAYS_MS = [1500, 2000, 2500, 3000] as const;
const PLANNER_VISIBLE_STATUS_INTERVAL_MS = 2000;
const PLANNER_STATUS_ERROR_RETRY_MS = 60000;

type PlannerPollState =
  | { phase: "loading" }
  | { phase: "pending"; elapsedMs: number }
  | { phase: "running"; elapsedMs: number }
  | { phase: "preview"; data: MultiGwPlanner; elapsedMs: number }
  | { phase: "streaming"; data: MultiGwPlanner; elapsedMs: number }
  | { phase: "ready"; data: MultiGwPlanner }
  | { phase: "error"; message: string };

type PlannerVisibleState = Extract<PlannerPollState, { data: MultiGwPlanner }>;

type PlannerDisplayCacheEntry = {
  payloadKey: string;
  identityKey: string;
  savedAt: number;
  state: PlannerVisibleState;
};

// This is deliberately separate from api.ts's short request-deduplication cache. The API cache
// prevents duplicate HTTP calls for a moment; this cache preserves what the user has ALREADY seen
// when Next unmounts /planner and mounts it again. Without it, the hook starts from "loading" on
// every return visit and waits on the still-running full-plan promise even though GW1 was already
// available before the user left the tab.
const PLANNER_DISPLAY_CACHE_TTL_MS = 3 * 60 * 60 * 1000;
const PLANNER_DISPLAY_CACHE_VERSION = "v2";
const plannerDisplayMemoryCache = new Map<string, PlannerDisplayCacheEntry>();
const plannerDisplayIdentityMemoryCache = new Map<string, PlannerDisplayCacheEntry>();
// Survives ordinary Next route unmount/remounts. It prevents leaving Planner and immediately
// returning from causing a fresh status request when one was made only moments ago.
const plannerLastStatusCheckAt = new Map<string, number>();

// On a server render this falls back to useEffect. During client-side navigation it becomes a
// layout effect, allowing a sessionStorage snapshot to replace the temporary loading state before
// the browser paints it. This removes the return-navigation flash without creating a hydration
// mismatch on a genuine hard refresh.
const usePlannerRestoreEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

function stablePlannerPayloadKey(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stablePlannerPayloadKey).join(",")}]`;
  if (isRecord(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stablePlannerPayloadKey(value[key])}`)
      .join(",")}}`;
  }
  if (value === undefined) return '"__undefined__"';
  return JSON.stringify(value) ?? "null";
}

function plannerSquadIdentity(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value
    .filter(isRecord)
    .map((pick) => ({
      player_id: Number(pick.player_id ?? pick.element ?? pick.id ?? 0),
      multiplier: Number(pick.multiplier ?? 0),
      is_captain: pick.is_captain === true,
      is_vice_captain: pick.is_vice_captain === true,
    }))
    .filter((pick) => Number.isFinite(pick.player_id) && pick.player_id > 0)
    // A background re-import can return the same squad in a different array order. The planner
    // result is still the same request, so ordering must not invalidate the already-visible GW1.
    .sort((left, right) => left.player_id - right.player_id);
}

function plannerIdentityKey(payload: Record<string, unknown>): string {
  return stablePlannerPayloadKey({
    entry_id: payload.entry_id ?? payload.team_id ?? null,
    start_gw: payload.start_gw ?? payload.gameweek ?? null,
    horizon: payload.horizon ?? null,
    risk_profile: payload.risk_profile ?? null,
    bank: payload.bank ?? null,
    free_transfers: payload.free_transfers ?? null,
    max_hits: payload.max_hits ?? null,
    squad: plannerSquadIdentity(payload.squad),
  });
}

function hashedPlannerStorageKey(version: string, value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `planner-display:${version}:${(hash >>> 0).toString(16)}`;
}

function plannerStorageKey(identityKey: string) {
  // FNV-1a keeps the sessionStorage key small even though the normalized planner identity still
  // contains all 15 squad IDs and roles. The full identity is stored in the value and checked on
  // read, so a hash collision cannot return another team's planner result.
  return hashedPlannerStorageKey(PLANNER_DISPLAY_CACHE_VERSION, identityKey);
}

function legacyPlannerStorageKey(payloadKey: string) {
  return hashedPlannerStorageKey("v1", payloadKey);
}

function isPlannerVisibleState(value: unknown): value is PlannerVisibleState {
  if (!isRecord(value) || !isRecord(value.data)) return false;
  return value.phase === "preview" || value.phase === "streaming" || value.phase === "ready";
}

function isFreshPlannerCacheEntry(entry: PlannerDisplayCacheEntry, identityKey: string) {
  return entry.identityKey === identityKey && Date.now() - entry.savedAt <= PLANNER_DISPLAY_CACHE_TTL_MS;
}

function rememberPlannerCacheEntry(entry: PlannerDisplayCacheEntry) {
  plannerDisplayMemoryCache.set(entry.payloadKey, entry);
  plannerDisplayIdentityMemoryCache.set(entry.identityKey, entry);
}

function forgetPlannerCacheEntry(entry: PlannerDisplayCacheEntry) {
  if (plannerDisplayMemoryCache.get(entry.payloadKey) === entry) {
    plannerDisplayMemoryCache.delete(entry.payloadKey);
  }
  if (plannerDisplayIdentityMemoryCache.get(entry.identityKey) === entry) {
    plannerDisplayIdentityMemoryCache.delete(entry.identityKey);
  }
}

function readPlannerMemoryCache(payloadKey: string, identityKey: string): PlannerVisibleState | null {
  const exactEntry = plannerDisplayMemoryCache.get(payloadKey);
  if (exactEntry) {
    if (isFreshPlannerCacheEntry(exactEntry, identityKey)) return exactEntry.state;
    forgetPlannerCacheEntry(exactEntry);
  }

  // The exact raw payload can change after another tab refreshes the imported squad snapshot.
  // Fall back to the normalized identity so the same entry/GW/squad keeps the already-rendered
  // planner instead of showing a loader while the same backend job is still running.
  const identityEntry = plannerDisplayIdentityMemoryCache.get(identityKey);
  if (!identityEntry) return null;
  if (!isFreshPlannerCacheEntry(identityEntry, identityKey)) {
    forgetPlannerCacheEntry(identityEntry);
    return null;
  }

  const aliasedEntry = { ...identityEntry, payloadKey };
  rememberPlannerCacheEntry(aliasedEntry);
  return aliasedEntry.state;
}

function readPlannerDisplayCache(payloadKey: string, identityKey: string): PlannerVisibleState | null {
  const memoryState = readPlannerMemoryCache(payloadKey, identityKey);
  if (memoryState) return memoryState;

  if (typeof window === "undefined") return null;

  const storageKey = plannerStorageKey(identityKey);
  const legacyStorageKey = legacyPlannerStorageKey(payloadKey);
  try {
    let raw = window.sessionStorage.getItem(storageKey);
    let legacy = false;
    if (!raw) {
      raw = window.sessionStorage.getItem(legacyStorageKey);
      legacy = Boolean(raw);
    }
    if (!raw) return null;

    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed) || typeof parsed.payloadKey !== "string" || typeof parsed.savedAt !== "number" || !isPlannerVisibleState(parsed.state)) {
      window.sessionStorage.removeItem(legacy ? legacyStorageKey : storageKey);
      return null;
    }

    const parsedIdentityKey = typeof parsed.identityKey === "string" ? parsed.identityKey : identityKey;
    if ((!legacy && parsedIdentityKey !== identityKey) || (legacy && parsed.payloadKey !== payloadKey)) {
      window.sessionStorage.removeItem(legacy ? legacyStorageKey : storageKey);
      return null;
    }

    const entry: PlannerDisplayCacheEntry = {
      payloadKey,
      identityKey: parsedIdentityKey,
      savedAt: parsed.savedAt,
      state: parsed.state,
    };
    if (!isFreshPlannerCacheEntry(entry, identityKey)) {
      window.sessionStorage.removeItem(legacy ? legacyStorageKey : storageKey);
      return null;
    }

    rememberPlannerCacheEntry(entry);
    if (legacy) {
      // Keep an already-visible GW1 working across this cache-key upgrade rather than forcing one
      // final blocking reload immediately after deployment.
      window.sessionStorage.setItem(storageKey, JSON.stringify(entry));
      window.sessionStorage.removeItem(legacyStorageKey);
    }
    return entry.state;
  } catch {
    // Storage can be disabled/full in private browsing. The in-memory route cache still works.
    return null;
  }
}

function writePlannerDisplayCache(payloadKey: string, identityKey: string, state: PlannerVisibleState) {
  const entry: PlannerDisplayCacheEntry = { payloadKey, identityKey, savedAt: Date.now(), state };
  rememberPlannerCacheEntry(entry);

  // Streaming snapshots (GW1 done, others still computing) persist to sessionStorage too. A phone
  // browser may reclaim a backgrounded page and recreate the route module; this local snapshot
  // still restores the completed gameweeks immediately, with no backend/network request required.
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(plannerStorageKey(identityKey), JSON.stringify(entry));
  } catch {
    // A storage failure must never stop planner rendering or polling.
  }
}

// One real gameweek's worth of "still calculating" state - every field is a neutral placeholder,
// never real data. Renderers MUST check __pending before trusting anything else on a step/route.
function pendingStep(gw: number): PlannerStep {
  return {
    gw: `GW${gw}`,
    headline: "Calculating...",
    action: "Calculating...",
    projected_points: null,
    risk: "Medium",
    __pending: true,
  };
}

function pendingRoute(id: string): PlannerRoute {
  return {
    ...emptyPlannerRoute(),
    id,
    title: "Calculating route...",
    __pending: true,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

// A partial snapshot with is_partial=true but zero real progress (the backend now emits this
// immediately, before the expensive setup work even starts, purely so the frontend knows the
// gameweek shape early - see multi_gw_planner.py's own comment on why) is not worth switching
// the UI into the multi-card streaming skeleton for. Found live: doing so replaced a single
// "still working" spinner with 5 cards that all read "Calculating..." and then visibly sat
// frozen for the entire ~20s setup window before any of them filled in - reading as MORE broken
// than the one spinner it replaced, not less. Only treat a snapshot as streamable once it
// actually contains a completed step or alternative; otherwise keep showing the plain running
// state even though is_partial is technically true.
function hasRealPlannerProgress(partial: Record<string, unknown>): boolean {
  const recommendedPartial = partial.recommended_route_partial;
  const steps = isRecord(recommendedPartial) && Array.isArray(recommendedPartial.steps) ? recommendedPartial.steps : [];
  const completedAlternatives = Array.isArray(partial.alternative_routes_completed) ? partial.alternative_routes_completed : [];
  return steps.length > 0 || completedAlternatives.length > 0;
}

// Builds a full MultiGwPlanner-shaped object out of the backend's real, growing partial-progress
// snapshot (see multi_gw_planner.py's plan_multi_gw on_progress / _build_candidate_routes
// docstring) - not an estimate, the genuine data computed so far, reusing adaptPlannerRoute (the
// same function the final, fully-loaded response goes through) for every real piece. Gameweeks
// and alternative slots that haven't finished yet are filled with pendingStep/pendingRoute
// placeholders so every existing rendering component (GameweekHorizon, PlannerTimeline, route
// cards, etc.) can keep iterating over fixed-length arrays unchanged - only the leaf components
// that render an individual step/route need to check __pending.
function buildStreamingPlanner(
  partial: Record<string, unknown>,
  requestPayload: Record<string, unknown>,
  seenAlternatives: Map<string, PlannerRoute>,
): MultiGwPlanner {
  const gameweeks = Array.isArray(partial.gameweeks) ? partial.gameweeks.filter((gw): gw is number => typeof gw === "number") : [];
  const recommendedPartial = isRecord(partial.recommended_route_partial) ? partial.recommended_route_partial : {};
  const realSteps = Array.isArray(recommendedPartial.steps) ? recommendedPartial.steps : [];
  const recommendedDone = recommendedPartial.done === true && isRecord(recommendedPartial.route);

  const recommendedRaw = recommendedDone
    ? recommendedPartial.route
    : {
        route_id: typeof recommendedPartial.route_id === "string" ? recommendedPartial.route_id : "recommended_streaming",
        summary: "Calculating full route...",
        gameweek_steps: realSteps,
        route_type: "balanced",
        risk_score: 50,
        confidence: 55,
        total_projected_points: realSteps.reduce((sum: number, step: unknown) => sum + (isRecord(step) && typeof step.projected_points_after === "number" ? step.projected_points_after : 0), 0),
        net_projected_gain: 0,
        hit_cost: 0,
        transfer_cost: 0,
        future_consequence_notes: [],
        squad_validity: { is_valid: true, issues: [] },
      };
  const recommended = adaptPlannerRoute(recommendedRaw, emptyPlannerRoute());
  // Real steps already streamed keep their real data (via adaptPlannerRoute above) - only pad the
  // TAIL with placeholders for gameweeks that haven't computed yet, using the real GW numbers so
  // a placeholder card reads "GW4: calculating..." rather than a generic, unlabeled spinner.
  const paddedSteps = gameweeks.map((gw, index) => recommended.steps[index] ?? pendingStep(gw));
  const recommendedWithPlaceholders: PlannerRoute = { ...recommended, steps: paddedSteps.length ? paddedSteps : recommended.steps };

  // Accumulate into seenAlternatives rather than trusting this one poll's list in isolation - a
  // route the user has already seen marked "completed" must never visibly disappear on a later
  // poll, even if some transient hiccup (a slow/out-of-order response, a server-side reclaim)
  // ever made a single snapshot report fewer completed routes than a previous one did. Keyed by
  // the adapted route's own id, seeded by the caller from any prior cached streaming snapshot
  // (see usePlannerAnalysis) so a remount never loses alternatives already shown as complete.
  const completedAlternatives = Array.isArray(partial.alternative_routes_completed) ? partial.alternative_routes_completed : [];
  for (const raw of completedAlternatives) {
    if (!isRecord(raw)) continue;
    const adapted = adaptPlannerRoute(raw, emptyPlannerRoute());
    const routeId = adapted.id || (typeof raw.route_id === "string" ? raw.route_id : null);
    if (routeId && !seenAlternatives.has(routeId)) seenAlternatives.set(routeId, { ...adapted, id: routeId });
  }
  const allSeenAlternatives = Array.from(seenAlternatives.values());
  const totalExpected = typeof partial.alternative_routes_total_expected === "number" ? partial.alternative_routes_total_expected : allSeenAlternatives.length;
  const alternativeRoutes: PlannerRoute[] = [
    ...allSeenAlternatives,
    ...Array.from({ length: Math.max(0, totalExpected - allSeenAlternatives.length) }, (_, index) => pendingRoute(`alt-pending-${index}`)),
  ];

  const startGw = typeof requestPayload.start_gw === "number" ? requestPayload.start_gw : Number(requestPayload.start_gw) || 1;
  const requestedHorizon = typeof requestPayload.horizon === "number" ? requestPayload.horizon : Number(requestPayload.horizon) || 5;
  const bank = typeof requestPayload.bank === "number" ? requestPayload.bank : Number(requestPayload.bank) || 0;
  const freeTransfers = typeof requestPayload.free_transfers === "number" ? requestPayload.free_transfers : Number(requestPayload.free_transfers) || 1;
  const riskProfileRaw = typeof requestPayload.risk_profile === "string" ? requestPayload.risk_profile : "balanced";
  const riskProfile = (riskProfileRaw.charAt(0).toUpperCase() + riskProfileRaw.slice(1)) as RiskProfile;

  return {
    status: "ok",
    horizon: gameweeks.length || requestedHorizon,
    horizon_requested: requestedHorizon,
    horizon_clamped: false,
    horizon_clamp_reason: null,
    current_gameweek: startGw,
    max_fixture_gameweek: null,
    fixture_calendar_available: true,
    fixture_calendar_stale: false,
    season_status: null,
    fixture_season: null,
    risk_profile: riskProfile,
    bank,
    free_transfers: freeTransfers,
    recommended_route: recommendedWithPlaceholders,
    alternative_routes: alternativeRoutes,
    locked_pro_preview: emptyPlannerRoute(),
    // Not read anywhere in this component (see /pricing's own separate usageState) - a neutral
    // permissive placeholder for the transient streaming render only.
    usage: {
      current_tier: "Pro",
      scenario_checks_used: 0,
      scenario_checks_limit: 0,
      market_signal_limit: 0,
      has_full_market: true,
      has_full_planner: true,
      has_transfer_comparisons: true,
      has_saved_plans: true,
      has_full_command_centre: true,
    },
  };
}

function usePlannerAnalysis(payload: Record<string, unknown>): PlannerPollState {
  const payloadKey = stablePlannerPayloadKey(payload);
  const identityKey = plannerIdentityKey(payload);
  // Memory-only here avoids a server/client hydration mismatch on a hard refresh. Client-side
  // route returns still restore synchronously because this module remains loaded between routes;
  // sessionStorage rehydration happens in the effect immediately after a genuine page refresh.
  const [state, setState] = useState<PlannerPollState>(() => readPlannerMemoryCache(payloadKey, identityKey) ?? { phase: "loading" });
  const startedAtRef = useRef<number | null>(null);

  usePlannerRestoreEffect(() => {
    let cancelled = false;
    let statusTimer: ReturnType<typeof setTimeout> | null = null;
    let initialStatusAttempt = 0;
    let planRequestStarted = false;
    const cachedState = readPlannerDisplayCache(payloadKey, identityKey);

    // Restore the exact visible planner snapshot before paint. Returning to /planner therefore
    // never regresses to the full-page loader while the remaining gameweeks are still computing.
    setState(cachedState ?? { phase: "loading" });

    startedAtRef.current = Date.now();
    const elapsedMs = () => Date.now() - (startedAtRef.current ?? Date.now());
    const entryIdValue = payload.entry_id ?? payload.team_id;
    const entryId = entryIdValue == null ? null : String(entryIdValue);
    const gameweekValue = payload.start_gw;
    const gameweek = typeof gameweekValue === "number" ? gameweekValue : Number(gameweekValue);
    const statusGameweek = Number.isFinite(gameweek) ? gameweek : undefined;

    let settled = cachedState?.phase === "ready";
    let previewShown = cachedState?.phase === "preview";
    let streamingShown = cachedState?.phase === "streaming";
    const seenAlternatives = new Map<string, PlannerRoute>(
      (cachedState?.phase === "streaming" ? cachedState.data.alternative_routes : [])
        .filter((route) => !route.__pending)
        .map((route) => [route.id, route]),
    );

    function hasUsablePlannerOnScreen() {
      return previewShown || streamingShown;
    }

    function publishState(nextState: PlannerPollState) {
      if (cancelled) return;
      if (isPlannerVisibleState(nextState)) writePlannerDisplayCache(payloadKey, identityKey, nextState);
      setState(nextState);
    }

    function applyRunningState() {
      // Never cover a restored/streamed GW1 with a spinner merely because later gameweeks remain
      // unfinished. The visible snapshot stays interactive until a newer snapshot replaces it.
      if (settled || hasUsablePlannerOnScreen()) return;
      publishState({ phase: "running", elapsedMs: elapsedMs() });
    }

    function applyStreamingState(partial: Record<string, unknown>) {
      if (settled) return;
      streamingShown = true;
      publishState({ phase: "streaming", data: buildStreamingPlanner(partial, payload, seenAlternatives), elapsedMs: elapsedMs() });
    }

    function clearStatusTimer() {
      if (!statusTimer) return;
      clearTimeout(statusTimer);
      statusTimer = null;
    }

    function nextStatusDelay() {
      if (hasUsablePlannerOnScreen()) return PLANNER_VISIBLE_STATUS_INTERVAL_MS;
      const delay = PLANNER_INITIAL_STATUS_DELAYS_MS[Math.min(initialStatusAttempt, PLANNER_INITIAL_STATUS_DELAYS_MS.length - 1)];
      initialStatusAttempt += 1;
      return delay;
    }

    function scheduleStatusPoll(delayMs?: number) {
      if (cancelled || settled || !entryId || statusTimer) return;
      // Background browser tabs must not keep opening DB sessions. The visibility handler below
      // resumes one conservatively delayed check when the user actually returns.
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      const resolvedDelayMs = delayMs ?? nextStatusDelay();
      statusTimer = setTimeout(() => {
        statusTimer = null;
        void pollFullStatus();
      }, resolvedDelayMs);
    }

    async function fetchCompletedFullPlan() {
      if (cancelled || settled) return;
      planRequestStarted = true;
      try {
        const result = await planMultiGw(payload);
        if (cancelled || settled) return;
        if (result.analysisStatus === "pending" || result.analysisStatus === "running") {
          // A return-navigation restart hits this exact branch again (see the caller: no cached
          // preview/streaming state yet means this is treated as a fresh request even though a
          // background job may already be well underway). Without reading result.partial here,
          // this always regressed to a bare spinner - discarding the real per-gameweek progress
          // the backend already attached to this response - until the whole route finished.
          if (result.partial && result.partial.is_partial && hasRealPlannerProgress(result.partial)) {
            applyStreamingState(result.partial);
          } else {
            applyRunningState();
          }
          scheduleStatusPoll();
          return;
        }
        settled = true;
        clearStatusTimer();
        publishState({ phase: "ready", data: result.data });
      } catch (error) {
        if (cancelled || settled) return;
        // A genuine backend-reported failure (analysis_cache row status="failed") is permanent -
        // found live: this used to fall into the same bucket as a plain network/timeout blip
        // below, which retried forever showing "still computing" for a job the backend had
        // already given up on and would never finish. Surface it as an actual error instead.
        if (error instanceof ApiRequestError && error.analysisFailed) {
          settled = true;
          clearStatusTimer();
          publishState({ phase: "error", message: error.message });
          return;
        }
        // The real backend job can outlive this individual HTTP request. Do not turn a temporary
        // timeout into a blocking error and do not retry the heavy /plan endpoint repeatedly.
        applyRunningState();
        scheduleStatusPoll(PLANNER_STATUS_ERROR_RETRY_MS);
      }
    }

    async function pollFullStatus() {
      if (cancelled || settled || !entryId) return;
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;

      plannerLastStatusCheckAt.set(identityKey, Date.now());
      try {
        const status = await getAnalysisStatus(entryId, statusGameweek);
        if (cancelled || settled) return;
        const plannerStatus = status.data.analysis.planner;

        if (plannerStatus?.status === "completed") {
          await fetchCompletedFullPlan();
          return;
        }
        if (plannerStatus?.status === "failed") {
          settled = true;
          clearStatusTimer();
          publishState({ phase: "error", message: plannerStatus.error_message ?? "Planner job failed." });
          return;
        }

        const partial = plannerStatus?.payload;
        if (partial && isRecord(partial) && partial.is_partial && hasRealPlannerProgress(partial)) {
          applyStreamingState(partial);
        } else {
          applyRunningState();
        }

        // A restored snapshot can theoretically outlive a server restart/cache cleanup. Only in
        // the explicit no-job case do we kick the real planner endpoint once; pending/running jobs
        // are never restarted and the separate preview endpoint is never called at all.
        if ((!plannerStatus || plannerStatus.status === "not_scheduled") && !planRequestStarted) {
          void fetchCompletedFullPlan();
        }
        scheduleStatusPoll();
      } catch {
        if (cancelled || settled) return;
        // Status failures back off to one request per minute. Existing GW1 remains visible.
        applyRunningState();
        scheduleStatusPoll(PLANNER_STATUS_ERROR_RETRY_MS);
      }
    }

    function handleVisibilityChange() {
      if (cancelled || settled || typeof document === "undefined") return;
      if (document.visibilityState === "hidden") {
        clearStatusTimer();
        return;
      }

      const minimumGap = hasUsablePlannerOnScreen()
        ? PLANNER_VISIBLE_STATUS_INTERVAL_MS
        : PLANNER_INITIAL_STATUS_DELAYS_MS[0];
      const lastCheckedAt = plannerLastStatusCheckAt.get(identityKey) ?? Date.now();
      const remainingDelay = Math.max(1000, minimumGap - (Date.now() - lastCheckedAt));
      scheduleStatusPoll(remainingDelay);
    }

    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", handleVisibilityChange);
    }

    if (!settled) {
      if (cachedState) {
        // Return navigation: show cached GW1 now and do not touch the DB immediately. The first
        // lightweight status check is delayed for a full visible interval.
        const lastCheckedAt = plannerLastStatusCheckAt.get(identityKey);
        const elapsedSinceCheck = lastCheckedAt == null ? 0 : Date.now() - lastCheckedAt;
        scheduleStatusPoll(Math.max(1000, PLANNER_VISIBLE_STATUS_INTERVAL_MS - elapsedSinceCheck));
      } else {
        // Cold visit: start exactly one real planner request. Status polling runs independently so
        // partial GW1 can still stream if that request remains open during the heavy computation.
        void fetchCompletedFullPlan();
        scheduleStatusPoll(PLANNER_INITIAL_STATUS_DELAYS_MS[0]);
      }
    }

    return () => {
      cancelled = true;
      clearStatusTimer();
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", handleVisibilityChange);
      }
    };
  }, [payloadKey, identityKey]); // eslint-disable-line react-hooks/exhaustive-deps

  return state;
}

function formatPoints(value: number | null | undefined, digits = 1) {
  if (value == null || !Number.isFinite(value)) return "—";
  return value.toFixed(digits);
}

function formatSignedPoints(value: number | null | undefined, digits = 1) {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value > 0 ? "+" : ""}${value.toFixed(digits)}`;
}

function confidencePercent(value: ConfidenceBand) {
  if (value === "High") return 84;
  if (value === "Medium") return 64;
  return 44;
}

function riskTextClass(value: RiskLevel) {
  if (value === "Low") return "text-[var(--success)]";
  if (value === "Medium") return "text-[var(--warning)]";
  return "text-[var(--danger)]";
}

function riskSurfaceClass(value: RiskLevel) {
  if (value === "Low") return "border-[var(--success-border)] bg-[var(--success-soft)] text-[var(--success)]";
  if (value === "Medium") return "border-[var(--warning-border)] bg-[var(--warning-soft)] text-[var(--warning)]";
  return "border-[var(--danger-border)] bg-[var(--danger-soft)] text-[var(--danger)]";
}

function actionLabel(action: string) {
  const normalized = action.trim().toLowerCase();
  if (normalized === "multiple_transfers") return "Multiple transfers";
  if (normalized === "transfer") return "Transfer";
  if (normalized === "roll") return "Roll transfer";
  if (normalized === "hold") return "Hold";
  return action || "Hold";
}

function actionSurfaceClass(action: string) {
  const normalized = action.trim().toLowerCase();
  if (normalized === "transfer" || normalized === "multiple_transfers") return "border-[var(--accent-border)] bg-[var(--accent-soft)] text-[var(--accent)]";
  if (normalized === "roll") return "border-[var(--info-border)] bg-[var(--info-soft)] text-[var(--info)]";
  return "border-[var(--border)] bg-[var(--surface-3)] text-[var(--muted)]";
}

function parseFixture(step: PlannerStep) {
  const raw = step.fixture ?? "TBC";
  const venueMatch = raw.match(/\(([HA])\)/i);
  const venue = venueMatch?.[1]?.toUpperCase() ?? "";
  const opponent = raw
    .replace(/^vs\s+/i, "")
    .replace(/\([HA]\)/gi, "")
    .replace(/[^A-Za-z0-9&' .-]/g, "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .join(" ") || "TBC";
  return { opponent, venue };
}

function totalRouteTransfers(route: PlannerRoute) {
  return route.steps.reduce((total, step) => total + Math.max(step.transfers_in?.length ?? 0, step.transfers_out?.length ?? 0), 0);
}

function completedSteps(route: PlannerRoute) {
  return route.steps.filter((step) => !step.__pending).length;
}

function firstRouteReason(route: PlannerRoute) {
  return route.why[0] ?? route.steps.find((step) => step.reasoning?.length)?.reasoning?.[0] ?? "A balanced route selected from the available multi-gameweek scenarios.";
}

function routeActionSummary(step: PlannerStep) {
  if (step.__pending) return "Calculating";
  const incoming = step.transfers_in ?? [];
  const outgoing = step.transfers_out ?? [];
  if (incoming.length || outgoing.length) {
    const pairs = Array.from({ length: Math.max(incoming.length, outgoing.length) }, (_, index) => {
      const outName = outgoing[index]?.name ?? "TBC";
      const inName = incoming[index]?.name ?? "TBC";
      return `${outName} → ${inName}`;
    });
    return pairs.join(" · ");
  }
  return actionLabel(step.action);
}

function PlannerUnavailablePanel({ planner }: { planner: MultiGwPlanner }) {
  return (
    <section className="overflow-hidden rounded-[26px] border border-[var(--border)] bg-[var(--surface)] shadow-[0_24px_70px_rgba(15,23,60,0.08)]">
      <div className="border-b border-[var(--border-soft)] bg-[var(--warning-soft)] px-6 py-5 sm:px-8">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--warning)]">Planner unavailable</p>
        <h2 className="mt-2 text-3xl font-black tracking-[-0.03em] text-[var(--ink)] sm:text-4xl">
          {PLANNER_STATUS_LABEL[planner.status] ?? "A plan could not be calculated"}
        </h2>
        <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-[var(--ink-soft)]">
          {planner.horizon_clamp_reason ?? "The planner could not build a legal route from the currently loaded fixture calendar."}
        </p>
      </div>
      <div className="grid gap-px bg-[var(--border-soft)] sm:grid-cols-2 xl:grid-cols-4">
        <PlannerFact label="Fixture season" value={planner.fixture_season ?? "Unknown"} />
        <PlannerFact label="Max fixture GW" value={planner.max_fixture_gameweek ?? "—"} />
        <PlannerFact label="Season status" value={planner.season_status ?? "Unknown"} />
        <PlannerFact label="Calendar" value={planner.fixture_calendar_stale ? "Stale" : planner.fixture_calendar_available ? "Available" : "Missing"} />
      </div>
    </section>
  );
}

function PlannerFact({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-[var(--surface)] px-6 py-5">
      <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[var(--muted)]">{label}</p>
      <p className="mt-2 text-xl font-black text-[var(--ink)]">{value}</p>
    </div>
  );
}

function PhaseBanner({ phase, elapsedMs }: { phase: PlannerPollState["phase"]; elapsedMs?: number }) {
  if (phase === "ready") return null;
  // The route currently labeled "recommended" while streaming is only the top pick by a cheap
  // preliminary score (see multi_gw_planner.py's _build_candidate_routes docstring) - once every
  // alternative finishes building and gets ranked by the real planner_score, a different route can
  // legitimately overtake it, changing the recommendation (and its risk/points) out from under
  // someone reading it as final. Found live: this happened for real, with no warning shown at the
  // time, which reads as the number just being wrong rather than provisional.
  const copy = phase === "preview" ? "Showing the fast preview while the full route comparison completes." : "Live gameweek results are arriving as the planner finishes comparing routes - the recommended route below is still provisional and may change once every alternative is scored.";
  return (
    <div className="mb-4 flex flex-col gap-2 rounded-2xl border border-[var(--accent-border)] bg-[var(--accent-soft)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--accent)] opacity-40" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[var(--accent)]" />
        </span>
        <p className="text-sm font-bold text-[var(--ink-soft)]">{copy}</p>
      </div>
      {elapsedMs != null ? <span className="text-xs font-black text-[var(--accent)]">{Math.max(1, Math.round(elapsedMs / 1000))}s elapsed</span> : null}
    </div>
  );
}

function StatusPill({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "green" | "purple" | "amber" | "pink" }) {
  const toneClass = tone === "green"
    ? "border-[var(--success-border)] bg-[var(--success-soft)] text-[var(--success)]"
    : tone === "purple"
      ? "border-[var(--accent-border)] bg-[var(--accent-soft)] text-[var(--accent)]"
      : tone === "amber"
        ? "border-[var(--warning-border)] bg-[var(--warning-soft)] text-[var(--warning)]"
        : tone === "pink"
          ? "border-[var(--danger-border)] bg-[var(--danger-soft)] text-[var(--danger)]"
          : "border-[var(--border)] bg-[var(--surface)] text-[var(--ink-soft)]";
  return (
    <div className={`rounded-xl border px-2 py-2 sm:px-3 ${toneClass}`}>
      <p className="text-[8px] font-black uppercase tracking-[0.08em] opacity-70 sm:text-[10px] sm:tracking-[0.12em]">{label}</p>
      <p className="mt-1 text-xs font-black sm:text-sm">{value}</p>
    </div>
  );
}

function HeroPlayerArtwork({ player, animationKey }: { player: Player; animationKey: string }) {
  const photo = getPlayerImageUrl(player);
  const [mode, setMode] = useState<"photo" | "kit" | "fallback">(photo ? "photo" : "kit");

  useEffect(() => {
    setMode(photo ? "photo" : "kit");
  }, [animationKey, photo]);

  return (
    <div
      key={animationKey}
      className="planner-hero-player-swap pointer-events-none absolute -top-12 right-0 z-20 h-[205px] w-[148px] sm:-top-16 sm:right-6 sm:h-[260px] sm:w-[194px] lg:-top-20 lg:right-10 lg:h-[292px] lg:w-[218px]"
      aria-hidden
    >
      <div className="absolute bottom-4 right-1/2 h-24 w-24 translate-x-1/2 rounded-full bg-[var(--accent)]/10 blur-2xl sm:h-32 sm:w-32" />
      {mode === "photo" && photo ? (
        <Image
          src={photo}
          alt=""
          fill
          priority
          sizes="(max-width: 639px) 148px, (max-width: 1023px) 194px, 218px"
          className="object-contain object-bottom drop-shadow-[0_22px_26px_rgba(23,0,47,0.22)]"
          onError={() => setMode("kit")}
        />
      ) : mode === "kit" ? (
        <div className="absolute bottom-5 right-1/2 grid h-[126px] w-[126px] translate-x-1/2 place-items-center rounded-[30px] border border-[var(--accent-border)] bg-[var(--surface)]/88 p-3 shadow-[0_20px_36px_rgba(55,0,60,0.15)] backdrop-blur sm:h-[158px] sm:w-[158px] sm:p-4 lg:h-[174px] lg:w-[174px]">
          <TeamShirtImage
            team={player.team}
            position={player.position}
            size={110}
            className="h-full w-full object-contain drop-shadow-[0_14px_18px_rgba(23,0,47,0.18)]"
            onError={() => setMode("fallback")}
          />
        </div>
      ) : (
        <div className="absolute bottom-6 right-3 scale-[1.12] sm:bottom-8 sm:right-5 sm:scale-[1.38]">
          <PlayerVisual player={player} size="xl" preferPhoto={false} />
        </div>
      )}
    </div>
  );
}

function PlannerHeader({
  planner,
  route,
  step,
  playerIndex,
  isRecommended,
  provisional,
  onBack,
}: {
  planner: MultiGwPlanner;
  route: PlannerRoute;
  step?: PlannerStep;
  playerIndex: PlannerPlayerIndex;
  isRecommended: boolean;
  // True while phase is "streaming" - this route is only the top pick by preliminary score, not
  // yet the real planner_score-ranked winner (see PhaseBanner's identical comment). Labeling it
  // "Recommended / Best route" with full confidence here is what made the later swap to a
  // different route read as broken rather than as the ranking finishing.
  provisional?: boolean;
  onBack: () => void;
}) {
  const transferCount = totalRouteTransfers(route);
  const activeStep = step && !step.__pending ? step : route.steps.find((candidate) => !candidate.__pending);
  const rawOutgoing = activeStep?.transfers_out?.[0] ?? null;
  const rawIncoming = activeStep?.transfers_in?.[0] ?? null;
  const outgoing = rawOutgoing ? resolvePlannerPlayer(rawOutgoing, playerIndex) : null;
  const incoming = rawIncoming ? resolvePlannerPlayer(rawIncoming, playerIndex) : null;
  const rawCaptain = activeStep?.captain ?? route.steps.find((candidate) => candidate.captain)?.captain ?? null;
  const captain = rawCaptain ? resolvePlannerPlayer(rawCaptain, playerIndex) : null;
  const heroPlayer = incoming ?? captain;
  const heroAnimationKey = `${route.id}-${activeStep?.gw ?? "route"}-${heroPlayer?.id ?? "none"}`;
  const hasTransfer = Boolean(outgoing && incoming);
  const action = activeStep?.action?.toLowerCase() ?? "hold";

  const headlinePrimary = hasTransfer
    ? `Replace ${outgoing?.name}`
    : action === "roll"
      ? "Roll the transfer"
      : action === "hold"
        ? `Hold in ${activeStep?.gw ?? "this gameweek"}`
        : route.title;
  const headlineSecondary = hasTransfer ? `→ ${incoming?.name}` : captain ? `Captain ${captain.name}` : null;
  const support = hasTransfer
    ? `${activeStep?.gw ?? "This gameweek"}: use ${planner.free_transfers > 0 ? "the available free transfer" : "the planned transfer"}.`
    : action === "roll"
      ? `${activeStep?.gw ?? "This gameweek"}: preserve flexibility and carry the transfer forward.`
      : `${activeStep?.gw ?? "This gameweek"}: keep the current squad structure.`;
  const stepGain = activeStep?.net_gain;
  const verdictValue = stepGain != null && Number.isFinite(stepGain) ? stepGain : route.expected_gain;
  const verdict = verdictValue > 0.5
    ? "The model finds a clear points edge."
    : verdictValue < -0.5
      ? "The route accepts a short-term cost for the wider plan."
      : "The decision remains close to the roll baseline.";

  return (
    <section className="mt-12 sm:mt-16">
      <div className="relative overflow-visible rounded-[22px] border border-[var(--accent-border)] bg-[linear-gradient(135deg,var(--surface)_0%,var(--surface-2)_58%,var(--accent-soft)_100%)] shadow-[0_24px_70px_rgba(55,0,60,0.10)] sm:rounded-[28px]">
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]">
          <div className="absolute -right-20 -top-28 h-72 w-72 rounded-full bg-[var(--accent)]/[0.08] blur-3xl" />
          <div className="absolute left-[43%] top-12 h-24 w-24 rotate-12 border-r-[18px] border-t-[18px] border-[var(--accent)]/[0.045]" />
          <div className="absolute right-5 top-6 text-[58px] font-black leading-none text-[var(--ink)]/[0.07] sm:right-9 sm:text-[76px]">FPL</div>
        </div>

        {heroPlayer ? <HeroPlayerArtwork player={heroPlayer} animationKey={heroAnimationKey} /> : null}

        <div className="relative z-10 min-h-[212px] px-4 pb-[104px] pt-5 pr-[142px] sm:min-h-[250px] sm:px-7 sm:pb-[112px] sm:pt-7 sm:pr-[224px] lg:px-9 lg:pr-[270px]">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[var(--accent)] px-3 py-1 text-[9px] font-black uppercase tracking-[0.13em] text-white shadow-[0_8px_18px_rgba(108,29,255,0.20)] sm:text-[10px]">
              {isRecommended ? (provisional ? "Leading candidate" : "Recommended") : "Selected route"}
            </span>
            <span className={`rounded-full border px-3 py-1 text-[9px] font-black uppercase tracking-[0.13em] sm:text-[10px] ${isRecommended && provisional ? "border-[var(--warning-border)] bg-[var(--warning-soft)] text-[var(--warning)]" : "border-[var(--success-border)] bg-[var(--success-soft)] text-[var(--success)]"}`}>
              {isRecommended ? (provisional ? "Still comparing" : "Best route") : route.route_type}
            </span>
            {activeStep?.gw ? (
              <span className="rounded-full border border-[var(--accent-border)] bg-[var(--surface)]/90 px-3 py-1 text-[9px] font-black uppercase tracking-[0.11em] text-[var(--accent)] sm:text-[10px]">
                {activeStep.gw}
              </span>
            ) : null}
            {!isRecommended ? (
              <button
                type="button"
                onClick={onBack}
                className="rounded-full border border-[var(--accent-border)] bg-[var(--surface)]/90 px-3 py-1 text-[9px] font-black uppercase tracking-[0.11em] text-[var(--accent)] transition hover:bg-[var(--accent-soft)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-2)] sm:text-[10px]"
              >
                Reset
              </button>
            ) : null}
          </div>

          <div key={`${heroAnimationKey}-copy`} className="planner-hero-copy-swap">
            <h1 className="mt-4 max-w-[14rem] text-[1.44rem] font-black leading-[1.07] tracking-[-0.045em] text-[var(--ink)] sm:max-w-xl sm:text-4xl lg:text-[2.55rem]">
              <span className="block">{headlinePrimary}</span>
              {headlineSecondary ? <span className="mt-1 block text-[var(--accent)]">{headlineSecondary}</span> : null}
            </h1>
            <p className="mt-3 max-w-[14rem] text-[11px] font-semibold leading-5 text-[var(--ink-soft)] sm:max-w-xl sm:text-sm sm:leading-6">
              {support}
              <span className="block">{verdict}</span>
            </p>
          </div>
        </div>

        <div className="absolute inset-x-3 bottom-3 z-30 grid grid-cols-5 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]/95 shadow-[0_12px_32px_rgba(15,23,60,0.08)] backdrop-blur sm:inset-x-6 sm:bottom-5 lg:inset-x-8">
          <HeroMetric label="Projected total" value={`${formatPoints(route.expected_total_points)} pts`} featured />
          <HeroMetric label="Gain vs baseline" value={`${formatSignedPoints(route.expected_gain)} pts`} positive={route.expected_gain >= 0} featured />
          <HeroMetric label="Transfers" value={String(transferCount)} />
          {/* Risk/Confidence are ranking outcomes, not properties of this route alone - a
              different candidate can still overtake this one once every alternative finishes (see
              PhaseBanner's comment). Found live: showing a confident Low/green value here that
              later flipped to High/red read as the platform lying, not as "still computing" -
              blanked instead of shown-then-contradicted while that's still possible. */}
          {isRecommended && provisional ? (
            <>
              <HeroMetric label="Risk" value="—" />
              <HeroMetric label="Confidence" value="—" />
            </>
          ) : (
            <>
              <HeroMetric label="Risk" value={route.risk} risk={route.risk} />
              <HeroMetric label="Confidence" value={route.confidence} />
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function HeroMetric({
  label,
  value,
  featured,
  positive,
  risk,
}: {
  label: string;
  value: string;
  featured?: boolean;
  positive?: boolean;
  risk?: RiskLevel;
}) {
  const valueClass = risk
    ? risk === "Low"
      ? "text-[var(--success)]"
      : risk === "Medium"
        ? "text-[var(--warning)]"
        : "text-[var(--danger)]"
    : positive
      ? "text-[var(--success)]"
      : "text-[var(--ink)]";

  return (
    <div className="min-w-0 border-r border-[var(--border)] px-1.5 py-2.5 last:border-r-0 sm:px-3 sm:py-3">
      <p className="truncate text-[6px] font-black uppercase tracking-[0.05em] text-[var(--muted)] sm:text-[9px] sm:tracking-[0.11em]">{label}</p>
      <p className={`mt-1 truncate font-black tracking-[-0.025em] ${featured ? "text-[11px] sm:text-lg" : "text-[10px] sm:text-base"} ${valueClass}`}>{value}</p>
    </div>
  );
}

function PlannerContextBar({ planner, route }: { planner: MultiGwPlanner; route: PlannerRoute }) {
  const average = route.steps.length ? route.expected_total_points / route.steps.length : 0;
  const mobileFacts = [
    { label: "Profile", value: planner.risk_profile, tone: "text-[var(--accent)]" },
    { label: "Average / GW", value: `${formatPoints(average)} pts`, tone: "text-[var(--ink-soft)]" },
    { label: "Free transfers", value: String(planner.free_transfers), tone: "text-[var(--accent)]" },
    { label: "Bank", value: `£${planner.bank.toFixed(1)}m`, tone: "text-[var(--ink-soft)]" },
    { label: "Complete", value: `${completedSteps(route)}/${route.steps.length} GWs`, tone: "text-[var(--success)]" },
  ];
  return (
    <>
      <section className="mt-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 shadow-[0_10px_28px_rgba(15,23,60,0.04)] sm:hidden">
        <div className="flex snap-x gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {mobileFacts.map((fact) => (
            <div key={fact.label} className="min-w-[112px] shrink-0 snap-start rounded-xl border border-[var(--border)] bg-[var(--surface-3)] px-3 py-2.5">
              <p className="text-[8px] font-black uppercase tracking-[0.11em] text-[var(--muted)]">{fact.label}</p>
              <p className={`mt-1 text-xs font-black ${fact.tone}`}>{fact.value}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-4 hidden flex-col gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 shadow-[0_12px_32px_rgba(15,23,60,0.045)] sm:flex lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--muted)]">Planning profile</span>
          <span className="rounded-lg border border-[var(--accent-border)] bg-[var(--accent-soft)] px-3 py-1.5 text-xs font-black text-[var(--accent)]">{planner.risk_profile}</span>
          {planner.horizon_clamped ? <span className="rounded-lg border border-[var(--warning-border)] bg-[var(--warning-soft)] px-3 py-1.5 text-xs font-black text-[var(--warning)]">Horizon adjusted</span> : null}
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:flex lg:items-center">
          <StatusPill label="Average / GW" value={`${formatPoints(average)} pts`} />
          <StatusPill label="Free transfers" value={String(planner.free_transfers)} tone="purple" />
          <StatusPill label="Bank" value={`£${planner.bank.toFixed(1)}m`} />
          <StatusPill label="Complete" value={`${completedSteps(route)}/${route.steps.length} GWs`} tone="green" />
        </div>
      </section>
    </>
  );
}

function GameweekCard({ step, index, selected, onSelect, animateSwivel = false }: { step: PlannerStep; index: number; selected: boolean; onSelect: () => void; animateSwivel?: boolean }) {
  const fixture = parseFixture(step);
  if (step.__pending) {
    return (
      <button type="button" onClick={onSelect} className={`gw-placeholder-pulse relative min-h-[148px] rounded-2xl border border-dashed bg-[var(--surface)]/75 p-5 text-center transition focus:outline-none focus:ring-2 focus:ring-[var(--accent-2)] ${animateSwivel ? "planner-gw-swivel" : ""} ${selected ? "border-[var(--accent)]" : "border-[var(--border)] hover:border-[var(--accent-border)]"}`}>
        <p className="text-lg font-black text-[var(--accent)]">{step.gw}</p>
        <span className="mx-auto mt-4 block h-5 w-5 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" aria-hidden />
        <p className="mt-3 text-xs font-black text-[var(--muted)]">Calculating...</p>
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`gw-pop-in relative min-h-[148px] rounded-2xl border bg-[var(--surface)] p-5 text-left transition focus:outline-none focus:ring-2 focus:ring-[var(--accent-2)] ${animateSwivel ? "planner-gw-swivel" : ""} ${selected ? "border-[var(--accent)] shadow-[0_16px_36px_rgba(108,29,255,0.14)] ring-1 ring-[var(--accent)]/10" : "border-[var(--border)] shadow-[0_12px_28px_rgba(15,23,60,0.05)] hover:-translate-y-0.5 hover:border-[var(--accent-border)]"}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-2xl font-black tracking-[-0.03em] text-[var(--accent)]">{step.gw}</p>
          <p className="mt-1 text-xs font-bold text-[var(--muted)]">{fixture.opponent}{fixture.venue ? ` (${fixture.venue})` : ""}</p>
        </div>
        <span className={`rounded-lg border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.1em] ${actionSurfaceClass(step.action)}`}>{actionLabel(step.action)}</span>
      </div>
      <div className="mt-5 grid grid-cols-[0.8fr_1.2fr] items-end gap-4">
        <div>
          <p className="text-2xl font-black text-[var(--ink)]">{formatPoints(step.projected_points)}</p>
          <p className="mt-1 text-[11px] font-bold text-[var(--muted)]">Projected points</p>
        </div>
        <div className="border-l border-[var(--border-soft)] pl-4">
          <p className="mb-2 text-[10px] font-black uppercase tracking-[0.12em] text-[var(--muted)]">Captain</p>
          <PlayerMini player={step.captain} compact />
        </div>
      </div>
      <span className={`absolute -bottom-7 left-1/2 hidden h-6 w-6 -translate-x-1/2 place-items-center rounded-full border-2 2xl:grid ${selected ? "border-[var(--accent)] bg-[var(--accent)]" : "border-[var(--accent-border)] bg-[var(--surface)]"}`}>
        {selected ? <span className="h-2 w-2 rounded-full bg-[var(--surface)]" /> : null}
      </span>
      <span className="sr-only">Timeline position {index + 1}</span>
    </button>
  );
}

function GameweekHorizon({ route, selectedStepIndex, onSelectStep, animateFirstStep = false }: { route: PlannerRoute; selectedStepIndex: number; onSelectStep: (index: number) => void; animateFirstStep?: boolean }) {
  const mobileStepRefs = useRef<Array<HTMLDivElement | null>>([]);
  const desktopStepRefs = useRef<Array<HTMLDivElement | null>>([]);
  const mobileScrollRef = useRef<HTMLDivElement | null>(null);
  const desktopScrollRef = useRef<HTMLDivElement | null>(null);
  const selectedProgress = route.steps.length > 1 ? (selectedStepIndex / (route.steps.length - 1)) * 100 : 0;
  const canGoPrevious = selectedStepIndex > 0;
  const canGoNext = selectedStepIndex < route.steps.length - 1;

  useEffect(() => {
    const scrollIntoView = (container: HTMLDivElement | null, target: HTMLDivElement | null) => {
      if (!container || !target) return;
      const scrollTarget = target.offsetLeft - container.clientWidth / 2 + target.clientWidth / 2;
      container.scrollTo({ left: Math.max(0, scrollTarget), behavior: "smooth" });
    };
    scrollIntoView(mobileScrollRef.current, mobileStepRefs.current[selectedStepIndex]);
    scrollIntoView(desktopScrollRef.current, desktopStepRefs.current[selectedStepIndex]);
  }, [selectedStepIndex]);

  return (
    <>
      <section className="mt-3 rounded-[20px] border border-[var(--border)] bg-[var(--surface)] p-3 shadow-[0_14px_38px_rgba(15,23,60,0.055)] sm:hidden">
        {/* The prev/next controls deliberately do NOT live up here on mobile - they sit in
            MobileGameweekNav, directly above the selected-gameweek workspace, so the content
            that changes on a tap is on screen when it changes. */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[var(--accent)]">Gameweek timeline</p>
            <p className="mt-1 text-sm font-black text-[var(--ink)]">{route.steps[selectedStepIndex]?.gw ?? "GW"} of {route.steps.length}</p>
          </div>
        </div>
        <div className="mt-3 h-1 overflow-hidden rounded-full bg-[var(--border-soft)]">
          <div className="h-full rounded-full bg-[var(--accent)] transition-all duration-300" style={{ width: `${selectedProgress}%` }} />
        </div>
        <div ref={mobileScrollRef} className="mt-3 flex snap-x gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {route.steps.map((step, index) => {
            const selected = selectedStepIndex === index;
            const fixture = parseFixture(step);
            return (
              <div key={`${route.id}-mobile-${step.gw}`} ref={(element: HTMLDivElement | null) => { mobileStepRefs.current[index] = element; }} className="w-[126px] shrink-0 snap-center">
                <button
                  type="button"
                  onClick={() => onSelectStep(index)}
                  aria-pressed={selected}
                  className={`w-full rounded-xl border p-2.5 text-left transition ${animateFirstStep && index === 0 && selected ? "planner-gw-swivel" : ""} ${selected ? "border-[var(--accent)] bg-[var(--accent-soft)] shadow-[0_8px_20px_rgba(108,29,255,0.12)]" : "border-[var(--border)] bg-[var(--surface-3)]"}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-black text-[var(--accent)]">{step.gw}</span>
                    <span className="text-[8px] font-black uppercase tracking-[0.06em] text-[var(--muted)]">{step.__pending ? "Pending" : actionLabel(step.action)}</span>
                  </div>
                  <p className="mt-1 truncate text-[10px] font-bold text-[var(--muted)]">{fixture.opponent}{fixture.venue ? ` (${fixture.venue})` : ""}</p>
                  <div className="mt-2 flex items-end justify-between gap-2">
                    <span className="text-base font-black text-[var(--ink)]">{formatPoints(step.projected_points)}</span>
                    <span className="max-w-[58px] truncate text-[9px] font-bold text-[var(--muted)]">{step.captain?.name ?? "TBC"}</span>
                  </div>
                </button>
              </div>
            );
          })}
        </div>
      </section>

      <section className="mt-5 hidden rounded-[24px] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[0_20px_55px_rgba(15,23,60,0.065)] sm:block sm:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.17em] text-[var(--accent)]">Gameweek timeline</p>
            <h2 className="mt-1 text-xl font-black tracking-[-0.02em] text-[var(--ink)]">Move through the selected route</h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="mr-1 rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-black text-[var(--accent)]">{route.steps[selectedStepIndex]?.gw ?? "GW"} of {route.steps.length}</span>
            <button type="button" onClick={() => onSelectStep(Math.max(0, selectedStepIndex - 1))} disabled={!canGoPrevious} className="grid h-10 w-10 place-items-center rounded-full border border-[var(--accent-border)] bg-[var(--surface)] text-lg font-black text-[var(--accent)] transition hover:bg-[var(--accent-soft)] disabled:cursor-not-allowed disabled:opacity-35" aria-label="Previous gameweek">‹</button>
            <button type="button" onClick={() => onSelectStep(Math.min(route.steps.length - 1, selectedStepIndex + 1))} disabled={!canGoNext} className="grid h-10 w-10 place-items-center rounded-full border border-[var(--accent-border)] bg-[var(--surface)] text-lg font-black text-[var(--accent)] transition hover:bg-[var(--accent-soft)] disabled:cursor-not-allowed disabled:opacity-35" aria-label="Next gameweek">›</button>
          </div>
        </div>
        <div className="relative">
          <div className="absolute left-8 right-8 top-7 h-1 rounded-full bg-[var(--border-soft)]" />
          <div className="absolute left-8 top-7 h-1 rounded-full bg-[var(--accent)] transition-all duration-300" style={{ width: `calc((100% - 4rem) * ${selectedProgress / 100})` }} />
          <div ref={desktopScrollRef} className="relative -mx-2 flex snap-x snap-mandatory gap-5 overflow-x-auto px-2 pb-8 pt-12 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {route.steps.map((step, index) => (
              <div key={`${route.id}-${step.gw}`} ref={(element: HTMLDivElement | null) => { desktopStepRefs.current[index] = element; }} className="relative w-[310px] shrink-0 snap-center lg:w-[300px] xl:w-[320px] 2xl:w-auto 2xl:min-w-0 2xl:flex-1 2xl:shrink">
                <span className={`absolute -top-9 left-1/2 z-10 grid h-8 w-8 -translate-x-1/2 place-items-center rounded-full text-sm font-black shadow-[0_8px_18px_rgba(108,29,255,0.16)] ${selectedStepIndex === index ? "bg-[var(--accent)] text-white" : "bg-[var(--accent-soft)] text-[var(--accent)]"}`}>{index + 1}</span>
                <GameweekCard step={step} index={index} selected={selectedStepIndex === index} onSelect={() => onSelectStep(index)} animateSwivel={animateFirstStep && index === 0 && selectedStepIndex === 0} />
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

// Mobile-only prev/next for the gameweek decision. On a phone the timeline strip's own controls
// sat a full screen above the workspace, so flicking gameweeks changed content the user couldn't
// see - these controls are welded to the top of the workspace instead, so the swap (plus its
// planner-step-in animation) happens directly under the user's thumb.
function MobileGameweekNav({ route, selectedStepIndex, onSelectStep }: { route: PlannerRoute; selectedStepIndex: number; onSelectStep: (index: number) => void }) {
  const step = route.steps[selectedStepIndex];
  const canGoPrevious = selectedStepIndex > 0;
  const canGoNext = selectedStepIndex < route.steps.length - 1;
  return (
    <div className="mt-4 flex items-center justify-between gap-3 rounded-t-[20px] border border-b-0 border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 sm:hidden">
      <button
        type="button"
        onClick={() => onSelectStep(Math.max(0, selectedStepIndex - 1))}
        disabled={!canGoPrevious}
        className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-[var(--accent-border)] bg-[var(--surface)] text-lg font-black text-[var(--accent)] transition active:scale-95 disabled:opacity-30"
        aria-label="Previous gameweek"
      >
        ‹
      </button>
      <div className="min-w-0 text-center">
        <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[var(--accent)]">Gameweek decision</p>
        <p className="truncate text-sm font-black text-[var(--ink)]">
          {step?.gw ?? "GW"} of {route.steps.length}
          {step && !step.__pending ? ` · ${actionLabel(step.action)}` : ""}
        </p>
      </div>
      <button
        type="button"
        onClick={() => onSelectStep(Math.min(route.steps.length - 1, selectedStepIndex + 1))}
        disabled={!canGoNext}
        className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-[var(--accent-border)] bg-[var(--surface)] text-lg font-black text-[var(--accent)] transition active:scale-95 disabled:opacity-30"
        aria-label="Next gameweek"
      >
        ›
      </button>
    </div>
  );
}

function PlayerMini({ player, caption, compact = false }: { player?: Player | null; caption?: string; compact?: boolean }) {
  if (!player) {
    return (
      <div className="flex min-w-0 items-center gap-2.5">
        <span className={`grid shrink-0 place-items-center rounded-xl bg-[var(--surface-3)] text-xs font-black text-[var(--muted)] ${compact ? "h-9 w-9" : "h-11 w-11"}`}>—</span>
        <div className="min-w-0">
          <p className="truncate text-sm font-black text-[var(--ink)]">No player</p>
          <p className="truncate text-[11px] font-bold text-[var(--muted)]">{caption ?? "Not required"}</p>
        </div>
      </div>
    );
  }
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <PlayerVisual player={player} size="sm" />
      <div className="min-w-0">
        <p className="truncate text-sm font-black leading-tight text-[var(--ink)]">{player.name}</p>
        <p className="truncate text-[11px] font-bold text-[var(--muted)]">{caption ?? `${player.team} · ${player.position}`}</p>
      </div>
    </div>
  );
}

function transferPairs(step: PlannerStep) {
  const outgoing = step.transfers_out ?? [];
  const incoming = step.transfers_in ?? [];
  return Array.from({ length: Math.max(outgoing.length, incoming.length) }, (_, index) => ({ out: outgoing[index] ?? null, in: incoming[index] ?? null }));
}


type PlannerPlayerIndex = Map<string, Player>;

function playerIndexKey(player?: Player | null) {
  return player?.id == null ? null : String(player.id);
}

type PlatformPlayerIndex = Map<string, Player>;

function usePlatformPlayerIndex(payload: Record<string, unknown>): PlatformPlayerIndex {
  const [index, setIndex] = useState<PlatformPlayerIndex>(() => new Map());
  const payloadKey = JSON.stringify(payload);

  useEffect(() => {
    let cancelled = false;

    async function loadPlatformPlayers() {
      const [squadResult, marketResult] = await Promise.allSettled([
        getSquadPlayerProjections(payload),
        getMarketBoard({ limit: 100 }),
      ]);
      if (cancelled) return;

      const players: Player[] = [];
      if (squadResult.status === "fulfilled") players.push(...squadResult.value.data);
      if (marketResult.status === "fulfilled") {
        const board = marketResult.value.data;
        const signals = [
          ...board.market_alerts,
          ...board.rising_players,
          ...board.falling_players,
          ...board.owned_squad_alerts,
        ];
        players.push(...signals.map((signal) => signal.player));
      }

      const next: PlatformPlayerIndex = new Map();
      for (const player of players) {
        const key = playerIndexKey(player);
        if (!key) continue;
        const existing = next.get(key);
        next.set(key, existing ? mergePlannerPlayer(player, existing) : player);
      }
      setIndex(next);
    }

    void loadPlatformPlayers();
    return () => {
      cancelled = true;
    };
  }, [payloadKey]); // eslint-disable-line react-hooks/exhaustive-deps

  return index;
}

function playerDataScore(player?: Player | null) {
  if (!player) return -1;
  let score = 0;
  if (player.fixture && player.fixture !== "TBC") score += 5;
  if (Number.isFinite(player.price) && player.price > 0) score += 2;
  if (Number.isFinite(player.projected) && player.projected !== 0) score += 8;
  if (player.three_gw_projected != null && Number.isFinite(player.three_gw_projected) && player.three_gw_projected !== 0) score += 8;
  if (player.ownership != null && Number.isFinite(player.ownership) && player.ownership !== 0) score += 4;
  if (player.form != null && Number.isFinite(player.form) && player.form !== 0) score += 2;
  if (player.team) score += 1;
  if (player.position) score += 1;
  return score;
}

function preferMetric(primary: number | null | undefined, fallback: number | null | undefined) {
  if (primary != null && Number.isFinite(primary) && primary !== 0) return primary;
  if (fallback != null && Number.isFinite(fallback)) return fallback;
  return primary ?? fallback;
}

function mergePlannerPlayer(primary: Player, fallback?: Player | null): Player {
  if (!fallback) return primary;
  const richerFirst = playerDataScore(primary) >= playerDataScore(fallback) ? primary : fallback;
  const other = richerFirst === primary ? fallback : primary;
  return {
    ...other,
    ...richerFirst,
    fixture: richerFirst.fixture && richerFirst.fixture !== "TBC" ? richerFirst.fixture : other.fixture,
    fixture_difficulty: richerFirst.fixture && richerFirst.fixture !== "TBC" ? richerFirst.fixture_difficulty : other.fixture_difficulty,
    price: preferMetric(richerFirst.price, other.price) ?? richerFirst.price,
    projected: preferMetric(richerFirst.projected, other.projected) ?? richerFirst.projected,
    three_gw_projected: preferMetric(richerFirst.three_gw_projected, other.three_gw_projected) ?? undefined,
    ownership: preferMetric(richerFirst.ownership, other.ownership) ?? richerFirst.ownership,
    form: preferMetric(richerFirst.form, other.form) ?? richerFirst.form,
  };
}

function buildPlannerPlayerIndex(planner: MultiGwPlanner, platformPlayers: PlatformPlayerIndex): PlannerPlayerIndex {
  const index: PlannerPlayerIndex = new Map(platformPlayers);
  const routes = [planner.recommended_route, ...planner.alternative_routes].filter((route) => !route.__pending);

  const add = (player?: Player | null) => {
    const key = playerIndexKey(player);
    if (!key || !player) return;
    const existing = index.get(key);
    index.set(key, existing ? mergePlannerPlayer(player, existing) : player);
  };

  // Route-step players are the same rich objects already used by the full timeline at the bottom.
  // Index these first, then merge candidate objects into them instead of rendering the shallow
  // candidate copy directly.
  for (const route of routes) {
    for (const step of route.steps) {
      add(step.captain);
      (step.transfers_out ?? []).forEach(add);
      (step.transfers_in ?? []).forEach(add);
    }
  }
  for (const route of routes) {
    for (const step of route.steps) {
      for (const candidate of step.transfer_candidates_considered ?? []) {
        add(candidate.out_player);
        add(candidate.in_player);
      }
    }
  }
  return index;
}

function resolvePlannerPlayer(player: Player, index: PlannerPlayerIndex) {
  const key = playerIndexKey(player);
  return key ? mergePlannerPlayer(player, index.get(key)) : player;
}

function PlayerDecisionStats({ player }: { player?: Player | null }) {
  if (!player) return null;

  const fixture = player.fixture && player.fixture !== "TBC" ? player.fixture : "—";
  const price = Number.isFinite(player.price) ? `£${player.price.toFixed(1)}m` : "—";
  const nextProjection = Number.isFinite(player.projected) && player.projected !== 0 ? `${player.projected.toFixed(1)} pts` : "—";
  const horizonProjection = player.three_gw_projected != null && Number.isFinite(player.three_gw_projected) && player.three_gw_projected !== 0
    ? `${player.three_gw_projected.toFixed(1)} pts`
    : "—";
  const ownership = player.ownership != null && Number.isFinite(player.ownership) && player.ownership !== 0 ? `${player.ownership.toFixed(1)}%` : "—";

  const metrics = [
    { label: "Fixture", value: fixture, valueClass: "text-[var(--ink-soft)]" },
    { label: "Price", value: price, valueClass: "text-[var(--ink-soft)]" },
    { label: "Next GW", value: nextProjection, valueClass: "text-[var(--success)]" },
    { label: "3-GW", value: horizonProjection, valueClass: "text-[var(--accent)]" },
    { label: "Owned", value: ownership, valueClass: "text-[var(--ink-soft)]" },
  ];

  return (
    <>
      <dl className="mt-2.5 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-[var(--border-soft)] bg-[var(--border-soft)] sm:hidden">
        {metrics.map((metric) => (
          <div key={metric.label} className={`min-w-0 bg-[var(--surface)] px-2 py-2 ${metric.label === "Fixture" ? "col-span-2" : ""}`}>
            <dt className="text-[7px] font-black uppercase tracking-[0.08em] text-[var(--muted)]">{metric.label}</dt>
            <dd className={`mt-0.5 truncate text-[9px] font-black ${metric.valueClass}`} title={metric.value}>{metric.value}</dd>
          </div>
        ))}
      </dl>
      <dl className="mt-3 hidden overflow-hidden rounded-lg border border-[var(--border-soft)] bg-[var(--surface)] sm:block">
        {metrics.map((metric) => (
          <div key={metric.label} className="flex min-w-0 items-center justify-between gap-3 border-b border-[var(--border-soft)] px-3 py-2 last:border-b-0">
            <dt className="shrink-0 text-[9px] font-black uppercase tracking-[0.1em] text-[var(--muted)]">{metric.label}</dt>
            <dd className={`min-w-0 truncate text-right text-[11px] font-black ${metric.valueClass}`} title={metric.value}>{metric.value}</dd>
          </div>
        ))}
      </dl>
    </>
  );
}

function TransferMove({ out, incoming, gain }: { out?: Player | null; incoming?: Player | null; gain?: number | null }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-3)] p-2.5 sm:p-4">
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2 sm:mb-3">
        <p className="text-[9px] font-black uppercase tracking-[0.12em] text-[var(--muted)] sm:text-[10px] sm:tracking-[0.14em]">Recommended transfer</p>
        {gain != null && Number.isFinite(gain) ? (
          <span className={`rounded-lg px-2 py-1 text-[10px] font-black sm:px-2.5 sm:text-xs ${gain >= 0 ? "bg-[var(--success-soft)] text-[var(--success)]" : "bg-[var(--danger-soft)] text-[var(--danger)]"}`}>{formatSignedPoints(gain)} pts net</span>
        ) : null}
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_28px_minmax(0,1fr)] items-stretch gap-2 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-center sm:gap-3">
        <div className="min-w-0 rounded-xl border border-[var(--danger-border)] bg-[var(--surface)] p-2.5 sm:p-3">
          <span className="mb-2 inline-flex rounded-lg bg-[var(--danger-soft)] px-2 py-1 text-[8px] font-black uppercase tracking-[0.1em] text-[var(--danger)] sm:mb-3 sm:px-2.5 sm:text-[10px] sm:tracking-[0.12em]">Out</span>
          <div className="sm:hidden"><PlayerMini player={out} compact /></div>
          <div className="hidden sm:block"><PlayerMini player={out} /></div>
          <PlayerDecisionStats player={out} />
        </div>
        <span className="grid h-7 w-7 place-self-center place-items-center rounded-full bg-[var(--accent-soft)] text-sm font-black text-[var(--accent)] sm:h-9 sm:w-9 sm:text-lg">→</span>
        <div className="min-w-0 rounded-xl border border-[var(--success-border)] bg-[var(--surface)] p-2.5 sm:p-3">
          <span className="mb-2 inline-flex rounded-lg bg-[var(--success-soft)] px-2 py-1 text-[8px] font-black uppercase tracking-[0.1em] text-[var(--success)] sm:mb-3 sm:px-2.5 sm:text-[10px] sm:tracking-[0.12em]">In</span>
          <div className="sm:hidden"><PlayerMini player={incoming} compact /></div>
          <div className="hidden sm:block"><PlayerMini player={incoming} /></div>
          <PlayerDecisionStats player={incoming} />
        </div>
      </div>
    </div>
  );
}

function CandidateOption({ candidate, playerIndex, compact = false }: { candidate: NonNullable<PlannerStep["transfer_candidates_considered"]>[number]; playerIndex: PlannerPlayerIndex; compact?: boolean }) {
  const outgoing = resolvePlannerPlayer(candidate.out_player, playerIndex);
  const incoming = resolvePlannerPlayer(candidate.in_player, playerIndex);
  const reasons = candidate.reasoning.length ? candidate.reasoning : ["Alternative transfer route evaluated by the planner."];
  const rejectedBecause = candidate.why_not_chosen.length ? candidate.why_not_chosen : ["The selected action produced the stronger route-level outcome."];

  const reasoningPanels = (
    <>
      <div className="h-full rounded-xl border border-[var(--border-soft)] bg-[var(--surface-3)] p-3">
        <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[var(--accent)]">Why it was considered</p>
        <ul className="mt-2 space-y-1.5 text-xs font-semibold leading-5 text-[var(--ink-soft)]">
          {reasons.map((reason, index) => <li key={`reason-${index}`} className="flex gap-2"><span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[var(--accent)]" />{reason}</li>)}
        </ul>
      </div>
      <div className="h-full rounded-xl border border-[var(--warning-border)] bg-[var(--warning-soft)] p-3">
        <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[var(--warning)]">Why it was not selected</p>
        <ul className="mt-2 space-y-1.5 text-xs font-semibold leading-5 text-[var(--warning)]">
          {rejectedBecause.map((reason, index) => <li key={`rejected-${index}`} className="flex gap-2"><span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[var(--warning)]" />{reason}</li>)}
        </ul>
      </div>
    </>
  );

  return (
    <article className="flex h-full min-w-0 flex-col rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 shadow-[0_8px_22px_rgba(15,23,60,0.035)] sm:p-4">
      <div className="flex min-h-8 flex-wrap items-center justify-between gap-2">
        <p className="text-[9px] font-black uppercase tracking-[0.11em] text-[var(--accent)] sm:text-[10px] sm:tracking-[0.13em]">Alternative recommendation</p>
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          {candidate.recommendation_strength ? <span className="rounded-lg bg-[var(--accent-soft)] px-2 py-1 text-[8px] font-black uppercase tracking-[0.08em] text-[var(--accent)] sm:px-2.5 sm:text-[10px] sm:tracking-[0.1em]">{candidate.recommendation_strength}</span> : null}
          <span className={`rounded-lg px-2 py-1 text-[10px] font-black sm:px-2.5 sm:text-xs ${candidate.net_projected_gain >= 0 ? "bg-[var(--success-soft)] text-[var(--success)]" : "bg-[var(--danger-soft)] text-[var(--danger)]"}`}>{formatSignedPoints(candidate.net_projected_gain)} pts</span>
        </div>
      </div>

      <div className="mt-3 grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_24px_minmax(0,1fr)] items-stretch gap-2 md:grid-cols-[minmax(0,1fr)_36px_minmax(0,1fr)] md:gap-3">
        <div className="flex h-full min-w-0 flex-col rounded-xl border border-[var(--danger-border)] bg-[var(--danger-soft)] p-2.5 sm:p-3">
          <span className="mb-2 inline-flex w-fit rounded-lg bg-[var(--danger-soft)] px-2 py-1 text-[8px] font-black uppercase tracking-[0.1em] text-[var(--danger)] sm:mb-3 sm:px-2.5 sm:text-[9px] sm:tracking-[0.12em]">Sell</span>
          <PlayerMini player={outgoing} caption={`${outgoing.team} · ${outgoing.position}`} compact />
          <PlayerDecisionStats player={outgoing} />
        </div>

        <span className="grid h-7 w-7 place-self-center place-items-center rounded-full border border-[var(--accent-border)] bg-[var(--accent-soft)] text-sm font-black text-[var(--accent)] md:h-9 md:w-9 md:text-base">→</span>

        <div className="flex h-full min-w-0 flex-col rounded-xl border border-[var(--success-border)] bg-[var(--success-soft)] p-2.5 sm:p-3">
          <span className="mb-2 inline-flex w-fit rounded-lg bg-[var(--success-soft)] px-2 py-1 text-[8px] font-black uppercase tracking-[0.1em] text-[var(--success)] sm:mb-3 sm:px-2.5 sm:text-[9px] sm:tracking-[0.12em]">Buy</span>
          <PlayerMini player={incoming} caption={`${incoming.team} · ${incoming.position}`} compact />
          <PlayerDecisionStats player={incoming} />
        </div>
      </div>

      {!compact ? (
        <>
          <details className="group mt-3 overflow-hidden rounded-xl border border-[var(--border-soft)] bg-[var(--surface-3)] sm:hidden">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5">
              <span className="text-[10px] font-black uppercase tracking-[0.1em] text-[var(--ink-soft)]">Decision reasoning</span>
              <span className="grid h-7 w-7 place-items-center rounded-full bg-[var(--accent-soft)] text-sm font-black text-[var(--accent)] transition group-open:rotate-45">+</span>
            </summary>
            <div className="grid gap-2 border-t border-[var(--border-soft)] p-2.5">{reasoningPanels}</div>
          </details>
          <div className="mt-3 hidden items-stretch gap-3 sm:grid sm:grid-cols-2">{reasoningPanels}</div>
        </>
      ) : (
        <p className="mt-3 text-xs font-semibold leading-5 text-[var(--muted)]">{rejectedBecause[0] ?? reasons[0]}</p>
      )}
    </article>
  );
}

function SelectedGameweekWorkspace({ step, route, playerIndex }: { step: PlannerStep; route: PlannerRoute; playerIndex: PlannerPlayerIndex }) {
  if (step.__pending) {
    return (
      <section className="mt-0 rounded-b-[20px] border border-dashed border-[var(--accent-border)] bg-[var(--accent-soft)] p-6 text-center sm:mt-5 sm:rounded-[24px] sm:p-8">
        <span className="mx-auto block h-7 w-7 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" aria-hidden />
        <h2 className="mt-4 text-xl font-black text-[var(--ink)]">Calculating {step.gw}</h2>
        <p className="mt-2 text-sm font-semibold text-[var(--muted)]">The live route will update this workspace as soon as the gameweek completes.</p>
      </section>
    );
  }
  const pairs = transferPairs(step);
  const fixture = parseFixture(step);
  const reasoning = step.reasoning?.length ? step.reasoning : step.warning ? [step.warning] : [];
  const candidates = step.transfer_candidates_considered ?? [];

  const decisionEvidence = (
    <>
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-3)] p-4">
        <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[var(--accent)]">Why this week</p>
        {reasoning.length ? (
          <ul className="mt-3 space-y-2.5 text-sm font-semibold leading-6 text-[var(--ink-soft)]">
            {reasoning.map((item, index) => <li key={`${item}-${index}`} className="flex gap-2.5"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]" />{item}</li>)}
          </ul>
        ) : <p className="mt-3 text-sm font-semibold text-[var(--muted)]">No additional route explanation was supplied for this gameweek.</p>}
      </div>
      <div className={`rounded-2xl border p-4 ${step.warning ? "border-[var(--warning-border)] bg-[var(--warning-soft)]" : "border-[var(--success-border)] bg-[var(--success-soft)]"}`}>
        <p className={`text-[11px] font-black uppercase tracking-[0.14em] ${step.warning ? "text-[var(--warning)]" : "text-[var(--success)]"}`}>Watch before deadline</p>
        <p className={`mt-3 text-sm font-semibold leading-6 ${step.warning ? "text-[var(--warning)]" : "text-[var(--success)]"}`}>
          {step.warning ?? "No major warning is attached to this gameweek."}
        </p>
      </div>
    </>
  );

  const candidateGrid = candidates.length ? (
    <div className="grid items-stretch gap-3 sm:gap-4 xl:grid-cols-2">
      {candidates.map((candidate) => <CandidateOption key={`${candidate.out_player.id}-${candidate.in_player.id}`} candidate={candidate} playerIndex={playerIndex} />)}
    </div>
  ) : (
    <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface)] p-4 text-sm font-semibold text-[var(--muted)]">No additional transfer candidate was returned for this gameweek.</div>
  );

  return (
    <section className="planner-step-in mt-0 overflow-hidden rounded-b-[20px] border border-[var(--border)] bg-[var(--surface)] shadow-[0_16px_44px_rgba(15,23,60,0.055)] sm:mt-5 sm:rounded-[24px] sm:shadow-[0_20px_55px_rgba(15,23,60,0.065)]">
      <div className="flex flex-col gap-3 border-b border-[var(--border-soft)] bg-[var(--surface-3)] p-4 sm:gap-4 sm:px-6 sm:py-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-[0.13em] text-[var(--accent)] sm:text-xs sm:tracking-[0.16em]">Selected gameweek</span>
            <span className={`rounded-lg border px-2 py-1 text-[9px] font-black uppercase tracking-[0.08em] sm:px-2.5 sm:text-[10px] sm:tracking-[0.1em] ${actionSurfaceClass(step.action)}`}>{actionLabel(step.action)}</span>
          </div>
          {/* Backend headlines sometimes already start with "GWn:" - strip it so the prefix
              this heading adds doesn't render as "GW2: GW2: ...". */}
          <h2 className="mt-2 text-xl font-black tracking-[-0.03em] text-[var(--ink)] sm:text-3xl">{step.gw}: {(step.headline || routeActionSummary(step)).replace(/^GW\d+:\s*/i, "")}</h2>
          <p className="mt-1.5 line-clamp-2 text-xs font-semibold leading-5 text-[var(--muted)] sm:mt-2 sm:text-sm">{fixture.opponent}{fixture.venue ? ` (${fixture.venue})` : ""} · Review the move, captain and decision evidence for this week.</p>
        </div>
        <div className="grid grid-cols-3 gap-1.5 sm:min-w-[360px] sm:gap-2">
          <StatusPill label="Squad points" value={`${formatPoints(step.projected_points)} pts`} tone="green" />
          <StatusPill label="Net gain" value={`${formatSignedPoints(step.net_gain)} pts`} tone="purple" />
          <div className={`rounded-xl border px-2 py-2 sm:px-3 ${riskSurfaceClass(step.risk)}`}>
            <p className="text-[8px] font-black uppercase tracking-[0.08em] opacity-70 sm:text-[10px] sm:tracking-[0.12em]">Risk</p>
            <p className="mt-1 text-xs font-black sm:text-sm">{step.risk}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 p-4 sm:gap-5 sm:p-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(300px,0.7fr)]">
        <div>
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-xs font-black uppercase tracking-[0.13em] text-[var(--ink)] sm:text-sm sm:tracking-[0.15em]">Planned action</h3>
            <span className="text-[10px] font-bold text-[var(--muted)] sm:text-xs">{pairs.length ? `${pairs.length} transfer${pairs.length === 1 ? "" : "s"}` : "No transfer"}</span>
          </div>
          <div className="mt-3 space-y-3">
            {pairs.length ? pairs.map((pair, index) => {
              const outgoing = pair.out ? resolvePlannerPlayer(pair.out, playerIndex) : null;
              const incoming = pair.in ? resolvePlannerPlayer(pair.in, playerIndex) : null;
              return (
                <TransferMove
                  key={`${pair.out?.id ?? "out"}-${pair.in?.id ?? "in"}-${index}`}
                  out={outgoing}
                  incoming={incoming}
                  gain={step.net_gain}
                />
              );
            }) : (
              <div className="rounded-2xl border border-[var(--info-border)] bg-[var(--info-soft)] p-4 sm:p-5">
                <p className="text-base font-black text-[var(--info)] sm:text-lg">{actionLabel(step.action)}</p>
                <p className="mt-2 text-xs font-semibold leading-5 text-[var(--muted)] sm:text-sm sm:leading-6">The planner does not see enough expected value to force a transfer in this gameweek.</p>
              </div>
            )}
          </div>

          <details className="group mt-4 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface-3)] md:hidden">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.12em] text-[var(--accent)]">Decision evidence</p>
                <p className="mt-0.5 text-xs font-bold text-[var(--ink-soft)]">Why this move and deadline risks</p>
              </div>
              <span className="grid h-8 w-8 place-items-center rounded-full bg-[var(--accent-soft)] text-base font-black text-[var(--accent)] transition group-open:rotate-45">+</span>
            </summary>
            <div className="grid gap-3 border-t border-[var(--border)] p-3">{decisionEvidence}</div>
          </details>
          <div className="mt-5 hidden gap-4 md:grid md:grid-cols-2">{decisionEvidence}</div>
        </div>

        <aside className="space-y-3 sm:space-y-4">
          <div className="rounded-2xl border border-[var(--accent-border)] bg-[var(--accent-soft)] p-3 sm:p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[9px] font-black uppercase tracking-[0.12em] text-[var(--accent)] sm:text-[11px] sm:tracking-[0.14em]">Captain</p>
              <span className="text-xs font-black text-[var(--success)]">{formatPoints(step.captain?.projected)} pts</span>
            </div>
            <div className="mt-3"><PlayerMini player={step.captain} /></div>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:mt-4">
              <StatusPill label="Fixture" value={`${fixture.opponent}${fixture.venue ? ` (${fixture.venue})` : ""}`} />
              <StatusPill label="Projected" value={`${formatPoints(step.captain?.projected)} pts`} tone="green" />
            </div>
          </div>

          {step.data_quality_evidence ? (
            <>
              <details className="group rounded-2xl border border-[var(--border)] bg-[var(--surface)] sm:hidden">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-3">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-[0.12em] text-[var(--muted)]">Data coverage</p>
                    <p className="mt-1 text-sm font-black text-[var(--ink)]">{step.data_quality_evidence.players_with_fixture}/{step.data_quality_evidence.players_total} players</p>
                  </div>
                  <span className="rounded-lg bg-[var(--surface-3)] px-2.5 py-1 text-[10px] font-black text-[var(--ink-soft)]">{step.data_quality_evidence.players_missing_or_fallback} fallback</span>
                </summary>
                <div className="border-t border-[var(--border-soft)] px-3 py-2 text-xs font-semibold text-[var(--muted)]">Fixture and projection coverage used by the route model for this gameweek.</div>
              </details>
              <div className="hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:block">
                <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[var(--muted)]">Data coverage</p>
                <div className="mt-3 flex items-end justify-between gap-3">
                  <div>
                    <p className="text-2xl font-black text-[var(--ink)]">{step.data_quality_evidence.players_with_fixture}/{step.data_quality_evidence.players_total}</p>
                    <p className="text-xs font-bold text-[var(--muted)]">players with fixture data</p>
                  </div>
                  <span className="rounded-lg bg-[var(--surface-3)] px-2.5 py-1 text-xs font-black text-[var(--ink-soft)]">{step.data_quality_evidence.players_missing_or_fallback} fallback</span>
                </div>
              </div>
            </>
          ) : null}
        </aside>
      </div>

      <details className="group border-t border-[var(--border-soft)] bg-[var(--surface-3)] sm:hidden">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-4">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.12em] text-[var(--accent)]">Extra recommendations</p>
            <p className="mt-1 text-sm font-black text-[var(--ink)]">{candidates.length} other move{candidates.length === 1 ? "" : "s"} for {step.gw}</p>
          </div>
          <span className="grid h-9 w-9 place-items-center rounded-full border border-[var(--accent-border)] bg-[var(--accent-soft)] text-lg font-black text-[var(--accent)] transition group-open:rotate-45">+</span>
        </summary>
        <div className="border-t border-[var(--border-soft)] p-3">{candidateGrid}</div>
      </details>

      <div className="hidden border-t border-[var(--border-soft)] bg-[var(--surface-3)] px-5 py-5 sm:block sm:px-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.15em] text-[var(--accent)]">Extra transfer recommendations for {step.gw}</p>
            <h3 className="mt-1 text-lg font-black text-[var(--ink)]">Other moves the planner evaluated</h3>
            <p className="mt-1 text-xs font-semibold text-[var(--muted)]">These remain visible because a hold week can still contain useful transfer options that did not quite clear the threshold.</p>
          </div>
          <span className="shrink-0 rounded-full bg-[var(--accent-soft)] px-3 py-1.5 text-xs font-black text-[var(--accent)]">{candidates.length} recommendation{candidates.length === 1 ? "" : "s"}</span>
        </div>
        <div className="mt-4">{candidateGrid}</div>
      </div>
    </section>
  );
}

function RouteComparison({ planner, activeRoute, onSelect }: { planner: MultiGwPlanner; activeRoute: PlannerRoute; onSelect: (id: string | null) => void }) {
  const routes = [planner.recommended_route, ...planner.alternative_routes];
  const readyRoutes = routes.filter((route) => !route.__pending);
  return (
    <section className="mt-4 rounded-[20px] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[0_14px_38px_rgba(15,23,60,0.05)] sm:mt-5 sm:rounded-[24px] sm:p-6 sm:shadow-[0_20px_55px_rgba(15,23,60,0.065)]">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between sm:gap-3">
        <div>
          <p className="text-[9px] font-black uppercase tracking-[0.13em] text-[var(--accent)] sm:text-xs sm:tracking-[0.17em]">Route comparison</p>
          <h2 className="mt-1 text-lg font-black tracking-[-0.03em] text-[var(--ink)] sm:mt-2 sm:text-2xl">Compare the viable paths</h2>
          <p className="mt-1 text-xs font-semibold text-[var(--muted)] sm:mt-2 sm:text-sm">Select a route to update the recommendation and timeline above.</p>
        </div>
        <span className="w-fit rounded-full bg-[var(--accent-soft)] px-3 py-1.5 text-[10px] font-black text-[var(--accent)] sm:text-xs">{readyRoutes.length} routes ready</span>
      </div>

      <div className="-mx-1 mt-3 flex snap-x gap-3 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:hidden">
        {routes.map((route, index) => {
          if (route.__pending) return <div key={route.id} className="w-[245px] shrink-0 snap-start"><AlternativeRoutePlaceholder /></div>;
          const active = route.id === activeRoute.id;
          return (
            <button
              key={route.id}
              type="button"
              onClick={() => onSelect(index === 0 ? null : route.id)}
              aria-pressed={active}
              className={`w-[245px] shrink-0 snap-start rounded-2xl border p-3.5 text-left transition ${active ? "border-[var(--accent)] bg-[var(--accent-soft)] shadow-[0_10px_26px_rgba(108,29,255,0.12)]" : "border-[var(--border)] bg-[var(--surface-3)]"}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="truncate text-sm font-black text-[var(--ink)]">{route.title}</p>
                    {index === 0 ? <span className="rounded-full bg-[var(--accent)] px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.08em] text-white">Best</span> : null}
                  </div>
                  <p className="mt-1 line-clamp-2 text-[10px] font-semibold leading-4 text-[var(--muted)]">{firstRouteReason(route)}</p>
                </div>
                <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-black ${active ? "bg-[var(--accent)] text-white" : "border border-[var(--accent-border)] bg-[var(--surface)] text-[var(--accent)]"}`}>{active ? "✓" : "›"}</span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <StatusPill label="Total" value={`${formatPoints(route.expected_total_points)} pts`} />
                <StatusPill label="Gain" value={`${formatSignedPoints(route.expected_gain)} pts`} tone={route.expected_gain >= 0 ? "green" : "pink"} />
                <StatusPill label="Transfers" value={String(totalRouteTransfers(route))} />
                <div className={`rounded-xl border px-3 py-2 ${riskSurfaceClass(route.risk)}`}><p className="text-[8px] font-black uppercase tracking-[0.08em] opacity-70">Risk</p><p className="mt-1 text-xs font-black">{route.risk}</p></div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-5 hidden overflow-hidden rounded-2xl border border-[var(--border)] sm:block">
        <div className="hidden grid-cols-[minmax(220px,1.4fr)_repeat(5,minmax(86px,0.55fr))_54px] gap-3 border-b border-[var(--border)] bg-[var(--surface-3)] px-4 py-3 text-[10px] font-black uppercase tracking-[0.12em] text-[var(--muted)] xl:grid">
          <span>Route</span><span>Total</span><span>Gain</span><span>Transfers</span><span>Confidence</span><span>Risk</span><span />
        </div>
        <div className="divide-y divide-[var(--border-soft)]">
          {routes.map((route, index) => {
            if (route.__pending) return <AlternativeRoutePlaceholder key={route.id} compact />;
            const active = route.id === activeRoute.id;
            return (
              <button
                key={route.id}
                type="button"
                onClick={() => onSelect(index === 0 ? null : route.id)}
                aria-pressed={active}
                className={`grid w-full gap-3 px-4 py-4 text-left transition focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[var(--accent-2)] xl:grid-cols-[minmax(220px,1.4fr)_repeat(5,minmax(86px,0.55fr))_54px] xl:items-center ${active ? "bg-[var(--accent-soft)]" : "bg-[var(--surface)] hover:bg-[var(--surface-3)]"}`}
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-black text-[var(--ink)]">{route.title}</p>
                    {index === 0 ? <span className="rounded-full bg-[var(--accent)] px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.1em] text-white">Recommended</span> : null}
                  </div>
                  <p className="mt-1 line-clamp-1 text-xs font-semibold text-[var(--muted)]">{firstRouteReason(route)}</p>
                </div>
                <RouteCell label="Total" value={`${formatPoints(route.expected_total_points)} pts`} />
                <RouteCell label="Gain" value={`${formatSignedPoints(route.expected_gain)} pts`} tone={route.expected_gain >= 0 ? "green" : "red"} />
                <RouteCell label="Transfers" value={String(totalRouteTransfers(route))} />
                <RouteCell label="Confidence" value={route.confidence} />
                <RouteCell label="Risk" value={route.risk} risk={route.risk} />
                <span className={`hidden h-8 w-8 place-items-center justify-self-end rounded-full text-base font-black xl:grid ${active ? "bg-[var(--accent)] text-white" : "border border-[var(--accent-border)] bg-[var(--surface)] text-[var(--accent)]"}`}>{active ? "✓" : "›"}</span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function RouteCell({ label, value, tone, risk }: { label: string; value: string; tone?: "green" | "red"; risk?: RiskLevel }) {
  const textClass = risk ? riskTextClass(risk) : tone === "green" ? "text-[var(--success)]" : tone === "red" ? "text-[var(--danger)]" : "text-[var(--ink-soft)]";
  return (
    <div className="flex items-baseline justify-between gap-3 xl:block">
      <span className="text-[10px] font-black uppercase tracking-[0.1em] text-[var(--muted)] xl:hidden">{label}</span>
      <span className={`text-sm font-black ${textClass}`}>{value}</span>
    </div>
  );
}


function DetailedRouteCard({
  route,
  recommended,
  active,
  onSelect,
}: {
  route: PlannerRoute;
  recommended: boolean;
  active: boolean;
  onSelect: () => void;
}) {
  const warnings = route.warnings.length
    ? route.warnings
    : route.steps.map((step) => step.warning).filter((item): item is string => Boolean(item));

  return (
    <article className={`overflow-hidden rounded-[22px] border shadow-[0_18px_44px_rgba(15,23,60,0.055)] ${active ? "border-[var(--accent)] bg-[var(--accent-soft)] ring-2 ring-[var(--accent)]/12" : "border-[var(--border)] bg-[var(--surface)]"}`}>
      <button type="button" onClick={onSelect} className="w-full p-5 text-left focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[var(--accent-2)] sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-[var(--accent-soft)] px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-[var(--accent)]">{route.route_type} route</span>
              {recommended ? <span className="rounded-full bg-[var(--accent)] px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-white">Recommended</span> : null}
              {active ? <span className="rounded-full bg-[var(--success-soft)] px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-[var(--success)]">Showing above</span> : null}
            </div>
            <h3 className="mt-3 text-2xl font-black tracking-[-0.03em] text-[var(--ink)]">{route.title}</h3>
            <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-[var(--muted)]">{firstRouteReason(route)}</p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:min-w-[470px]">
            <StatusPill label="Total" value={`${formatPoints(route.expected_total_points)} pts`} />
            <StatusPill label="Gain" value={`${formatSignedPoints(route.expected_gain)} pts`} tone={route.expected_gain >= 0 ? "green" : "pink"} />
            <StatusPill label="Transfers" value={String(totalRouteTransfers(route))} />
            <div className={`rounded-xl border px-3 py-2 ${riskSurfaceClass(route.risk)}`}><p className="text-[10px] font-black uppercase tracking-[0.12em] opacity-70">Risk</p><p className="mt-1 text-sm font-black">{route.risk}</p></div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {route.steps.map((step) => {
            const pair = transferPairs(step)[0];
            const summary = step.__pending ? "Calculating" : pair ? `${pair.out?.name ?? "TBC"} → ${pair.in?.name ?? "TBC"}` : actionLabel(step.action);
            return (
              <div key={`${route.id}-${step.gw}-summary`} className="min-w-[150px] flex-1 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-3">
                <div className="flex items-center justify-between gap-2"><span className="text-xs font-black text-[var(--accent)]">{step.gw}</span><span className="text-[10px] font-black text-[var(--muted)]">{formatPoints(step.projected_points)} pts</span></div>
                <p className="mt-2 line-clamp-2 text-xs font-bold leading-5 text-[var(--ink-soft)]">{summary}</p>
              </div>
            );
          })}
        </div>
      </button>

      <div className="grid gap-3 border-t border-[var(--border-soft)] bg-[var(--surface-3)] p-4 md:grid-cols-3 sm:p-5">
        <AnalysisList title="Why this route" items={route.why} tone="purple" />
        <AnalysisList title="What could go wrong" items={route.why_this_could_be_wrong} tone="pink" />
        <AnalysisList title="Warnings" items={warnings} tone="amber" />
      </div>
    </article>
  );
}

function MobileDetailedRouteCard({ route, recommended, active, onSelect }: { route: PlannerRoute; recommended: boolean; active: boolean; onSelect: () => void }) {
  const warnings = route.warnings.length
    ? route.warnings
    : route.steps.map((step) => step.warning).filter((item): item is string => Boolean(item));
  return (
    <details className={`group overflow-hidden rounded-2xl border ${active ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "border-[var(--border)] bg-[var(--surface)]"}`}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-3.5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.08em] text-[var(--accent)]">{route.route_type}</span>
            {recommended ? <span className="rounded-full bg-[var(--accent)] px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.08em] text-white">Recommended</span> : null}
            {active ? <span className="rounded-full bg-[var(--success-soft)] px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.08em] text-[var(--success)]">Showing</span> : null}
          </div>
          <p className="mt-2 truncate text-sm font-black text-[var(--ink)]">{route.title}</p>
          <p className="mt-1 text-[10px] font-bold text-[var(--muted)]">{formatPoints(route.expected_total_points)} pts · {formatSignedPoints(route.expected_gain)} gain · {route.risk} risk</p>
        </div>
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--accent-soft)] text-base font-black text-[var(--accent)] transition group-open:rotate-45">+</span>
      </summary>
      <div className="border-t border-[var(--border-soft)] bg-[var(--surface-3)] p-3">
        <p className="text-xs font-semibold leading-5 text-[var(--muted)]">{firstRouteReason(route)}</p>
        <div className="mt-3 flex snap-x gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {route.steps.map((step) => (
            <div key={`${route.id}-mobile-detail-${step.gw}`} className="w-[132px] shrink-0 snap-start rounded-xl border border-[var(--border)] bg-[var(--surface)] p-2.5">
              <div className="flex items-center justify-between gap-2"><span className="text-[11px] font-black text-[var(--accent)]">{step.gw}</span><span className="text-[9px] font-black text-[var(--muted)]">{formatPoints(step.projected_points)}</span></div>
              <p className="mt-1.5 line-clamp-2 text-[10px] font-bold leading-4 text-[var(--ink-soft)]">{routeActionSummary(step)}</p>
            </div>
          ))}
        </div>
        <div className="mt-3 grid gap-2">
          <AnalysisList title="Why this route" items={route.why} tone="purple" />
          <AnalysisList title="What could go wrong" items={route.why_this_could_be_wrong} tone="pink" />
          <AnalysisList title="Warnings" items={warnings} tone="amber" />
        </div>
        <button type="button" onClick={onSelect} className="mt-3 w-full rounded-xl bg-[var(--accent)] px-4 py-2.5 text-xs font-black text-white">{active ? "Route currently shown" : "Show this route"}</button>
      </div>
    </details>
  );
}

function DetailedRoutes({ planner, activeRoute, onSelect }: { planner: MultiGwPlanner; activeRoute: PlannerRoute; onSelect: (id: string | null) => void }) {
  const routes = [planner.recommended_route, ...planner.alternative_routes];
  return (
    <>
      <section className="mt-4 rounded-[20px] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[0_14px_38px_rgba(15,23,60,0.05)] sm:hidden">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.13em] text-[var(--accent)]">All planner routes</p>
            <h2 className="mt-1 text-lg font-black text-[var(--ink)]">Detailed route evidence</h2>
          </div>
          <span className="rounded-full bg-[var(--accent-soft)] px-2.5 py-1 text-[9px] font-black text-[var(--accent)]">{routes.length} routes</span>
        </div>
        <div className="mt-3 grid gap-2.5">
          {routes.map((route, index) => route.__pending ? (
            <AlternativeRoutePlaceholder key={route.id} compact />
          ) : (
            <MobileDetailedRouteCard
              key={route.id}
              route={route}
              recommended={index === 0}
              active={route.id === activeRoute.id}
              onSelect={() => onSelect(index === 0 ? null : route.id)}
            />
          ))}
        </div>
      </section>

      <section className="mt-5 hidden rounded-[24px] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[0_20px_55px_rgba(15,23,60,0.065)] sm:block sm:p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.17em] text-[var(--accent)]">All planner routes</p>
            <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-[var(--ink)]">Every distinct planner route</h2>
            <p className="mt-2 text-sm font-semibold text-[var(--muted)]">Safe, balanced, aggressive and roll paths remain available. Select any route to load its own hero, timeline, selected-gameweek analysis and transfer recommendations above.</p>
          </div>
          <span className="rounded-full bg-[var(--accent-soft)] px-3 py-1.5 text-xs font-black text-[var(--accent)]">{routes.length} route slots</span>
        </div>
        <div className="mt-5 grid gap-4">
          {routes.map((route, index) => route.__pending ? (
            <AlternativeRoutePlaceholder key={route.id} />
          ) : (
            <DetailedRouteCard
              key={route.id}
              route={route}
              recommended={index === 0}
              active={route.id === activeRoute.id}
              onSelect={() => onSelect(index === 0 ? null : route.id)}
            />
          ))}
        </div>
      </section>
    </>
  );
}

function AdvancedAnalysis({ route }: { route: PlannerRoute }) {
  const warnings = route.warnings.length ? route.warnings : route.steps.map((step) => step.warning).filter((item): item is string => Boolean(item));
  return (
    <details className="group mt-5 overflow-hidden rounded-[24px] border border-[var(--border)] bg-[var(--surface)] shadow-[0_20px_55px_rgba(15,23,60,0.055)]">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-5 focus:outline-none sm:px-6">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.17em] text-[var(--accent)]">Route evidence</p>
          <h2 className="mt-2 text-xl font-black tracking-[-0.02em] text-[var(--ink)]">Route thesis, downside and risk notes</h2>
          <p className="mt-1 text-sm font-semibold text-[var(--muted)]">The complete gameweek output is shown above; this section keeps the route-level model explanation available on demand.</p>
        </div>
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-[var(--accent-border)] bg-[var(--accent-soft)] text-xl font-black text-[var(--accent)] transition group-open:rotate-45">+</span>
      </summary>
      <div className="border-t border-[var(--border-soft)] bg-[var(--surface-3)] p-4 sm:p-6">
        <div className="grid gap-4 lg:grid-cols-3">
          <AnalysisList title="Why this route" items={route.why} tone="purple" />
          <AnalysisList title="What could go wrong" items={route.why_this_could_be_wrong} tone="pink" />
          <AnalysisList title="Warnings" items={warnings} tone="amber" />
        </div>
      </div>
    </details>
  );
}

function AnalysisList({ title, items, tone }: { title: string; items: string[]; tone: "purple" | "pink" | "amber" }) {
  const styles = tone === "purple" ? "border-[var(--accent-border)] bg-[var(--accent-soft)] text-[var(--accent)]" : tone === "pink" ? "border-[var(--danger-border)] bg-[var(--danger-soft)] text-[var(--danger)]" : "border-[var(--warning-border)] bg-[var(--warning-soft)] text-[var(--warning)]";
  return (
    <div className={`rounded-2xl border p-4 ${styles}`}>
      <h3 className="text-sm font-black">{title}</h3>
      <ul className="mt-3 space-y-2 text-xs font-semibold leading-5 text-[var(--ink-soft)]">
        {(items.length ? items : ["No additional notes supplied."]).map((item, index) => <li key={`${title}-${index}`} className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-current" />{item}</li>)}
      </ul>
    </div>
  );
}

function UpgradeTeaser({ planner }: { planner: MultiGwPlanner }) {
  if (planner.usage.has_full_planner) return null;
  return (
    <section className="mt-5 flex flex-col gap-4 rounded-[24px] border border-dashed border-[var(--accent-border)] bg-[var(--accent-soft)] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.17em] text-[var(--accent)]">Extended planning</p>
        <h2 className="mt-2 text-xl font-black text-[var(--ink)]">Unlock deeper route comparison and saved plans</h2>
        <p className="mt-2 text-sm font-semibold text-[var(--muted)]">Upgrade messaging stays separate from your live recommendation, so sample data never looks like part of the real route.</p>
      </div>
      <a href="/pricing" className="inline-flex shrink-0 items-center justify-center rounded-xl bg-[var(--accent)] px-5 py-3 text-sm font-black text-white shadow-[0_12px_28px_rgba(108,29,255,0.24)] transition hover:bg-[var(--accent-2)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-2)] focus:ring-offset-2">View plans</a>
    </section>
  );
}

function AlternativeRoutePlaceholder({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`flex items-center justify-center gap-3 border-dashed border-[var(--border)] bg-[var(--surface)]/75 text-center ${compact ? "min-h-[78px] border-0 px-4 py-4" : "min-h-[168px] rounded-2xl border p-6"}`}>
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" aria-hidden />
      <p className="text-sm font-black text-[var(--accent)]">Calculating route...</p>
    </div>
  );
}

export function PlannerContent({ payload }: { payload: Record<string, unknown> }) {
  const state = usePlannerAnalysis(payload);
  const platformPlayers = usePlatformPlayerIndex(payload);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [selectedStepIndex, setSelectedStepIndex] = useState(0);
  const [routeTransitioning, setRouteTransitioning] = useState(false);
  const plannerTopRef = useRef<HTMLDivElement | null>(null);
  const routeAnimationTimerRef = useRef<number | null>(null);

  useEffect(() => () => {
    if (routeAnimationTimerRef.current) window.clearTimeout(routeAnimationTimerRef.current);
  }, []);

  if (state.phase === "error") return <ErrorState message={state.message} />;
  if (state.phase === "loading" || state.phase === "pending" || state.phase === "running") {
    return <StillComputingPanel phase={state.phase} elapsedMs={"elapsedMs" in state ? state.elapsedMs : undefined} label="Multi-GW plan" />;
  }

  const planner = state.data;
  if (planner.status !== "ok") return <PlannerUnavailablePanel planner={planner} />;

  const allRoutes = [planner.recommended_route, ...planner.alternative_routes];
  const activeRoute = allRoutes.find((route) => route.id === selectedRouteId && !route.__pending) ?? planner.recommended_route;
  const safeStepIndex = Math.min(selectedStepIndex, Math.max(0, activeRoute.steps.length - 1));
  const selectedStep = activeRoute.steps[safeStepIndex] ?? activeRoute.steps[0];
  const isRecommended = activeRoute.id === planner.recommended_route.id;
  const playerIndex = buildPlannerPlayerIndex(planner, platformPlayers);

  const handleRouteSelect = (id: string | null) => {
    const nextRoute = id ? allRoutes.find((route) => route.id === id && !route.__pending) : planner.recommended_route;
    if (!nextRoute) return;

    setSelectedStepIndex(0);
    setSelectedRouteId(id);
    setRouteTransitioning(false);

    window.requestAnimationFrame(() => {
      setRouteTransitioning(true);
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      plannerTopRef.current?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });

      if (routeAnimationTimerRef.current) window.clearTimeout(routeAnimationTimerRef.current);
      routeAnimationTimerRef.current = window.setTimeout(() => setRouteTransitioning(false), 560);
    });
  };

  return (
    <div ref={plannerTopRef} className="planner-scroll-target pb-6 sm:pb-10">
      <style>{`
        @keyframes plannerGwSwivel {
          0% { opacity: 0.78; transform: perspective(900px) rotateY(-12deg) translateY(5px) scale(0.985); }
          58% { opacity: 1; transform: perspective(900px) rotateY(3deg) translateY(-2px) scale(1.01); }
          100% { opacity: 1; transform: perspective(900px) rotateY(0deg) translateY(0) scale(1); }
        }
        .planner-gw-swivel {
          transform-origin: center center;
          animation: plannerGwSwivel 520ms cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        @keyframes plannerHeroPlayerSwap {
          0% { opacity: 0; transform: translate3d(18px, 12px, 0) scale(0.94); filter: blur(3px); }
          58% { opacity: 1; transform: translate3d(-3px, -2px, 0) scale(1.015); filter: blur(0); }
          100% { opacity: 1; transform: translate3d(0, 0, 0) scale(1); filter: blur(0); }
        }
        @keyframes plannerHeroCopySwap {
          0% { opacity: 0; transform: translateY(8px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        .planner-hero-player-swap {
          transform-origin: 72% 100%;
          animation: plannerHeroPlayerSwap 460ms cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        .planner-hero-copy-swap {
          animation: plannerHeroCopySwap 300ms cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        .planner-scroll-target { scroll-margin-top: 5.5rem; }
        @media (prefers-reduced-motion: reduce) {
          .planner-gw-swivel, .planner-hero-player-swap, .planner-hero-copy-swap { animation: none !important; }
        }
      `}</style>
      <PlannerRouteSelectionReset activeRouteId={activeRoute.id} stepCount={activeRoute.steps.length} setSelectedStepIndex={setSelectedStepIndex} />
      <PhaseBanner phase={state.phase} elapsedMs={"elapsedMs" in state ? state.elapsedMs : undefined} />
      {planner.horizon_clamped ? (
        <div className="mb-4 rounded-2xl border border-[var(--warning-border)] bg-[var(--warning-soft)] px-4 py-3 text-sm font-semibold text-[var(--warning)]">
          <span className="font-black">Horizon adjusted:</span> {planner.horizon_clamp_reason ?? `The loaded fixture calendar currently supports ${planner.horizon} gameweek${planner.horizon === 1 ? "" : "s"}.`}
        </div>
      ) : null}
      <PlannerHeader planner={planner} route={activeRoute} step={selectedStep} playerIndex={playerIndex} isRecommended={isRecommended} provisional={state.phase === "streaming"} onBack={() => handleRouteSelect(null)} />
      <PlannerContextBar planner={planner} route={activeRoute} />
      <GameweekHorizon route={activeRoute} selectedStepIndex={safeStepIndex} onSelectStep={setSelectedStepIndex} animateFirstStep={routeTransitioning} />
      {selectedStep ? <MobileGameweekNav route={activeRoute} selectedStepIndex={safeStepIndex} onSelectStep={setSelectedStepIndex} /> : null}
      {selectedStep ? <SelectedGameweekWorkspace key={`${activeRoute.id}-${selectedStep.gw}`} step={selectedStep} route={activeRoute} playerIndex={playerIndex} /> : null}
      <RouteComparison planner={planner} activeRoute={activeRoute} onSelect={handleRouteSelect} />
      <DetailedRoutes planner={planner} activeRoute={activeRoute} onSelect={handleRouteSelect} />
      <AdvancedAnalysis route={activeRoute} />
      <UpgradeTeaser planner={planner} />
    </div>
  );
}

function PlannerRouteSelectionReset({ activeRouteId, stepCount, setSelectedStepIndex }: { activeRouteId: string; stepCount: number; setSelectedStepIndex: (value: number) => void }) {
  useEffect(() => {
    setSelectedStepIndex(0);
  }, [activeRouteId, setSelectedStepIndex]);

  useEffect(() => {
    if (stepCount === 0) setSelectedStepIndex(0);
  }, [stepCount, setSelectedStepIndex]);

  return null;
}
