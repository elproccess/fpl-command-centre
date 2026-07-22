"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ApiRequestError, getAnalysisStatus } from "@/lib/api";
import type { ApiResult } from "@/lib/types";

const POLL_INTERVAL_MS = 2500;

type PollState<T> = { phase: "loading" } | { phase: "pending" | "running"; elapsedMs: number } | { phase: "ready"; data: T } | { phase: "error"; message: string };

// Shared across every usePolledAnalysis/useStreamingAnalysis consumer (Decision Centre,
// Scenarios, Squad Health, Market, Captaincy). Without this, Next unmounting and remounting a
// tab (navigate away, then back) reset the hook's useState to "loading" every time, so a page
// that had already finished computing showed a blank spinner again on every return visit - the
// exact regression already fixed for Planner/Dashboard/Squad, just never extended here. Keyed by
// a caller-supplied cacheKey (distinguishes e.g. squad-health from captaincy, which both key off
// just entry_id) plus the hook's own deps.
//
// Persisted to sessionStorage, not just an in-memory Map - found live: a phone browser reclaiming
// memory from a backgrounded tab does a full page reload on return, which wipes any in-memory-only
// cache completely. sessionStorage survives that reload (same tab, browser-local, no network
// request involved), so a return visit still shows the last real content instead of blanking back
// to "still computing" until everything re-finishes.
const ANALYSIS_DISPLAY_CACHE_TTL_MS = 3 * 60 * 60 * 1000;
const ANALYSIS_DISPLAY_CACHE_VERSION = "v1";
const analysisDisplayMemoryCache = new Map<string, { savedAt: number; state: unknown }>();

function buildAnalysisCacheKey(cacheKey: string, deps: unknown[]): string {
  return `${cacheKey}|${JSON.stringify(deps)}`;
}

function analysisStorageKey(key: string): string {
  // FNV-1a keeps the sessionStorage key short even though `key` embeds the full deps array.
  let hash = 2166136261;
  for (let index = 0; index < key.length; index += 1) {
    hash ^= key.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `analysis-display:${ANALYSIS_DISPLAY_CACHE_VERSION}:${(hash >>> 0).toString(16)}`;
}

function readAnalysisDisplayCache<S>(key: string): S | null {
  const memoryEntry = analysisDisplayMemoryCache.get(key);
  if (memoryEntry) {
    if (Date.now() - memoryEntry.savedAt <= ANALYSIS_DISPLAY_CACHE_TTL_MS) return memoryEntry.state as S;
    analysisDisplayMemoryCache.delete(key);
  }

  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(analysisStorageKey(key));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { key?: string; savedAt?: number; state?: unknown };
    if (parsed.key !== key || typeof parsed.savedAt !== "number") {
      window.sessionStorage.removeItem(analysisStorageKey(key));
      return null;
    }
    if (Date.now() - parsed.savedAt > ANALYSIS_DISPLAY_CACHE_TTL_MS) {
      window.sessionStorage.removeItem(analysisStorageKey(key));
      return null;
    }
    analysisDisplayMemoryCache.set(key, { savedAt: parsed.savedAt, state: parsed.state });
    return parsed.state as S;
  } catch {
    // Storage can be disabled/full in private browsing - the in-memory cache still works for the
    // remainder of this tab's life, just not across a full reload.
    return null;
  }
}

function writeAnalysisDisplayCache<S>(key: string, state: S) {
  const savedAt = Date.now();
  analysisDisplayMemoryCache.set(key, { savedAt, state });
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(analysisStorageKey(key), JSON.stringify({ key, savedAt, state }));
  } catch {
    // A storage failure (disabled/full/private browsing) must never stop the hook from working -
    // it just falls back to memory-only for this tab's life.
  }
}

/**
 * Calls `fetchFn` once. If the response reports the background analysis is still
 * pending/running (see ApiResult.analysisStatus) AND a `statusLookup` was provided, switches to
 * polling the lightweight `/analysis/status` endpoint every few seconds instead of re-hitting the
 * full heavy endpoint - the same real request/response body is otherwise re-sent every 2.5s for
 * as long as the job runs, which is real, avoidable network transfer (found live: this was the
 * actual driver of unexpectedly high transfer volume, not anything a real user did). Once status
 * reports "completed", `fetchFn` is called exactly once more to fetch the real result. Without a
 * `statusLookup` (no entry-scoped job to look up, e.g. the global market list board), falls back
 * to the original re-poll-the-full-endpoint behavior.
 *
 * `cacheKey` must be unique per call site (e.g. "squad-health", "captaincy") so two tabs that
 * happen to depend on the same entry_id don't read/overwrite each other's cached result.
 */
export function usePolledAnalysis<T>(
  fetchFn: () => Promise<ApiResult<T>>,
  deps: unknown[],
  cacheKey: string,
  statusLookup?: { entryId: string | null; gameweek?: number; analysisType: string },
): PollState<T> {
  const key = buildAnalysisCacheKey(cacheKey, deps);
  const [state, setState] = useState<PollState<T>>(() => readAnalysisDisplayCache<PollState<T>>(key) ?? { phase: "loading" });
  const startedAtRef = useRef<number | null>(null);
  const inFlightRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const cached = readAnalysisDisplayCache<PollState<T>>(key);
    setState(cached ?? { phase: "loading" });
    startedAtRef.current = Date.now();
    inFlightRef.current = false;
    // Seeded so a remount after the result already arrived never regresses to a spinner because
    // of one stray in-flight poll racing the unmount/remount.
    let settled = cached?.phase === "ready";

    function schedule(fn: () => void) {
      timer = setTimeout(fn, POLL_INTERVAL_MS);
    }

    async function fetchAndSettle() {
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      try {
        const result = await fetchFn();
        if (cancelled) return;
        if (result.analysisStatus === "pending" || result.analysisStatus === "running") {
          if (!settled) {
            const elapsedMs = Date.now() - (startedAtRef.current ?? Date.now());
            setState({ phase: result.analysisStatus, elapsedMs });
          }
          if (statusLookup?.entryId) {
            schedule(() => void statusPoll());
          } else {
            schedule(() => void fetchAndSettle());
          }
          return;
        }
        settled = true;
        const readyState: PollState<T> = { phase: "ready", data: result.data };
        writeAnalysisDisplayCache(key, readyState);
        setState(readyState);
      } catch (error) {
        if (cancelled || settled) return;
        // A real, permanent backend failure (see ApiRequestError.analysisFailed) is the only case
        // that should stop here - any other error (client-side timeout, transient network blip)
        // must keep retrying instead of leaving a real, still-computing analysis job stuck behind
        // a dead-end error screen. disableFallback endpoints (see getSquadPlayerProjections) now
        // throw on timeout instead of silently resolving with fallback/mock data, so this retry
        // loop is what keeps that honest failure from reading as a permanent one.
        if (error instanceof ApiRequestError && error.analysisFailed) {
          settled = true;
          setState({ phase: "error", message: error.message });
          return;
        }
        schedule(() => void fetchAndSettle());
      } finally {
        inFlightRef.current = false;
      }
    }

    async function statusPoll() {
      if (cancelled || settled || !statusLookup?.entryId) return;
      try {
        const status = await getAnalysisStatus(statusLookup.entryId, statusLookup.gameweek);
        if (cancelled || settled) return;
        const jobStatus = status.data.analysis[statusLookup.analysisType];
        if (jobStatus?.status === "completed") {
          await fetchAndSettle();
          return;
        }
        if (jobStatus?.status === "failed") {
          if (!settled) {
            settled = true;
            setState({ phase: "error", message: jobStatus.error_message ?? `${statusLookup.analysisType} job failed.` });
          }
          return;
        }
        if (!settled) {
          const elapsedMs = Date.now() - (startedAtRef.current ?? Date.now());
          setState({ phase: jobStatus?.status === "pending" ? "pending" : "running", elapsedMs });
        }
        schedule(() => void statusPoll());
      } catch {
        if (cancelled || settled) return;
        schedule(() => void statusPoll());
      }
    }

    void fetchAndSettle();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return state;
}

type StreamState<T> =
  | { phase: "loading" }
  | { phase: "pending" | "running"; elapsedMs: number }
  | { phase: "streaming"; data: T; elapsedMs: number }
  | { phase: "ready"; data: T }
  | { phase: "error"; message: string };

export type StreamingPollingPolicy = {
  /** Status-check delays before any usable partial content exists. */
  initialDelaysMs?: readonly number[];
  /** Status-check cadence once a real partial snapshot is already visible. */
  visibleIntervalMs?: number;
  /** Retry delay after a transient status/final-fetch failure. */
  errorRetryMs?: number;
  /** Delay before the first status check when restoring cached content on route return. */
  restoreDelayMs?: number;
  /** Stop all status polling while the browser tab is hidden. */
  pauseWhenHidden?: boolean;
};

const DEFAULT_STREAMING_INITIAL_DELAYS_MS = [POLL_INTERVAL_MS] as const;
const DEFAULT_STREAMING_ERROR_RETRY_MS = 15000;
const analysisLastStatusCheckAt = new Map<string, number>();
const useAnalysisRestoreEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * Same real on_step/on_progress mechanism already proven live on the Planner tab
 * (usePlannerAnalysis in planner-content.tsx), generalized to any dashboard_full-backed page:
 * calls `fetchFn` once, and while the backend reports the job still pending/running, polls the
 * lightweight /analysis/status endpoint (not the heavy fetchFn itself) for `analysisType`'s
 * real, growing partial payload (see analysis_cache.update_partial_progress on the backend) -
 * adapting it into the SAME shape `T` the completed result uses via `adaptPartial`, so a caller
 * can render "streaming" and "ready" through the identical component tree. Whichever panel is
 * genuinely done renders immediately; the rest fills in as later polls report it.
 *
 * A caller can provide a conservative polling policy. Cached streaming/ready content is restored
 * in a layout effect before paint, and a return visit does not immediately re-hit either the heavy
 * endpoint or the status endpoint. Hidden tabs can also suspend polling completely.
 */
export function useStreamingAnalysis<T>(
  fetchFn: () => Promise<ApiResult<T>>,
  options: {
    entryId: string | null;
    gameweek?: number;
    analysisType: string;
    adaptPartial: (partial: Record<string, unknown>) => T;
    polling?: StreamingPollingPolicy;
  },
  deps: unknown[],
  cacheKey: string,
): StreamState<T> {
  const key = buildAnalysisCacheKey(cacheKey, deps);
  // Memory-only in the initializer avoids a hard-refresh hydration mismatch. sessionStorage is
  // restored in the client layout effect before the browser paints the route-return loader.
  const [state, setState] = useState<StreamState<T>>(() => {
    const memoryEntry = analysisDisplayMemoryCache.get(key);
    if (!memoryEntry || Date.now() - memoryEntry.savedAt > ANALYSIS_DISPLAY_CACHE_TTL_MS) return { phase: "loading" };
    return memoryEntry.state as StreamState<T>;
  });
  const startedAtRef = useRef<number | null>(null);

  useAnalysisRestoreEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let initialPollIndex = 0;
    let finalFetchInFlight = false;
    const cached = readAnalysisDisplayCache<StreamState<T>>(key);

    setState(cached ?? { phase: "loading" });
    startedAtRef.current = Date.now();

    let settled = cached?.phase === "ready";
    let streamingShown = cached?.phase === "streaming";
    let heavyRequestStarted = false;
    const elapsedMs = () => Date.now() - (startedAtRef.current ?? Date.now());

    const initialDelays = options.polling?.initialDelaysMs?.length
      ? options.polling.initialDelaysMs
      : DEFAULT_STREAMING_INITIAL_DELAYS_MS;
    const visibleIntervalMs = Math.max(1000, options.polling?.visibleIntervalMs ?? POLL_INTERVAL_MS);
    const errorRetryMs = Math.max(1000, options.polling?.errorRetryMs ?? DEFAULT_STREAMING_ERROR_RETRY_MS);
    const restoreDelayMs = Math.max(1000, options.polling?.restoreDelayMs ?? visibleIntervalMs);
    const pauseWhenHidden = options.polling?.pauseWhenHidden ?? false;

    function publish(nextState: StreamState<T>) {
      if (cancelled) return;
      if (nextState.phase === "streaming" || nextState.phase === "ready") writeAnalysisDisplayCache(key, nextState);
      setState(nextState);
    }

    function applyStreaming(partial: Record<string, unknown>) {
      if (settled) return;
      streamingShown = true;
      publish({ phase: "streaming", data: options.adaptPartial(partial), elapsedMs: elapsedMs() });
    }

    function applyRunning(status: "pending" | "running" = "running") {
      // Never cover a restored/streamed real snapshot with a bare loader just because a later
      // panel is still computing or one status response does not contain a newer partial payload.
      if (settled || streamingShown) return;
      setState({ phase: status, elapsedMs: elapsedMs() });
    }

    function clearTimer() {
      if (!timer) return;
      clearTimeout(timer);
      timer = null;
    }

    function nextDelay() {
      if (streamingShown) return visibleIntervalMs;
      const delay = initialDelays[Math.min(initialPollIndex, initialDelays.length - 1)] ?? POLL_INTERVAL_MS;
      initialPollIndex += 1;
      return Math.max(1000, delay);
    }

    function schedulePoll(delayMs?: number) {
      if (cancelled || settled || !options.entryId || timer) return;
      if (pauseWhenHidden && typeof document !== "undefined" && document.visibilityState === "hidden") return;
      timer = setTimeout(() => {
        timer = null;
        void poll();
      }, delayMs ?? nextDelay());
    }

    async function fetchCompleted() {
      if (cancelled || settled || finalFetchInFlight) return;
      finalFetchInFlight = true;
      heavyRequestStarted = true;
      try {
        const result = await fetchFn();
        if (cancelled || settled) return;
        if (result.analysisStatus === "pending" || result.analysisStatus === "running") {
          applyRunning(result.analysisStatus);
          schedulePoll();
          return;
        }
        settled = true;
        clearTimer();
        publish({ phase: "ready", data: result.data });
      } catch {
        if (cancelled || settled) return;
        // A client timeout does not mean the backend job stopped. Keep any real partial content
        // visible and retry only through the conservative status loop.
        applyRunning();
        schedulePoll(errorRetryMs);
      } finally {
        finalFetchInFlight = false;
      }
    }

    async function poll() {
      if (cancelled || settled || !options.entryId) return;
      if (pauseWhenHidden && typeof document !== "undefined" && document.visibilityState === "hidden") return;

      analysisLastStatusCheckAt.set(key, Date.now());
      try {
        const status = await getAnalysisStatus(options.entryId, options.gameweek);
        if (cancelled || settled) return;
        const jobStatus = status.data.analysis[options.analysisType];

        if (jobStatus?.status === "completed") {
          await fetchCompleted();
          return;
        }
        if (jobStatus?.status === "failed") {
          settled = true;
          clearTimer();
          setState({ phase: "error", message: jobStatus.error_message ?? `${options.analysisType} job failed.` });
          return;
        }

        const partial = jobStatus?.payload;
        if (partial && typeof partial === "object" && (partial as Record<string, unknown>).is_partial) {
          applyStreaming(partial as Record<string, unknown>);
        } else {
          applyRunning(jobStatus?.status === "pending" ? "pending" : "running");
        }

        // A cold visit starts the heavy endpoint exactly once. If a restored snapshot survives a
        // backend restart and the job no longer exists, restart that one real request once only.
        if ((!jobStatus || jobStatus.status === "not_scheduled") && !heavyRequestStarted) {
          void fetchCompleted();
        }
        schedulePoll();
      } catch {
        if (cancelled || settled) return;
        applyRunning();
        schedulePoll(errorRetryMs);
      }
    }

    function handleVisibilityChange() {
      if (!pauseWhenHidden || cancelled || settled || typeof document === "undefined") return;
      if (document.visibilityState === "hidden") {
        clearTimer();
        return;
      }

      const minimumGap = streamingShown ? visibleIntervalMs : initialDelays[0] ?? POLL_INTERVAL_MS;
      const lastCheckedAt = analysisLastStatusCheckAt.get(key) ?? Date.now();
      const remaining = Math.max(1000, minimumGap - (Date.now() - lastCheckedAt));
      schedulePoll(remaining);
    }

    if (pauseWhenHidden && typeof document !== "undefined") {
      document.addEventListener("visibilitychange", handleVisibilityChange);
    }

    if (!settled) {
      if (cached?.phase === "streaming") {
        // Return navigation: content is already usable. Do not touch the DB immediately.
        const lastCheckedAt = analysisLastStatusCheckAt.get(key);
        const elapsedSinceCheck = lastCheckedAt == null ? 0 : Date.now() - lastCheckedAt;
        schedulePoll(Math.max(1000, restoreDelayMs - elapsedSinceCheck));
      } else {
        // Cold visit: start one real request and independently schedule lightweight status checks
        // so genuine partial panels can appear even if the request remains open or times out.
        void fetchCompleted();
        // The explicit first delay consumes slot zero; the next status check must advance to the
        // second backoff value rather than repeating the shortest interval twice.
        initialPollIndex = Math.min(1, initialDelays.length);
        schedulePoll(initialDelays[0] ?? POLL_INTERVAL_MS);
      }
    }

    return () => {
      cancelled = true;
      clearTimer();
      if (pauseWhenHidden && typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", handleVisibilityChange);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return state;
}

export function StillComputingPanel({ phase, elapsedMs, label }: { phase: "loading" | "pending" | "running"; elapsedMs?: number; label: string }) {
  const seconds = elapsedMs != null ? Math.round(elapsedMs / 1000) : 0;
  return (
    <section className="rounded-2xl border border-[#E8DEF8] bg-white p-6 shadow-[0_18px_45px_rgba(55,0,60,0.08)]">
      <div className="flex items-center gap-3">
        <span className="h-3 w-3 animate-pulse rounded-full bg-[#6C1DFF]" />
        <p className="text-sm font-black uppercase tracking-[0.14em] text-[#6C1DFF]">
          {phase === "loading" ? "Checking..." : phase === "running" ? "Computing" : "Queued"}
        </p>
      </div>
      <h2 className="mt-3 text-2xl font-black text-[#17002F]">{label} is still computing</h2>
      <p className="mt-2 text-sm font-semibold leading-6 text-[#5D4A70]">
        This runs as a real background job, not a page-load timeout - it started automatically when your team was imported
        {seconds > 0 ? ` and has been running for ${seconds}s` : ""}. This page checks back every few seconds and will show
        real results the moment it finishes.
      </p>
    </section>
  );
}
