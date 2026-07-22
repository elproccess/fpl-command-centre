import {
  captaincyCentre,
  commandCentre,
  decisionCentre,
  marketBoard,
  marketSignals,
  modelTrust,
  multiGwPlanner,
  playerComparison,
  reviewAudit,
  squadHealthDiagnostics,
  watchlist,
} from "./mock";
import { normalizeCommandCentre, normalizeMarketSignal, normalizePlayer, normalizeTransferRoute } from "./normalizers";
import type {
  ApiResult,
  AnalysisStatus,
  CaptaincyCentre,
  CommandCentre,
  DataMode,
  DataSourceStatus,
  DecisionCentre,
  ImportTeamResponse,
  MarketBoard,
  MarketSignal,
  ModelTrust,
  MultiGwPlanner,
  Player,
  PlayerComparison,
  PlannerRoute,
  TransferCandidate,
  ReviewAudit,
  SquadHealthDiagnostics,
  SquadIssue,
  TransferRoute,
  Watchlist,
} from "./types";

const SERVER_BACKEND_API_BASE_URL =
  process.env.BACKEND_API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "http://127.0.0.1:8000";
const BROWSER_API_BASE_URL = "/api/backend";
export const STRICT_BACKEND = process.env.NEXT_PUBLIC_STRICT_BACKEND === "true";
const REQUEST_TIMEOUT_MS = STRICT_BACKEND ? 120000 : process.env.NODE_ENV !== "development" ? 9000 : 1200;
const PLANNER_REQUEST_DEDUPE_MS = 1500;

// disableFallback: never silently substitute mock data on a hard failure (network error, non-2xx,
// cache_status "failed") - throws instead. Separate from throwOnPending below because some
// callers (e.g. squad/page.tsx's loadSquadRosterDataClient) already read the non-throwing
// `analysisStatus`/`partial` fields this function returns for a genuine pending/running response
// and drive their own bounded-retry loop off it - throwing there instead would silently break
// that retry (a caught error looks identical to "nothing pending" to code that only checks
// resultOrNull?.analysisStatus). throwOnPending is for callers with no such handling of their own.
type RequestOptions = RequestInit & { timeoutMs?: number; apiName?: string; disableFallback?: boolean; throwOnPending?: boolean };
const plannerInFlightRequests = new Map<string, Promise<ApiResult<MultiGwPlanner>>>();
const plannerRecentResults = new Map<string, { expiresAt: number; result: ApiResult<MultiGwPlanner> }>();

export class ApiRequestError extends Error {
  status?: number;
  endpoint: string;
  apiName: string;
  // True only when the backend itself reported cache_status "failed" for a persisted analysis
  // job (see requestJson's cacheStatus === "failed" branch) - a genuine, permanent result, not a
  // transient network/timeout blip. Callers polling a heavy job (e.g. usePlannerAnalysis) must
  // treat this differently from an ordinary fetch failure: retrying on the usual backoff would
  // otherwise silently show "still computing" forever for a job the backend will never finish.
  analysisFailed?: boolean;
  // True when the backend responded successfully but the persisted analysis is still
  // pending/running (cache_status). This is NOT a failure - see requestJson's pending/running
  // branch, which used to silently hand back mock fallback data as if it were the real, finished
  // result whenever disableFallback callers hit this branch (found live: the whole dashboard
  // rendering fake players/recommendations while the real analysis was still computing in the
  // background). Callers with disableFallback must catch this and keep polling/show a genuine
  // "still computing" state instead of treating .message or any payload here as displayable data.
  analysisPending?: boolean;
  partial?: Record<string, unknown>;

  constructor({
    apiName,
    endpoint,
    status,
    detail,
    analysisFailed,
    analysisPending,
    partial,
  }: {
    apiName: string;
    endpoint: string;
    status?: number;
    detail?: string;
    analysisFailed?: boolean;
    analysisPending?: boolean;
    partial?: Record<string, unknown>;
  }) {
    const statusText = status ? `status ${status}` : "request failed";
    super(`${apiName} failed for ${endpoint} (${statusText})${detail ? `: ${detail}` : ""}`);
    this.name = "ApiRequestError";
    this.status = status;
    this.endpoint = endpoint;
    this.apiName = apiName;
    this.analysisFailed = analysisFailed;
    this.analysisPending = analysisPending;
    this.partial = partial;
  }
}

function dataSource(mode: DataMode, endpoint?: string, detail?: string): DataSourceStatus {
  const label =
    mode === "real"
      ? "Real backend connected"
      : mode === "unavailable"
        ? "Backend unavailable"
        : mode === "future"
          ? "Future UI preview"
          : "Using mock fallback";

  return { mode, label, endpoint, detail };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function asString(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function confidenceFromScore(value: unknown, fallback: "High" | "Medium" | "Low" = "Medium") {
  const score = asNumber(value, Number.NaN);
  if (!Number.isFinite(score)) return fallback;
  if (score >= 75) return "High";
  if (score >= 55) return "Medium";
  return "Low";
}

function riskFromScore(value: unknown, fallback: "Low" | "Medium" | "High" = "Medium") {
  const text = typeof value === "string" ? value.toLowerCase() : "";
  if (text === "low") return "Low";
  if (text === "medium") return "Medium";
  if (text === "high") return "High";
  const score = asNumber(value, Number.NaN);
  if (!Number.isFinite(score)) return fallback;
  if (score >= 70) return "High";
  if (score >= 45) return "Medium";
  return "Low";
}

function signalFromDecision(value: unknown): MarketSignal["signal"] {
  const text = asString(value, "").toLowerCase();
  if (text.includes("buy")) return "Buy";
  if (text.includes("sell")) return "Sell";
  if (text.includes("avoid")) return "Avoid";
  if (text.includes("hold")) return "Hold";
  return "Watch";
}

function positionLabel(value: unknown, fallback: Player["position"]): Player["position"] {
  if (value === "GK" || value === "DEF" || value === "MID" || value === "FWD") return value;
  if (value === 1) return "GK";
  if (value === 2) return "DEF";
  if (value === 3) return "MID";
  if (value === 4) return "FWD";
  return fallback;
}

function classifyFailure(error: unknown): DataMode {
  if (error instanceof ApiRequestError && error.status) return "mock";
  return "unavailable";
}

function trimTrailingSlash(value: string) {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function getApiBaseUrl() {
  if (typeof window === "undefined") {
    return trimTrailingSlash(SERVER_BACKEND_API_BASE_URL);
  }
  return BROWSER_API_BASE_URL;
}

function buildApiUrl(path: string) {
  if (/^https?:\/\//i.test(path)) return path;
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${getApiBaseUrl()}${normalizedPath}`;
}

async function requestJson<T>(
  path: string,
  options: RequestOptions = {},
  fallback: T,
  normalize: (raw: unknown, fallback: T) => T = (raw) => raw as T,
): Promise<ApiResult<T>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? REQUEST_TIMEOUT_MS);
  const apiName = options.apiName ?? path;
  const endpoint = path;
  const disableFallback = Boolean(options.disableFallback);
  const throwOnPending = Boolean(options.throwOnPending);
  const fetchOptions = { ...options };
  delete fetchOptions.timeoutMs;
  delete fetchOptions.apiName;
  delete fetchOptions.disableFallback;
  delete fetchOptions.throwOnPending;

  try {
    const response = await fetch(buildApiUrl(path), {
      ...fetchOptions,
      headers: {
        ...(fetchOptions.body ? { "Content-Type": "application/json" } : {}),
        ...(fetchOptions.headers ?? {}),
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      let detail = response.statusText;
      try {
        const text = await response.text();
        if (text) detail = text.slice(0, 500);
      } catch {
        // Preserve the statusText when body reading fails.
      }
      throw new ApiRequestError({ apiName, endpoint, status: response.status, detail });
    }

    const raw = await response.json();
    // The persisted background-job analysis cache marks its responses with cache_status.
    // pending/running means `raw` is a thin status shape, not the real data shape - never
    // run it through `normalize` (which expects the real fields and would produce garbage).
    const cacheStatus = isRecord(raw) && typeof raw.cache_status === "string" ? raw.cache_status : undefined;
    if (cacheStatus === "failed") {
      const detail =
        isRecord(raw) && typeof raw.error_message === "string"
          ? raw.error_message
          : "Backend analysis failed.";
      throw new ApiRequestError({ apiName, endpoint, detail, analysisFailed: true });
    }

    if (cacheStatus === "pending" || cacheStatus === "running") {
      // raw.partial (see analysis_cache.update_partial_progress) is the same real, growing
      // snapshot the lightweight /analysis/status endpoint exposes - a caller that only polls
      // this heavy endpoint (e.g. a repeated planMultiGw call after a return-navigation "cold
      // start") must not be left with nothing but a bare pending/running flag when the backend
      // already attached genuine partial data to this exact response.
      const partial = isRecord(raw) && isRecord(raw.partial) ? raw.partial : undefined;
      // throwOnPending callers asked for "never show synthetic data, ever" and have no pending-
      // aware handling of their own (see RequestOptions' comment on why this is separate from
      // disableFallback). Found live: without this, the whole dashboard rendered mock players/
      // recommendations as if finished every time the real analysis was still computing (the
      // normal case for any cold request), because `data: fallback` here was indistinguishable
      // from a real completed response to a caller that only checked `.data`.
      if (throwOnPending) {
        throw new ApiRequestError({ apiName, endpoint, analysisPending: true, partial, detail: "Analysis is still computing." });
      }
      return {
        data: fallback,
        source: dataSource("real", path),
        analysisStatus: cacheStatus,
        partial,
      };
    }

    return {
      data: normalize(raw, fallback),
      source: dataSource("real", path),
      analysisStatus: cacheStatus === "completed" ? "completed" : undefined,
    };
  } catch (error) {
    if (STRICT_BACKEND || disableFallback) {
      if (error instanceof ApiRequestError) throw error;
      throw new ApiRequestError({
        apiName,
        endpoint,
        detail: error instanceof Error ? error.message : "Backend request failed",
      });
    }
    if (process.env.NODE_ENV === "development") {
      const mode = classifyFailure(error);
      console.info(`Using fallback data for ${path}:`, error);
      return {
        data: fallback,
        source: dataSource(mode, path, error instanceof Error ? error.message : "Backend request failed"),
      };
    }
    throw new Error("We could not reach the FPL service. Please try again in a moment.");
  } finally {
    clearTimeout(timeout);
  }
}

function futureResult<T>(data: T, endpoint: string, detail: string): ApiResult<T> {
  return { data, source: dataSource("future", endpoint, detail) };
}

const PLACEHOLDER_PLAYER: Player = {
  id: 0,
  api_id: 0,
  name: "Unknown player",
  team: "Unknown",
  position: "MID",
  price: 0,
  projected: 0,
  fixture: "TBC",
  fixture_difficulty: 3,
  ownership: 0,
  form: 0,
  three_gw_projected: 0,
  price_movement: 0,
  trend: "flat",
  status: "Available",
  risk: "Low",
  role: "",
};

function backendPlayer(raw: unknown, fallback: Player): Player {
  if (!isRecord(raw)) return fallback;
  return normalizePlayer(
    {
      id: raw.player_id ?? raw.id ?? raw.fpl_element_id,
      api_id: raw.player_id ?? raw.id ?? raw.fpl_element_id,
      code: raw.code,
      name: raw.web_name ?? raw.name,
      team: raw.team_short_name ?? raw.team,
      position: positionLabel(raw.position, fallback.position),
      price: raw.now_cost ?? raw.price,
      projected: raw.projected_points ?? raw.projected_points_horizon ?? raw.expected_points ?? raw.projected,
      fixture: raw.fixture ?? raw.next_fixture,
      fixture_difficulty: raw.fixture_difficulty,
      ownership: raw.selected_by_percent ?? raw.ownership_percent ?? raw.ownership,
      form: raw.form,
      three_gw_projected: raw.three_gw_projected ?? raw.projected_points_horizon,
      price_movement: raw.cost_change_event ?? raw.price_movement,
      trend: asNumber(raw.transfers_in_event, 0) > asNumber(raw.transfers_out_event, 0) ? "up" : asNumber(raw.transfers_out_event, 0) > asNumber(raw.transfers_in_event, 0) ? "down" : "flat",
      status: raw.status === "d" ? "Doubt" : raw.status === "i" ? "Injured" : raw.status === "s" ? "Suspended" : "Available",
      risk: riskFromScore(raw.risk_level ?? raw.risk_score, fallback.risk),
      role: raw.recommendation ?? raw.market_label ?? raw.role_archetype ?? raw.role,
      team_has_fixture: raw.team_has_fixture,
    },
    fallback,
  );
}

function backendSignal(raw: unknown, fallback: MarketSignal): MarketSignal {
  if (!isRecord(raw)) return fallback;
  const recommendation = asString(raw.recommendation ?? raw.market_label ?? raw.alert, fallback.signal).toLowerCase();
  const signal: MarketSignal["signal"] =
    recommendation.includes("buy") ? "Buy" :
    recommendation.includes("sell") ? "Sell" :
    recommendation.includes("avoid") || recommendation.includes("trap") ? "Avoid" :
    recommendation.includes("hold") ? "Hold" : "Watch";

  return normalizeMarketSignal(
    {
      player: backendPlayer(raw, { ...fallback.player, fixture: "TBC" }),
      signal,
      score: raw.market_score ?? raw.score ?? raw.urgency_score ?? raw.risk_score,
      reason: asArray(raw.reasons).filter((item): item is string => typeof item === "string").join(" ") || raw.summary || raw.reason,
    },
    fallback,
  );
}

function backendRoute(raw: unknown, fallback: TransferRoute): TransferRoute {
  if (!isRecord(raw)) return fallback;
  const action = asString(raw.action ?? raw.route_type ?? raw.scenario_type ?? raw.route_id, fallback.route_type).toLowerCase();
  const routeType: TransferRoute["route_type"] = action.includes("roll") ? "roll" : action.includes("upside") || action.includes("aggressive") ? "upside" : action.includes("risk") || asNumber(raw.hit_cost, 0) > 0 ? "risk" : "safe";
  const reasoning = asArray(raw.reasoning ?? raw.reasons).filter((item): item is string => typeof item === "string");
  const gain = asNumber(raw.net_projected_gain ?? raw.net_gain ?? raw.projected_points_delta ?? raw.expected_gain, fallback.expected_gain);

  return normalizeTransferRoute(
    {
      id: raw.route_id ?? raw.scenario_id ?? fallback.id,
      title: raw.name ?? raw.summary ?? fallback.title,
      move: raw.summary ?? raw.name ?? (routeType === "roll" ? "Roll transfer" : "Analysis pending"),
      expected_gain: gain,
      confidence: asNumber(raw.confidence, 75) >= 75 ? "High" : asNumber(raw.confidence, 75) >= 55 ? "Medium" : "Low",
      risk: asNumber(raw.hit_cost, 0) >= 8 ? "High" : asNumber(raw.hit_cost, 0) >= 4 ? "Medium" : fallback.risk,
      why: reasoning.length ? reasoning : fallback.why,
      why_this_could_be_wrong: asArray(raw.warnings).filter((item): item is string => typeof item === "string").length
        ? asArray(raw.warnings).filter((item): item is string => typeof item === "string")
        : fallback.why_this_could_be_wrong,
      route_type: routeType,
    },
    fallback,
  );
}

function adaptCommandCentre(raw: unknown, fallback: CommandCentre): CommandCentre {
  // Used for both the complete dashboard_full payload AND a genuine in-progress partial snapshot
  // (see gameweek_command_centre.build_gameweek_dashboard's on_progress) - a partial snapshot has
  // squad_health_panel/captaincy_panel ready well before best_move_panel (which needs the full
  // multi-gw planner search to finish), so gating entry into this real-backend-shape branch on
  // best_move_panel alone used to throw every early panel away and fall back to
  // normalizeCommandCentre() - which expects an entirely different (non-backend, e.g. mock) shape
  // and would render placeholders even though real panels already existed. Enter this branch if
  // ANY known backend panel is present, complete or partial.
  if (
    !isRecord(raw) ||
    !(isRecord(raw.best_move_panel) || isRecord(raw.squad_health_panel) || isRecord(raw.captaincy_panel) || isRecord(raw.stock_market_panel) || isRecord(raw.multi_gw_plan_panel))
  ) {
    return normalizeCommandCentre(raw, fallback);
  }

  const bestMovePanel = isRecord(raw.best_move_panel) ? raw.best_move_panel : {};
  const deadline = isRecord(raw.deadline_summary) ? raw.deadline_summary : {};
  const captaincy = isRecord(raw.captaincy_panel) ? raw.captaincy_panel : {};
  const health = isRecord(raw.squad_health_panel) ? raw.squad_health_panel : {};
  const plan = isRecord(raw.multi_gw_plan_panel) ? raw.multi_gw_plan_panel : {};
  const market = isRecord(raw.stock_market_panel) ? raw.stock_market_panel : {};
  const captain = backendPlayer((captaincy.captain as unknown) ?? null, PLACEHOLDER_PLAYER);
  const vice = backendPlayer((captaincy.vice_captain as unknown) ?? null, PLACEHOLDER_PLAYER);
  const lightweight = Boolean(raw.lightweight);
  const pendingRoute = (routeType: TransferRoute["route_type"]): TransferRoute => ({
    id: `pending-${routeType}`,
    title: "Analysis pending",
    move: "Analysis pending",
    expected_gain: 0,
    confidence: "Low",
    risk: "Low",
    why: [],
    why_this_could_be_wrong: [],
    route_type: routeType,
  });
  // Select roll/upside routes by explicit route_id/scenario_type/route_type matching (same
  // classification plannerRouteType() already uses for the Planner page, which is verified
  // correct) - NOT by slicing the first 2 of alternative_routes and hoping their keyword-based
  // fallback types land on distinct slots. That naive approach silently dropped routes past
  // index 1 (e.g. planner_risk_reduction_route, optimise_xi_only) and, whenever none of the
  // surviving routes classified as "roll", fell back to routes[2] - which could be the SAME
  // object already selected as upside_alternative, rendering two identical cards.
  const altRoutes = asArray(plan.alternative_routes).filter(isRecord);
  const rollRoute = altRoutes.find((route) => plannerRouteType(route, "safe") === "roll") ?? (isRecord(plan.roll_baseline_route) ? plan.roll_baseline_route : null);
  const upsideRoute = altRoutes.find((route) => plannerRouteType(route, "safe") === "upside") ?? altRoutes.find((route) => route !== rollRoute) ?? null;
  const priorityRoutes = [
    { ...backendRoute(bestMovePanel, pendingRoute("safe")), route_type: "safe" as const },
    { ...backendRoute(upsideRoute, pendingRoute("upside")), route_type: "upside" as const },
    { ...backendRoute(rollRoute, pendingRoute("roll")), route_type: "roll" as const },
  ];
  const marketRows = [...asArray(market.buy_now), ...asArray(market.sell_watch), ...asArray(market.owned_alerts)].slice(0, 8);

  return {
    ...fallback,
    lightweight,
    deadline: asString(deadline.summary, fallback.deadline),
    best_move: {
      ...fallback.best_move,
      recommended_action: asString(deadline.recommended_action ?? bestMovePanel.action, fallback.best_move.recommended_action),
      move: asString(bestMovePanel.summary, priorityRoutes[0]?.move ?? "Analysis pending"),
      expected_gain: asNumber(bestMovePanel.net_projected_gain, 0),
      confidence_band: asNumber(deadline.confidence, 70) >= 75 ? "High" : asNumber(deadline.confidence, 70) >= 55 ? "Medium" : "Low",
      risk_level: asString(deadline.risk_level, "low") === "high" ? "High" : asString(deadline.risk_level, "low") === "medium" ? "Medium" : "Low",
      why: asArray(bestMovePanel.reasoning).filter((item): item is string => typeof item === "string").slice(0, 4),
      why_this_could_be_wrong: asArray(raw.warnings).filter((item): item is string => typeof item === "string").slice(0, 3),
      fallback_used: Boolean(isRecord(raw.projection_model) && raw.projection_model.fallback_used),
      fallback_reason: isRecord(raw.projection_model) ? asString(raw.projection_model.fallback_reason, "") : null,
      // Found live: best_move_panel is the slowest panel (needs the full multi-gw planner
      // search) - while it's genuinely absent from a partial/streaming snapshot, expected_gain
      // above silently defaults to 0, which renders as a real "+0 gain, just roll" recommendation
      // instead of "still calculating". __pending flags that so renderers can show a loading
      // state for this specific number instead of a misleading real-looking zero.
      __pending: !isRecord(raw.best_move_panel),
    },
    captain_pick: captain,
    vice_captain: vice,
    squad_health: {
      score: (typeof health.score === "number" && Number.isFinite(health.score)) ? Math.round(health.score) : null,
      grade: asString(health.status, "stable") === "strong" ? "Strong" : asString(health.status, "stable") === "fragile" ? "Fragile" : asString(health.status, "stable") === "critical" ? "Critical" : "Stable",
      minutes_risk: null,
      injury_risk: null,
      weak_bench_alerts: asArray(health.main_issues).map((issue) => isRecord(issue) ? asString(issue.reason, "Review squad issue") : "Review squad issue").slice(0, 2),
      captaincy_strength: captain.id ? "High" : fallback.squad_health.captaincy_strength,
    },
    transfer_preview: lightweight ? [] : priorityRoutes.length ? priorityRoutes.slice(0, 3) : [],
    planner: [],
    market_alerts: lightweight ? [] : marketRows.length ? marketRows.map((signal, index) => backendSignal(signal, fallback.market_alerts[index] ?? fallback.market_alerts[0])) : [],
    risk_alerts: asArray(raw.warnings).filter((item): item is string => typeof item === "string").slice(0, 5),
  };
}

function adaptSquadDiagnostics(raw: unknown, fallback: SquadHealthDiagnostics): SquadHealthDiagnostics {
  if (!isRecord(raw)) return fallback;
  const health = isRecord(raw.squad_health) ? raw.squad_health : {};
  const priorities = asArray(raw.transfer_priorities);
  const players = asArray(raw.players);
  const issues = [...priorities, ...players].filter(isRecord).slice(0, 10);

  function issue(item: Record<string, unknown>, index: number): SquadIssue {
    const severity = asString(item.squad_issue_level ?? item.severity, "").includes("critical") || asString(item.squad_issue_level, "").includes("major") ? "High" : asString(item.squad_issue_level, "").includes("medium") ? "Medium" : "Low";
    return {
      id: asString(item.player_id, `issue-${index}`),
      severity,
      category: severity === "High" ? "Transfer" : "Minutes",
      affected_player: backendPlayer(item, PLACEHOLDER_PLAYER),
      reason: asString(item.reason ?? item.summary, "Backend flagged this player for review."),
      suggested_action: asString(item.recommended_action, "Monitor before deadline."),
    };
  }

  const mapped = issues.map(issue);
  return {
    ...fallback,
    health: {
      ...fallback.health,
      score: (typeof health.score === "number" && Number.isFinite(health.score)) ? Math.round(health.score) : null,
      grade: asString(health.grade, fallback.health.grade) as SquadHealthDiagnostics["health"]["grade"],
    },
    urgent_issues: mapped.filter((item) => item.severity === "High").slice(0, 3),
    minutes_risk_list: mapped.slice(0, 4),
    injury_suspension_risk_list: mapped.filter((item) => item.severity !== "Low").slice(0, 4),
    fixture_problem_areas: mapped.slice(2, 5),
    transfer_pressure: {
      level: mapped.some((item) => item.severity === "High") ? "High" : "Medium",
      reason: asString(isRecord(raw.transfer_strategy) ? raw.transfer_strategy.summary : undefined, fallback.transfer_pressure.reason),
    },
    // Real projected_points/ownership_percent per player (squad_health.py's _build_player_cards
    // output) - see loadSquadRosterData(), which merges these onto the /squad page's player list
    // in place of the raw import snapshot's always-zero placeholders.
    players: players.filter(isRecord).map((item, index) => backendPlayer(item, fallback.players[index] ?? fallback.players[0])),
  };
}

function adaptCaptaincyCentre(raw: unknown, fallback: CaptaincyCentre): CaptaincyCentre {
  const centre = adaptCommandCentre(raw, commandCentre);
  const best = fallback.best_captain;
  const captaincyPanel = isRecord(raw) && isRecord(raw.captaincy_panel) ? raw.captaincy_panel : {};
  const rawCaptain = isRecord(captaincyPanel.captain) ? captaincyPanel.captain : {};
  const rawVice = isRecord(captaincyPanel.vice_captain) ? captaincyPanel.vice_captain : {};

  const floorScore = (rawPlayer: Record<string, unknown>): number | null =>
    typeof rawPlayer.captaincy_floor_score === "number" && Number.isFinite(rawPlayer.captaincy_floor_score)
      ? rawPlayer.captaincy_floor_score
      : null;

  const ceilingScore = (rawPlayer: Record<string, unknown>): number | null =>
    typeof rawPlayer.captaincy_ceiling_score === "number" && Number.isFinite(rawPlayer.captaincy_ceiling_score)
      ? rawPlayer.captaincy_ceiling_score
      : null;

  const buildOption = (player: Player, rawPlayer: Record<string, unknown>) => ({
    ...best,
    player,
    projected_points: player.projected,
    ceiling: ceilingScore(rawPlayer),
    safety: floorScore(rawPlayer),
    fixture_difficulty: (player.fixture_difficulty ?? 3) as 1 | 2 | 3 | 4 | 5,
    reasoning: "",
    why_this_could_go_wrong: best.why_this_could_go_wrong,
  });

  // alternatives = the top-5 eligible list from the backend (includes captain + vice as entries 0 and 1).
  // Each entry is a compact player dict with its own projected_points and captaincy_floor_score.
  const rawAlternatives = asArray(captaincyPanel.alternatives).filter(isRecord);
  const topFromAlternatives = rawAlternatives
    .slice(0, 5)
    .map((rawAlt) => buildOption(backendPlayer(rawAlt, PLACEHOLDER_PLAYER), rawAlt))
    .filter((opt) => opt.player.id && opt.player.position !== "GK");

  // Fall back to just captain + vice if alternatives were not populated.
  const backendTopOptions = topFromAlternatives.length
    ? topFromAlternatives
    : [
        { player: centre.captain_pick, rawPlayer: rawCaptain },
        { player: centre.vice_captain, rawPlayer: rawVice },
      ]
        .filter(({ player }) => player.id)
        .map(({ player, rawPlayer }) => buildOption(player, rawPlayer));

  return {
    ...fallback,
    ceiling_vs_safety: "",
    fixture_difficulty_summary: "",
    minutes_risk_summary: "",
    best_captain: { ...best, player: centre.captain_pick, projected_points: centre.captain_pick.projected, ceiling: ceilingScore(rawCaptain), safety: floorScore(rawCaptain) },
    vice_captain: { ...fallback.vice_captain, player: centre.vice_captain, projected_points: centre.vice_captain.projected, ceiling: ceilingScore(rawVice), safety: floorScore(rawVice) },
    top_options: backendTopOptions,
  };
}

function adaptDecisionCentre(raw: unknown, fallback: DecisionCentre): DecisionCentre {
  const centre = adaptCommandCentre(raw, commandCentre);
  const routes = centre.transfer_preview;
  // The recommended route's OWN first-step captain (multi_gw_plan_panel.gameweek_steps[0].captain) -
  // NOT captaincy_panel.captain (centre.captain_pick), which is Squad Health's generic, route-
  // independent captaincy pick. best_move_panel itself carries no captain/gameweek_steps field at
  // all, so the only place the captain matching THIS specific recommended move actually lives is
  // the sibling multi_gw_plan_panel - the same field the (already-verified) Planner page reads.
  const plan = isRecord(raw) && isRecord(raw.multi_gw_plan_panel) ? raw.multi_gw_plan_panel : {};
  const bestMovePanel = isRecord(raw) && isRecord(raw.best_move_panel) ? raw.best_move_panel : {};
  const recommendedStep = asArray(plan.gameweek_steps).filter(isRecord)[0];
  const routeCaptain = recommendedStep && isRecord(recommendedStep.captain) ? backendPlayer(recommendedStep.captain, centre.captain_pick) : centre.captain_pick;
  const routeViceCaptain = recommendedStep && isRecord(recommendedStep.vice_captain) ? backendPlayer(recommendedStep.vice_captain, centre.vice_captain) : centre.vice_captain;

  // The backend already returns the exact transfer pair on best_move_panel (copied from the
  // recommended route's first gameweek step). Prefer that source, then fall back to the embedded
  // multi-GW step. This keeps the Transfer page on the same rich player card/code used by the
  // Planner page instead of guessing from summary text or showing buy_candidates[0]'s shirt.
  const directOutgoing = asArray(bestMovePanel.transfers_out).find(isRecord);
  const directIncoming = asArray(bestMovePanel.transfers_in).find(isRecord);
  const stepOutgoing = recommendedStep ? asArray(recommendedStep.transfers_out).find(isRecord) : undefined;
  const stepIncoming = recommendedStep ? asArray(recommendedStep.transfers_in).find(isRecord) : undefined;
  const rawRecommendedOutgoing = directOutgoing ?? stepOutgoing;
  const rawRecommendedIncoming = directIncoming ?? stepIncoming;
  const recommendedOutgoing = rawRecommendedOutgoing ? backendPlayer(rawRecommendedOutgoing, PLACEHOLDER_PLAYER) : null;
  const recommendedIncoming = rawRecommendedIncoming ? backendPlayer(rawRecommendedIncoming, PLACEHOLDER_PLAYER) : null;
  const emptyRoute = (routeType: TransferRoute["route_type"]): TransferRoute => ({
    id: `pending-${routeType}`,
    title: "Analysis pending",
    move: "Analysis pending",
    expected_gain: 0,
    confidence: "Low",
    risk: "Low",
    why: ["Backend route analysis is still running."],
    why_this_could_be_wrong: [],
    route_type: routeType,
  });
  return {
    ...fallback,
    best_move: centre.best_move,
    expected_gain: centre.best_move.expected_gain,
    confidence: centre.best_move.confidence_band,
    risk: centre.best_move.risk_level,
    why_this_move: centre.best_move.why,
    what_could_go_wrong: centre.best_move.why_this_could_be_wrong.length ? centre.best_move.why_this_could_be_wrong : [],
    // priorityRoutes (centre.transfer_preview) is now always built as [safe, upside, roll] in
    // that fixed order by adaptCommandCentre() - each slot is selected there by explicit
    // route_id/scenario_type matching, so plain positional indexing here is correct by
    // construction rather than a fragile "hope the classification landed right" lookup.
    safe_alternative: routes[0] ?? emptyRoute("safe"),
    upside_alternative: routes[1] ?? emptyRoute("upside"),
    roll_alternative: routes[2] ?? emptyRoute("roll"),
    no_strong_move: centre.best_move.expected_gain < 1.5 || centre.best_move.recommended_action.toLowerCase().includes("roll"),
    recommended_outgoing: recommendedOutgoing?.id ? recommendedOutgoing : null,
    recommended_incoming: recommendedIncoming?.id ? recommendedIncoming : null,
    // Real "Buy" market signals from the same dashboard call's stock-market panel - external
    // players worth adding, not the user's own squad (that was the bug: buy candidates were
    // being filtered from the owned-squad list, where "buy_now" signals never apply).
    buy_candidates: centre.market_alerts.filter((signal) => signal.signal === "Buy"),
    // Route-specific captain for the recommended move (see routeCaptain/routeViceCaptain above) -
    // NOT the imported squad's stale is_captain snapshot flag (that was the earlier bug: a player
    // who was captain at import time could be injured and no longer the real recommendation), and
    // NOT the generic captaincy_panel pick either, which doesn't change per recommended transfer.
    captain_pick: routeCaptain,
    vice_captain_pick: routeViceCaptain,
  };
}

function adaptTransferDecision(raw: unknown, fallback: DecisionCentre): DecisionCentre {
  if (!isRecord(raw)) return fallback;
  const outPlayer = backendPlayer(raw.out_player, PLACEHOLDER_PLAYER);
  const inPlayer = backendPlayer(raw.in_player, PLACEHOLDER_PLAYER);
  const move = outPlayer.id && inPlayer.id ? `${outPlayer.name} to ${inPlayer.name}` : "Transfer analysis pending";
  const reasons = asArray(raw.reasons).filter((item): item is string => typeof item === "string");
  const risks = asArray(raw.risks).filter((item): item is string => typeof item === "string");
  const confidence = confidenceFromScore(raw.confidence, fallback.confidence);
  const risk = riskFromScore(raw.risk_change, fallback.risk);
  const expectedGain = asNumber(raw.points_gain_projection, fallback.expected_gain);
  const recommendation = asString(raw.recommendation, fallback.best_move.recommended_action);

  return {
    ...fallback,
    best_move: {
      ...fallback.best_move,
      recommended_action: recommendation,
      move,
      expected_gain: expectedGain,
      confidence_band: confidence,
      risk_level: risk,
      why: reasons.length ? reasons : fallback.best_move.why,
      why_this_could_be_wrong: risks.length ? risks : fallback.best_move.why_this_could_be_wrong,
    },
    expected_gain: expectedGain,
    confidence,
    risk,
    why_this_move: reasons.length ? reasons : fallback.why_this_move,
    what_could_go_wrong: risks.length ? risks : fallback.what_could_go_wrong,
    no_strong_move: Boolean(raw.valid_transfer === false || recommendation.toLowerCase().includes("hold")),
  };
}

function plannerRouteType(raw: Record<string, unknown>, fallback: PlannerRoute["route_type"]): PlannerRoute["route_type"] {
  const routeId = asString(raw.route_id, "").toLowerCase();
  const routeType = asString(raw.route_type, "").toLowerCase();
  if (routeId.includes("roll") || routeType.includes("roll")) return "roll";
  if (routeType.includes("aggressive") || routeType.includes("upside")) return "upside";
  if (asNumber(raw.hit_cost, 0) > 0 || asNumber(raw.risk_score, 0) >= 70) return "risk";
  if (routeType.includes("safe")) return "safe";
  return fallback;
}

function backendTransferCandidate(raw: unknown): TransferCandidate | null {
  if (!isRecord(raw)) return null;
  const outPlayer = backendPlayer(raw.out_player, PLACEHOLDER_PLAYER);
  const inPlayer = backendPlayer(raw.in_player, PLACEHOLDER_PLAYER);
  if (!outPlayer.id || !inPlayer.id) return null;
  return {
    out_player: outPlayer,
    in_player: inPlayer,
    net_projected_gain: asNumber(raw.net_projected_gain, 0),
    recommendation_strength: typeof raw.recommendation_strength === "string" ? raw.recommendation_strength : undefined,
    reasoning: asArray(raw.reasoning).filter((item): item is string => typeof item === "string"),
    why_not_chosen: asArray(raw.why_not_chosen).filter((item): item is string => typeof item === "string"),
  };
}

// Exported so planner-content.tsx's streaming render can adapt a single in-progress route (either
// the growing recommended-route-so-far, or an already-completed alternative) using the exact same
// raw-shape-to-PlannerRoute mapping the final, fully-loaded response uses - one adapter, not two
// that could quietly drift apart.
export function adaptPlannerRoute(raw: unknown, fallback: PlannerRoute): PlannerRoute {
  if (!isRecord(raw)) return fallback;
  const routeType = plannerRouteType(raw, fallback.route_type);
  const risk = riskFromScore(raw.risk_score, fallback.risk);
  const confidence = confidenceFromScore(raw.confidence, fallback.confidence);
  const steps = asArray(raw.gameweek_steps).map((step, index) => {
    const record = isRecord(step) ? step : {};
    const fallbackStep = fallback.steps[index] ?? fallback.steps[0];
    const reasoning = asArray(record.reasoning).filter((item): item is string => typeof item === "string");
    const captainFallback = fallbackStep?.captain ?? PLACEHOLDER_PLAYER;
    const captain = backendPlayer(record.captain, captainFallback);
    const transfersOut = asArray(record.transfers_out)
      .filter(isRecord)
      .map((item) => backendPlayer(item, PLACEHOLDER_PLAYER));
    const transfersIn = asArray(record.transfers_in)
      .filter(isRecord)
      .map((item) => backendPlayer(item, PLACEHOLDER_PLAYER));
    return {
      gw: `GW${asNumber(record.gw, index + 1)}`,
      headline: index === 0 ? asString(raw.summary, fallbackStep?.headline ?? fallback.title) : (reasoning[0] ?? fallbackStep?.headline ?? "Hold route"),
      action: asString(record.action, fallbackStep?.action ?? fallback.title),
      projected_points: (() => {
        const raw = record.projected_points_after ?? record.projected_points;
        if (typeof raw === "number" && Number.isFinite(raw)) return raw;
        return fallbackStep?.projected_points ?? null;
      })(),
      risk,
      captain,
      transfers_out: transfersOut,
      transfers_in: transfersIn,
      reasoning,
      // The backend's own per-GW net_gain (vs the same-week roll baseline) - see PlannerStep's
      // own doc comment for why this must be used as-is rather than recomputed client-side.
      net_gain: typeof record.net_gain === "number" && Number.isFinite(record.net_gain) ? record.net_gain : (fallbackStep?.net_gain ?? null),
      fixture: asString(isRecord(record.captain) ? record.captain.opponent : undefined, fallbackStep?.fixture ?? captain.fixture ?? "TBC"),
      fixture_difficulty: fallbackStep?.fixture_difficulty ?? captain.fixture_difficulty,
      warning: (index === 0 ? reasoning : reasoning.slice(1)).join(" ") || fallbackStep?.warning,
      data_quality_warning: asString(record.data_quality_warning, "") || undefined,
      data_quality_evidence: isRecord(record.data_quality_evidence)
        ? {
            players_total: asNumber(record.data_quality_evidence.players_total, 0),
            players_with_fixture: asNumber(record.data_quality_evidence.players_with_fixture, 0),
            players_missing_or_fallback: asNumber(record.data_quality_evidence.players_missing_or_fallback, 0),
          }
        : undefined,
      transfer_candidates_considered: asArray(record.transfer_candidates_considered)
        .map(backendTransferCandidate)
        .filter((item): item is TransferCandidate => item !== null),
    };
  });
  const validity = isRecord(raw.squad_validity) ? raw.squad_validity : {};
  const warnings = [
    ...asArray(raw.future_consequence_notes).filter((item): item is string => typeof item === "string"),
    ...asArray(validity.issues).filter((item): item is string => typeof item === "string"),
  ];
  const why = steps[0]?.warning ? [steps[0].warning] : warnings.length ? warnings : fallback.why;

  return {
    ...fallback,
    id: asString(raw.route_id, fallback.id),
    title: asString(raw.summary, fallback.title),
    route_type: routeType,
    expected_total_points: asNumber(raw.total_projected_points, fallback.expected_total_points),
    expected_gain: asNumber(raw.net_projected_gain, fallback.expected_gain),
    confidence,
    risk,
    steps: steps.length ? steps : fallback.steps,
    warnings: warnings.length ? warnings : fallback.warnings,
    why,
    why_this_could_be_wrong: warnings.length ? warnings : fallback.why_this_could_be_wrong,
  };
}

function neutralPlannerRoute(fallback: PlannerRoute): PlannerRoute {
  return {
    ...fallback,
    title: "Analysis pending",
    steps: fallback.steps.map((step) => ({
      ...step,
      captain: PLACEHOLDER_PLAYER,
      fixture: "TBC",
      headline: "Analysis pending",
      action: "Analysis pending",
      warning: undefined,
    })),
    why: [],
    warnings: [],
    why_this_could_be_wrong: [],
  };
}

function adaptPlanner(raw: unknown, fallback: MultiGwPlanner): MultiGwPlanner {
  if (!isRecord(raw)) return fallback;
  // Only fall back to the mock/placeholder horizon when the backend didn't send a horizon
  // object at all. When it did, trust gameweeks.length exactly as returned - including 0 or 1
  // near a genuine end-of-season boundary - rather than flooring it to look like a fuller plan
  // than what was actually computed (that was the whole bug: a UI claiming "5-GW" over data
  // that only covered 1).
  const horizonRecord = isRecord(raw.horizon) ? raw.horizon : null;
  const gameweeks = horizonRecord ? asArray(horizonRecord.gameweeks) : [];
  const requestedHorizon = asNumber(raw.requested_horizon, horizonRecord ? asNumber(horizonRecord.requested_horizon, fallback.horizon_requested) : fallback.horizon_requested);
  const resolvedHorizon = horizonRecord ? gameweeks.length : fallback.horizon;
  const clamped = horizonRecord ? Boolean(horizonRecord.clamped) : fallback.horizon_clamped;
  // reason_horizon_clamped is a real, top-level backend field now (not fuzzy-matched out of the
  // warnings array) - it's populated whenever the calendar is stale/unavailable too, not just on
  // an ordinary partial-horizon clamp, so the UI has one reliable place to read the "why" from.
  const clampReason = typeof raw.reason_horizon_clamped === "string" ? raw.reason_horizon_clamped : null;
  const status = typeof raw.status === "string" ? raw.status : fallback.status;
  const lockedPreview = {
    ...fallback.locked_pro_preview,
    steps: (fallback.locked_pro_preview?.steps ?? []).map((step) => ({
      ...step,
      captain: undefined as unknown as typeof step.captain,
      fixture: "TBC",
      headline: "Pro preview",
      action: "Upgrade to unlock 5-GW plan",
      warning: undefined,
    })),
  };

  // When the backend explicitly refused to plan (status !== "ok"), recommended_route/
  // alternative_routes are genuinely {}/[] - do NOT substitute the mock-derived
  // neutralPlannerRoute() fallback here, since that produces a route-shaped object that looks
  // like a real (if generic) plan. PlannerContent branches on `status` before ever rendering
  // route cards, so these can stay empty; adaptPlannerRoute would choke on an empty {} anyway.
  const rawRecommended = raw.recommended_route;
  const hasRoute = isRecord(rawRecommended) && asArray(rawRecommended.gameweek_steps).length > 0;
  const recommended =
    status === "ok" && !hasRoute
      ? neutralPlannerRoute(fallback.recommended_route)
      : hasRoute
        ? adaptPlannerRoute(rawRecommended, fallback.recommended_route)
        : emptyPlannerRoute();

  const rawAlternatives = asArray(raw.alternative_routes).filter((r) => isRecord(r) && asArray((r as Record<string, unknown>).gameweek_steps).length > 0);
  const alternativeRoutes = rawAlternatives
    .map((route, index) => adaptPlannerRoute(route, fallback.alternative_routes[index] ?? fallback.alternative_routes[0] ?? fallback.recommended_route))
    .slice(0, 4);

  return {
    ...fallback,
    status,
    horizon: resolvedHorizon,
    horizon_requested: requestedHorizon,
    horizon_clamped: clamped,
    horizon_clamp_reason: clampReason,
    current_gameweek: typeof raw.current_gameweek === "number" ? raw.current_gameweek : fallback.current_gameweek,
    max_fixture_gameweek: typeof raw.max_fixture_gameweek === "number" ? raw.max_fixture_gameweek : fallback.max_fixture_gameweek,
    fixture_calendar_available: typeof raw.fixture_calendar_available === "boolean" ? raw.fixture_calendar_available : fallback.fixture_calendar_available,
    fixture_calendar_stale: typeof raw.fixture_calendar_stale === "boolean" ? raw.fixture_calendar_stale : fallback.fixture_calendar_stale,
    season_status: typeof raw.season_status === "string" ? raw.season_status : fallback.season_status,
    fixture_season: typeof raw.fixture_season === "string" ? raw.fixture_season : fallback.fixture_season,
    recommended_route: recommended,
    alternative_routes:
      status === "ok" ? (alternativeRoutes.length ? alternativeRoutes : fallback.alternative_routes.map(neutralPlannerRoute)) : [],
    locked_pro_preview: lockedPreview,
    is_preview: raw.is_preview === true,
  };
}

export function emptyPlannerRoute(): PlannerRoute {
  return {
    id: "unavailable",
    title: "",
    route_type: "safe",
    expected_total_points: 0,
    expected_gain: 0,
    confidence: "Low",
    risk: "Low",
    steps: [],
    warnings: [],
    why: [],
    why_this_could_be_wrong: [],
  };
}

function adaptMarketBoard(raw: unknown, fallback: MarketBoard): MarketBoard {
  if (!isRecord(raw)) return fallback;
  const rising = asArray(raw.rising_assets ?? raw.buy_now);
  const falling = asArray(raw.falling_assets ?? raw.sell_watch);
  const owned = asArray(raw.owned_player_alerts);
  const all = [...rising, ...falling, ...asArray(raw.avoid_traps), ...owned];

  return {
    ...fallback,
    rising_players: rising.map((signal, index) => backendSignal(signal, fallback.rising_players[index] ?? fallback.market_alerts[0])).slice(0, 10),
    falling_players: falling.map((signal, index) => backendSignal(signal, fallback.falling_players[index] ?? fallback.market_alerts[0])).slice(0, 10),
    owned_squad_alerts: owned.length ? owned.map((signal, index) => backendSignal(signal, fallback.owned_squad_alerts[index] ?? fallback.market_alerts[0])) : [],
    market_alerts: all.length ? all.map((signal, index) => backendSignal(signal, fallback.market_alerts[index] ?? fallback.market_alerts[0])).slice(0, 20) : [],
  };
}

function comparisonPlayer(raw: unknown, fallback: Player): Player {
  if (!isRecord(raw)) return fallback;
  const metrics = isRecord(raw.key_metrics) ? raw.key_metrics : {};
  const player = backendPlayer(
    {
      ...raw,
      projected_points: raw.projected_points ?? raw.expected_points ?? metrics.projection_engine_next_gw_projected_points ?? metrics.expected_points ?? metrics.projected_points,
      three_gw_projected: raw.three_gw_projected ?? metrics.projection_engine_horizon_total_projected_points ?? metrics.horizon_total_projected_points ?? metrics.three_gw_projection,
      fixture_difficulty: raw.fixture_difficulty ?? metrics.fixture_difficulty,
      form: raw.form ?? metrics.form,
    },
    fallback,
  );
  return { ...player, id: player.id ?? fallback.id, api_id: player.api_id ?? fallback.api_id };
}

function metricPair(playerA: Player, playerB: Player): PlayerComparison["metrics"] {
  return {
    projected_next_gw: [playerA.projected, playerB.projected],
    three_gw_projection: [playerA.three_gw_projected ?? null, playerB.three_gw_projected ?? null],
    fixture_difficulty: [playerA.fixture_difficulty ?? 3, playerB.fixture_difficulty ?? 3],
    minutes_risk: [playerA.risk, playerB.risk],
    ownership: [playerA.ownership ?? 0, playerB.ownership ?? 0],
    form: [playerA.form ?? 0, playerB.form ?? 0],
    stock_signal: [signalFromDecision(playerA.role), signalFromDecision(playerB.role)],
  };
}

function adaptComparison(raw: unknown, fallback: PlayerComparison): PlayerComparison {
  if (!isRecord(raw)) return fallback;
  const players = asArray(raw.players).filter(isRecord);
  const neutralA = { ...fallback.player_a, fixture: "TBC" };
  const neutralB = { ...fallback.player_b, fixture: "TBC" };
  const playerA = comparisonPlayer(players[0], neutralA);
  const playerB = comparisonPlayer(players[1], neutralB);
  const notes = asArray(raw.comparison_notes).filter((item): item is string => typeof item === "string");
  const bestBuy = isRecord(raw.best_buy) ? comparisonPlayer(raw.best_buy, fallback.verdict.winner) : fallback.verdict.winner;
  const winnerApiId = bestBuy.api_id;
  const winner = winnerApiId === playerB.api_id ? playerB : winnerApiId === playerA.api_id ? playerA : bestBuy;

  return {
    ...fallback,
    player_a: playerA,
    player_b: playerB,
    metrics: metricPair(playerA, playerB),
    verdict: {
      ...fallback.verdict,
      winner,
      summary: notes.join(" ") || fallback.verdict.summary,
      confidence: confidenceFromScore(isRecord(raw.best_buy) ? raw.best_buy.confidence : undefined, fallback.verdict.confidence),
      risk: winner.risk,
      why: notes.length ? notes : fallback.verdict.why,
    },
  };
}

function adaptReview(raw: unknown, fallback: ReviewAudit): ReviewAudit {
  if (!isRecord(raw)) return fallback;
  const summary = isRecord(raw.command_centre_metrics) ? raw.command_centre_metrics : {};
  const successRate = typeof summary.success_rate === "number" ? `${Math.round(summary.success_rate * 100)}% success rate` : "No evaluated sample yet";
  return {
    ...fallback,
    last_gw_recommendation: "",
    captain_result: "",
    transfer_result: "",
    actual_outcome: successRate,
    model_note: asArray(raw.warnings).join(" ") || fallback.model_note,
    result: typeof summary.success_rate === "number" ? (summary.success_rate >= 0.6 ? "Good call" : summary.success_rate >= 0.4 ? "Neutral" : "Bad call") : "Neutral",
  };
}

function adaptTrust(raw: unknown, fallback: ModelTrust): ModelTrust {
  if (!isRecord(raw)) return fallback;
  const modelType = asString(raw.projection_model_type, "model-backed");
  const fallbackUsed = Boolean(raw.fallback_used);
  return {
    ...fallback,
    prediction_system: `Active prediction system: ${modelType}. ${fallback.prediction_system}`,
    fallback_warning: fallbackUsed ? `Fallback is active: ${asString(raw.fallback_reason, "backend reported fallback mode")}.` : "Live projection status reports no fallback flag.",
    previous_model_comparison: asString(raw.active_trained_model_version ?? raw.trained_model_version, "") ? `Active trained model version: ${asString(raw.active_trained_model_version ?? raw.trained_model_version)}.` : fallback.previous_model_comparison,
  };
}

export async function getBackendHealth(): Promise<DataSourceStatus> {
  const result = await requestJson("/health", { apiName: "getBackendHealth" }, { status: "unavailable", database: "unavailable" });
  return result.source.mode === "real" ? dataSource("real", "/health") : dataSource("unavailable", "/health", result.source.detail);
}

export async function getProjectionStatus() {
  return requestJson("/projections/status", { apiName: "getProjectionStatus" }, { status: "mock", projection_model_type: "trained_hybrid", fallback_used: true, fallback_reason: "Development mock fallback" });
}

export async function getGameweekCommandCentre(payload: Record<string, unknown> = {}, options: RequestOptions = {}): Promise<ApiResult<CommandCentre>> {
  return requestJson(
    "/gameweek-command-centre/dashboard",
    { ...options, method: "POST", body: JSON.stringify(payload), apiName: options.apiName ?? "getGameweekCommandCentre", disableFallback: true },
    commandCentre,
    adaptCommandCentre,
  );
}

// Unnormalized dashboard response — needed when the raw backend field names
// (best_move_panel, captaincy_panel, deadline_summary, ...) must be forwarded
// as-is, e.g. into /recommendation-audit/snapshot's recommendation_payload.
export async function getGameweekCommandCentreRaw(payload: Record<string, unknown> = {}, options: RequestOptions = {}): Promise<ApiResult<Record<string, unknown>>> {
  return requestJson(
    "/gameweek-command-centre/dashboard",
    { ...options, method: "POST", body: JSON.stringify(payload), apiName: options.apiName ?? "getGameweekCommandCentreRaw" },
    {},
  );
}

export async function analyseSquad(payload: Record<string, unknown> = {}): Promise<ApiResult<{ squad_health: SquadHealthDiagnostics["health"] }>> {
  return requestJson(
    "/squad-health/analyse",
    { method: "POST", body: JSON.stringify(payload), apiName: "analyseSquad", disableFallback: true },
    { squad_health: commandCentre.squad_health },
  );
}

export async function getSquadHealthDiagnostics(payload: Record<string, unknown> = {}): Promise<ApiResult<SquadHealthDiagnostics>> {
  return requestJson("/squad-health/analyse", { method: "POST", body: JSON.stringify(payload), apiName: "getSquadHealthDiagnostics", disableFallback: true }, squadHealthDiagnostics, adaptSquadDiagnostics);
}

// Same endpoint/cache entry as getSquadHealthDiagnostics (same payload hashes to the same
// persisted analysis, so this never triggers a second compute) - just surfaces the per-player
// projections it already returns as real Player objects, for callers that need real projected
// points/ownership per squad player rather than the summarised health/issues view.
export async function getSquadPlayerProjections(payload: Record<string, unknown> = {}): Promise<ApiResult<Player[]>> {
  return requestJson<Player[]>(
    "/squad-health/analyse",
    { method: "POST", body: JSON.stringify(payload), apiName: "getSquadPlayerProjections", disableFallback: true },
    [],
    (raw) => {
      if (!isRecord(raw)) return [];
      return asArray(raw.players)
        .filter(isRecord)
        .map((entry) => backendPlayer({ ...entry, ...(isRecord(entry.decision_centre_card) ? entry.decision_centre_card : {}) }, PLACEHOLDER_PLAYER));
    },
  );
}

// Historical/saved view: re-analyses whatever squad was saved for entry_id at a
// past gameweek, instead of the live squad the frontend already holds in memory.
export async function getSavedSquadHealth(entryId: string, gameweek?: number): Promise<ApiResult<SquadHealthDiagnostics>> {
  const query = gameweek ? `?gameweek=${encodeURIComponent(String(gameweek))}` : "";
  return requestJson(
    `/squad-health/${encodeURIComponent(entryId)}${query}`,
    { apiName: "getSavedSquadHealth", disableFallback: true },
    squadHealthDiagnostics,
    adaptSquadDiagnostics,
  );
}

export async function getCaptaincyCentre(payload: Record<string, unknown> = {}): Promise<ApiResult<CaptaincyCentre>> {
  return requestJson("/gameweek-command-centre/dashboard", { method: "POST", body: JSON.stringify(payload), apiName: "getCaptaincyCentre", disableFallback: true }, captaincyCentre, adaptCaptaincyCentre);
}

export async function getDecisionSummary() {
  return requestJson("/decision-centre/summary", { apiName: "getDecisionSummary" }, { top_buys: [], top_sells: [], top_avoids: [] });
}

export async function getDecisionRecommendations() {
  return requestJson("/decision-centre/recommendations", { apiName: "getDecisionRecommendations" }, { buy: [], sell: [], watch: [] });
}

export async function getDecisionCentre(payload: Record<string, unknown> = {}, options: RequestOptions = {}): Promise<ApiResult<DecisionCentre>> {
  return requestJson("/gameweek-command-centre/dashboard", { ...options, method: "POST", body: JSON.stringify(payload), apiName: options.apiName ?? "getDecisionCentre", disableFallback: true }, decisionCentre, adaptDecisionCentre);
}

// Adapts a raw in-progress dashboard_full snapshot (see /analysis/status's per-type `payload`,
// and gameweek_command_centre.build_gameweek_dashboard's on_progress on the backend) into the
// exact same DecisionCentre shape the completed response uses - reuses adaptDecisionCentre
// directly rather than a separate partial-only adapter, since adaptCommandCentre already
// tolerates whichever panels aren't ready yet (see its own comment on why the best_move_panel-
// only guard was widened). Lets progressive rendering share the same render tree as the final
// "ready" result instead of a bespoke streaming-only view.
export function adaptDecisionCentrePartial(raw: Record<string, unknown>): DecisionCentre {
  return adaptDecisionCentre(raw, decisionCentre);
}

export async function getTransferDecisionCentre(outPlayerId: number, inPlayerId: number): Promise<ApiResult<DecisionCentre>> {
  const query = new URLSearchParams({
    out_player_id: String(outPlayerId),
    in_player_id: String(inPlayerId),
  });
  return requestJson(`/decision-centre/transfer-decision?${query.toString()}`, { apiName: "getTransferDecisionCentre", disableFallback: true }, decisionCentre, adaptTransferDecision);
}

export async function analyseScenario(payload: Record<string, unknown>) {
  const emptyScenarioRoute: TransferRoute = {
    id: "pending-scenario",
    title: "Analysis pending",
    move: "Analysis pending",
    expected_gain: 0,
    confidence: "Low",
    risk: "Low",
    why: ["Backend scenario analysis is still running."],
    why_this_could_be_wrong: [],
    route_type: "roll",
  };
  return requestJson(
    "/scenario-simulator/analyse",
    { method: "POST", body: JSON.stringify(payload), apiName: "analyseScenario" },
    { ranked_scenarios: [emptyScenarioRoute] },
    (raw, fallback) => {
      if (isRecord(raw) && Array.isArray(raw.ranked_scenarios)) {
        return {
          ranked_scenarios: raw.ranked_scenarios.map((route, index) =>
            backendRoute(route, fallback.ranked_scenarios[index] ?? fallback.ranked_scenarios[0]),
          ),
        };
      }
      return fallback;
    },
  );
}

export type ScenarioSavedSimulation = {
  simulation_id: number;
  user_id: string | null;
  created_at: string | null;
  simulation: Record<string, unknown>;
};

const emptySavedSimulation: ScenarioSavedSimulation = { simulation_id: 0, user_id: null, created_at: null, simulation: {} };

export type ScenarioCardPlayer = {
  player_id: number;
  web_name: string;
  team: string | null;
  team_short_name: string | null;
  position: string | null;
  code: number | null;
  price: number | null;
  decision: string | null;
  captaincy_score: number | null;
  expected_points: number;
  risk_level: string | null;
};

export type ScenarioCustomResult = {
  valid: boolean;
  reasons: string[];
  risks: string[];
  invalid_reasons: string[];
  what_to_monitor: string[];
  confidence: number;
  projected_points: number;
  projected_points_delta: number;
  hit_cost: number;
  net_projected_gain_after_hit: number;
  risk_delta: number;
  squad_health_delta: number;
  out_player: ScenarioCardPlayer | null;
  in_player: ScenarioCardPlayer | null;
  captain: ScenarioCardPlayer | null;
  vice_captain: ScenarioCardPlayer | null;
};

const emptyScenarioCustomResult: ScenarioCustomResult = {
  valid: false,
  reasons: [],
  risks: [],
  invalid_reasons: [],
  what_to_monitor: [],
  confidence: 0,
  projected_points: 0,
  projected_points_delta: 0,
  hit_cost: 0,
  net_projected_gain_after_hit: 0,
  risk_delta: 0,
  squad_health_delta: 0,
  out_player: null,
  in_player: null,
  captain: null,
  vice_captain: null,
};

// The scenario response carries two different shapes for a "player": the shallow catalog meta
// on transfer.out_player/in_player (identity + price only, no projection at all) and the full
// decision-centre card on transfer.decision.out_player/in_player and scenario.captain/vice_captain
// (identity + key_metrics.projection_engine_next_gw_projected_points). Reading the shallow one
// for the transfer players is what silently produced "0.0 pts" for a real, valid transfer during
// verification - the number was never missing from the API, it was one level too shallow.
function scenarioCardPlayer(raw: unknown): ScenarioCardPlayer | null {
  if (!isRecord(raw)) return null;
  const metrics = isRecord(raw.key_metrics) ? raw.key_metrics : {};
  const expectedPoints =
    typeof metrics.projection_engine_next_gw_projected_points === "number"
      ? metrics.projection_engine_next_gw_projected_points
      : typeof metrics.expected_points === "number"
        ? metrics.expected_points
        : asNumber(raw.expected_points, 0);
  return {
    player_id: asNumber(raw.player_id, 0),
    web_name: asString(raw.web_name, "Unknown"),
    team: typeof raw.team === "string" ? raw.team : null,
    team_short_name: typeof raw.team_short_name === "string" ? raw.team_short_name : null,
    position: typeof raw.position === "string" ? raw.position : null,
    code: typeof raw.code === "number" ? raw.code : null,
    price: typeof raw.price === "number" ? raw.price : null,
    decision: typeof raw.decision === "string" ? raw.decision : null,
    captaincy_score: typeof raw.captaincy_score === "number" ? raw.captaincy_score : null,
    expected_points: expectedPoints,
    risk_level: typeof raw.risk_level === "string" ? raw.risk_level : null,
  };
}

function stringArray(value: unknown): string[] {
  return asArray(value).filter((item): item is string => typeof item === "string");
}

// Unlike analyseScenario() (which only surfaces the lossy ranked_scenarios summary used for the
// auto-generated recommendation card), this hits the exact same /scenario-simulator/analyse
// endpoint but keeps the single custom scenario's full per-player breakdown (out/in/captain/vice
// cards, validity, real reasons) intact - what the Scenario Builder's own Out/In/Captain/Vice
// cards need to render genuine data instead of a client-side stub lookup. disableFallback: true
// because a silent mock fallback here would hide a real backend rejection (e.g. an invalid
// transfer) behind fake "success" numbers.
export async function analyseCustomScenario(payload: Record<string, unknown>): Promise<ApiResult<ScenarioCustomResult>> {
  return requestJson<ScenarioCustomResult>(
    "/scenario-simulator/analyse",
    { method: "POST", body: JSON.stringify(payload), apiName: "analyseCustomScenario", disableFallback: true },
    emptyScenarioCustomResult,
    (raw) => {
      if (!isRecord(raw) || !Array.isArray(raw.scenarios) || !raw.scenarios.length) return emptyScenarioCustomResult;
      const scenario = raw.scenarios[0];
      if (!isRecord(scenario)) return emptyScenarioCustomResult;
      const transfers = Array.isArray(scenario.transfers) ? scenario.transfers : [];
      const transfer = isRecord(transfers[0]) ? (transfers[0] as Record<string, unknown>) : null;
      const decision = transfer && isRecord(transfer.decision) ? transfer.decision : null;
      const outCard = (decision?.out_player as unknown) ?? transfer?.out_player;
      const inCard = (decision?.in_player as unknown) ?? transfer?.in_player;
      return {
        valid: Boolean(scenario.valid),
        reasons: stringArray(scenario.reasons),
        risks: stringArray(scenario.risks),
        invalid_reasons: stringArray(scenario.invalid_reasons),
        what_to_monitor: stringArray(scenario.what_to_monitor),
        confidence: asNumber(scenario.confidence, 0),
        projected_points: asNumber(scenario.projected_points, 0),
        projected_points_delta: asNumber(scenario.projected_points_delta, 0),
        hit_cost: asNumber(scenario.hit_cost, 0),
        net_projected_gain_after_hit: asNumber(scenario.net_projected_gain_after_hit, 0),
        risk_delta: asNumber(scenario.risk_delta, 0),
        squad_health_delta: asNumber(scenario.squad_health_delta, 0),
        out_player: transfer ? scenarioCardPlayer(outCard) : null,
        in_player: transfer ? scenarioCardPlayer(inCard) : null,
        captain: scenarioCardPlayer(scenario.captain),
        vice_captain: scenarioCardPlayer(scenario.vice_captain),
      };
    },
  );
}

export async function saveScenarioSimulation(payload: Record<string, unknown>): Promise<ApiResult<ScenarioSavedSimulation>> {
  return requestJson(
    "/scenario-simulator/save",
    { method: "POST", body: JSON.stringify(payload), apiName: "saveScenarioSimulation", disableFallback: true },
    emptySavedSimulation,
  );
}

export async function getSavedScenarioSimulation(simulationId: number): Promise<ApiResult<ScenarioSavedSimulation>> {
  return requestJson(
    `/scenario-simulator/${simulationId}`,
    { apiName: "getSavedScenarioSimulation", disableFallback: true },
    emptySavedSimulation,
  );
}

export async function planMultiGw(payload: Record<string, unknown> = {}): Promise<ApiResult<MultiGwPlanner>> {
  // Measured ~30-38s cold under real-world concurrent load (dashboard's own lightweight+full
  // fetch racing this same request right after import), and up to ~117s in a synthetic
  // worst-case with 6 heavy backend calls contending simultaneously. 60s left too little
  // headroom and could abort a genuinely in-progress, real computation right before it
  // finished - that's what forced the "did not finish" fallback. Match the outer tab timeout
  // (TAB_TIMEOUT_MS) so this inner AbortController is no longer the limiting factor.
  const requestBody = JSON.stringify(payload);
  const dedupeKey = `multi-gw-planner:${requestBody}`;
  const recent = plannerRecentResults.get(dedupeKey);
  if (recent && recent.expiresAt > Date.now()) return recent.result;

  const inFlight = plannerInFlightRequests.get(dedupeKey);
  if (inFlight) return inFlight;

  const request = requestJson(
    "/multi-gw-planner/plan",
    // disableFallback: true - without it, a timeout in dev mode silently returns the mock
    // multiGwPlanner object instead of throwing. usePlannerAnalysis can't tell that apart from
    // a genuine completed result (no analysisStatus field on either), so it would mark itself
    // settled and show fake data as final, forever - found live: a queue jam holding this
    // request past 120s did exactly that.
    { method: "POST", body: requestBody, apiName: "planMultiGw", timeoutMs: 120000, disableFallback: true },
    multiGwPlanner,
    adaptPlanner,
  )
    .then((result) => {
      plannerRecentResults.set(dedupeKey, { expiresAt: Date.now() + PLANNER_REQUEST_DEDUPE_MS, result });
      return result;
    })
    .finally(() => {
      plannerInFlightRequests.delete(dedupeKey);
    });

  plannerInFlightRequests.set(dedupeKey, request);
  return request;
}

export async function getMultiGwPlannerPreview(payload: Record<string, unknown> = {}): Promise<ApiResult<MultiGwPlanner>> {
  // Fast recommended-route-only preview (see backend's plan_multi_gw_recommended_preview) - for
  // progressive loading, planner-content.tsx polls this alongside planMultiGw() and shows
  // whichever resolves first. Reuses the same in-flight/recent-result dedupe Maps as planMultiGw
  // under a distinct key prefix so the two endpoints never collide or reuse each other's result.
  const requestBody = JSON.stringify(payload);
  const dedupeKey = `multi-gw-planner-preview:${requestBody}`;
  const recent = plannerRecentResults.get(dedupeKey);
  if (recent && recent.expiresAt > Date.now()) return recent.result;

  const inFlight = plannerInFlightRequests.get(dedupeKey);
  if (inFlight) return inFlight;

  const request = requestJson(
    "/multi-gw-planner/preview",
    // disableFallback: true - see planMultiGw's identical comment above.
    { method: "POST", body: requestBody, apiName: "getMultiGwPlannerPreview", timeoutMs: 120000, disableFallback: true },
    multiGwPlanner,
    adaptPlanner,
  )
    .then((result) => {
      plannerRecentResults.set(dedupeKey, { expiresAt: Date.now() + PLANNER_REQUEST_DEDUPE_MS, result });
      return result;
    })
    .finally(() => {
      plannerInFlightRequests.delete(dedupeKey);
    });

  plannerInFlightRequests.set(dedupeKey, request);
  return request;
}

export async function getAnalysisStatus(entryId: string, gameweek?: number): Promise<ApiResult<AnalysisStatus>> {
  const query = gameweek ? `?gameweek=${encodeURIComponent(String(gameweek))}` : "";
  return requestJson<AnalysisStatus>(
    `/analysis/status/${encodeURIComponent(entryId)}${query}`,
    { apiName: "getAnalysisStatus", disableFallback: true },
    { entry_id: entryId, gameweek: gameweek ?? null, analysis: {}, all_done: false },
  );
}

export async function getStockMarket(params: Record<string, string | number> = {}): Promise<ApiResult<{ market_alerts: MarketSignal[] }>> {
  const query = new URLSearchParams(Object.entries(params).map(([key, value]) => [key, String(value)]));
  const suffix = query.size ? `?${query.toString()}` : "";
  // disableFallback: true - see planMultiGw's comment: without it, a timeout in dev mode
  // silently returns mock data indistinguishable from a genuine completed result to
  // usePolledAnalysis, which then stops polling forever on fake data.
  return requestJson(`/player-stock-market/market${suffix}`, { apiName: "getStockMarket", timeoutMs: 60000, disableFallback: true }, { market_alerts: [] as MarketSignal[] }, (raw, fallback) => {
    if (isRecord(raw)) {
      const rows = [...asArray(raw.buy_now), ...asArray(raw.sell_watch), ...asArray(raw.rising_assets)];
      return { market_alerts: rows.map((signal, index) => backendSignal(signal, fallback.market_alerts[index] ?? marketSignals[0])) };
    }
    return fallback;
  });
}

export async function getMarketBoard(params: Record<string, string | number> = {}): Promise<ApiResult<MarketBoard>> {
  const query = new URLSearchParams(Object.entries(params).map(([key, value]) => [key, String(value)]));
  const suffix = query.size ? `?${query.toString()}` : "";
  // disableFallback: true - see getStockMarket's identical comment above.
  return requestJson(`/player-stock-market/market${suffix}`, { apiName: "getMarketBoard", timeoutMs: 60000, disableFallback: true }, marketBoard, adaptMarketBoard);
}

export async function analyseStockMarketSquad(payload: Record<string, unknown> = {}): Promise<ApiResult<{ owned_player_alerts: MarketSignal[] }>> {
  return requestJson("/player-stock-market/squad", { method: "POST", body: JSON.stringify(payload), apiName: "analyseStockMarketSquad" }, { owned_player_alerts: [] as MarketSignal[] }, (raw, fallback) => {
    if (isRecord(raw) && Array.isArray(raw.owned_player_alerts)) {
      return { owned_player_alerts: raw.owned_player_alerts.map((signal, index) => backendSignal(signal, fallback.owned_player_alerts[index] ?? marketSignals[0])) };
    }
    return fallback;
  });
}

export async function getPlayerComparison(playerIds: number[] = [7, 101]): Promise<ApiResult<PlayerComparison>> {
  const safeIds = playerIds.length ? playerIds : [7, 101];
  return requestJson(`/decision-centre/compare?player_ids=${safeIds.join(",")}`, { apiName: "getPlayerComparison", disableFallback: true, throwOnPending: true }, playerComparison, adaptComparison);
}

export type PlayerDirectoryEntry = {
  player_id: number;
  web_name: string;
  team_short_name: string;
  position: string;
};

// Bare identity list (id/name/team/position) for every real player in the league - used by
// UI pickers like Market's "Compare" dropdown that need every player grouped by club, not just
// the imported squad. Deliberately not the heavier /players list (full decision/projection
// payload per player, multi-MB for the whole league) - this is name/team/position only.
export async function getPlayersDirectory(): Promise<ApiResult<PlayerDirectoryEntry[]>> {
  return requestJson<PlayerDirectoryEntry[]>(
    "/players/directory",
    { apiName: "getPlayersDirectory" },
    [],
    (raw) => {
      if (!Array.isArray(raw)) return [];
      return raw
        .filter(isRecord)
        .map((item) => ({
          player_id: asNumber(item.player_id, 0),
          web_name: asString(item.web_name, ""),
          team_short_name: asString(item.team_short_name, ""),
          position: asString(item.position, "MID"),
        }))
        .filter((entry) => entry.player_id > 0 && entry.web_name && entry.team_short_name);
    },
  );
}

// Deeper per-player breakdown than /decision-centre/compare's card-level fields:
// trend/fixture/role/market analysis plus the underlying evidence.
export async function getPlayerDecisionBreakdown(playerId: number): Promise<ApiResult<Record<string, unknown>>> {
  return requestJson(`/decision-centre/player/${playerId}`, { apiName: "getPlayerDecisionBreakdown", disableFallback: true }, {});
}

// Projection provenance for a single player: which model/fallback produced the number,
// confidence, and per-gameweek point components - not shown anywhere else in the UI.
export async function getPlayerProjectionDetail(playerId: number): Promise<ApiResult<Record<string, unknown>>> {
  return requestJson(`/projections/player/${playerId}`, { apiName: "getPlayerProjectionDetail", disableFallback: true }, {});
}

export async function getDecisionVariables(): Promise<ApiResult<Record<string, unknown>>> {
  return requestJson("/decision-centre/variables", { apiName: "getDecisionVariables", disableFallback: true }, {});
}

export async function getWatchlist(): Promise<ApiResult<Watchlist>> {
  return futureResult({ ...watchlist, saved_players: [] }, "TODO /watchlist", "No watchlist persistence endpoint exists yet.");
}

export async function getRecommendationReview(): Promise<ApiResult<ReviewAudit>> {
  return requestJson("/recommendation-audit/report", { apiName: "getRecommendationReview", disableFallback: true, throwOnPending: true }, reviewAudit, adaptReview);
}

export async function getModelTrust(): Promise<ApiResult<ModelTrust>> {
  return requestJson("/projections/status", { apiName: "getModelTrust", disableFallback: true, throwOnPending: true }, modelTrust, adaptTrust);
}

export type ProjectionComputeResult = {
  model_version: string;
  from_gw: number;
  to_gw: number;
  persist: boolean;
  force: boolean;
  players_considered: number;
  projections_computed: number;
  rows_inserted: number;
  rows_updated: number;
  rows_skipped_existing: number;
  external_provider_calls: string[];
};

export async function computeProjections(payload: Record<string, unknown>): Promise<ApiResult<ProjectionComputeResult>> {
  const fallback: ProjectionComputeResult = {
    model_version: "",
    from_gw: asNumber(payload.from_gw, 1),
    to_gw: asNumber(payload.to_gw, asNumber(payload.from_gw, 1)),
    persist: false,
    force: false,
    players_considered: 0,
    projections_computed: 0,
    rows_inserted: 0,
    rows_updated: 0,
    rows_skipped_existing: 0,
    external_provider_calls: [],
  };
  return requestJson(
    // A full, unfiltered recompute across all players/gameweeks measured at ~80s locally;
    // give it real headroom instead of the default request timeout.
    "/projections/compute",
    { method: "POST", body: JSON.stringify(payload), apiName: "computeProjections", disableFallback: true, timeoutMs: 180000 },
    fallback,
  );
}

export type RecommendationSnapshotResult = {
  status: string;
  audit_id?: string;
  stored?: boolean;
};

export async function createRecommendationSnapshot(payload: Record<string, unknown>): Promise<ApiResult<RecommendationSnapshotResult>> {
  return requestJson(
    "/recommendation-audit/snapshot",
    { method: "POST", body: JSON.stringify(payload), apiName: "createRecommendationSnapshot", disableFallback: true },
    { status: "unavailable" },
  );
}

export async function getProjectionTrainingStatus(): Promise<ApiResult<Record<string, unknown>>> {
  return requestJson("/projection-training/status", { apiName: "getProjectionTrainingStatus", disableFallback: true }, {});
}

export async function getProjectionModels(): Promise<ApiResult<{ models: Record<string, unknown>[] }>> {
  return requestJson("/projection-training/models", { apiName: "getProjectionModels", disableFallback: true }, { models: [] });
}

export async function runProjectionTraining(payload: Record<string, unknown> = {}): Promise<ApiResult<Record<string, unknown>>> {
  return requestJson(
    // A default full-dataset training run measured at ~4 minutes locally.
    "/projection-training/train",
    { method: "POST", body: JSON.stringify(payload), apiName: "runProjectionTraining", disableFallback: true, timeoutMs: 360000 },
    {},
  );
}

export async function getBacktestStatus(): Promise<ApiResult<Record<string, unknown>>> {
  return requestJson("/backtest/status", { apiName: "getBacktestStatus", disableFallback: true }, {});
}

export async function getBacktestRuns(limit = 5): Promise<ApiResult<Record<string, unknown>[]>> {
  return requestJson(`/backtest/runs?limit=${limit}`, { apiName: "getBacktestRuns", disableFallback: true }, []);
}

export async function runProjectionsBacktest(payload: Record<string, unknown>): Promise<ApiResult<Record<string, unknown>>> {
  return requestJson(
    "/backtest/projections",
    { method: "POST", body: JSON.stringify(payload), apiName: "runProjectionsBacktest", disableFallback: true, timeoutMs: 120000 },
    {},
  );
}

export async function importTeam(teamId: string, event?: number): Promise<ApiResult<ImportTeamResponse>> {
  if (!teamId.trim()) {
    throw new Error("Enter a valid FPL Team ID.");
  }
  const query = event ? `?event=${encodeURIComponent(String(event))}` : "";
  return requestJson(`/squad-health/import/${encodeURIComponent(teamId.trim())}${query}`, { apiName: "importTeam", timeoutMs: 120000, disableFallback: true }, {
    entry_id: teamId.trim(),
    gameweek: event ?? 1,
    saved: false,
    source: "mock",
    bank: null,
    entry_history: {},
    squad: [],
  });
}

export async function getImportTeamData(teamId: string, event?: number): Promise<ApiResult<ImportTeamResponse>> {
  const entryId = teamId.trim();
  if (!entryId) {
    throw new Error("Enter a valid FPL Team ID.");
  }

  const query = new URLSearchParams({ entry_id: entryId });
  if (event) query.set("event", String(event));
  const endpoint = `/api/import-team-data?${query.toString()}`;

  try {
    const response = await fetch(endpoint, { cache: "no-store" });
    if (!response.ok) {
      let detail = response.statusText;
      try {
        const text = await response.text();
        if (text) detail = text.slice(0, 500);
      } catch {
        // Keep statusText when the error body cannot be read.
      }
      throw new ApiRequestError({ apiName: "getImportTeamData", endpoint, status: response.status, detail });
    }

    return {
      data: await response.json() as ImportTeamResponse,
      source: dataSource("real", endpoint),
    };
  } catch (error) {
    if (error instanceof ApiRequestError) throw error;
    throw new ApiRequestError({
      apiName: "getImportTeamData",
      endpoint,
      detail: error instanceof Error ? error.message : "Import team data request failed",
    });
  }
}
