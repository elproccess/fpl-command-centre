import { cache } from "react";
import { cookies } from "next/headers";
import {
  analyseScenario,
  analyseStockMarketSquad,
  getCaptaincyCentre,
  getDecisionCentre,
  getGameweekCommandCentre,
  getMarketBoard,
  getModelTrust,
  getPlayerComparison,
  getProjectionStatus,
  getRecommendationReview,
  getSquadHealthDiagnostics,
  getWatchlist,
  importTeam,
  planMultiGw,
} from "./api";

import {
  appStateFromImport,
  commandCentrePayloadFromImport,
  FPL_ENTRY_COOKIE,
  FPL_EVENT_COOKIE,
  importedTeamFromResponse,
  IMPORTED_TEAM_ENTRY_COOKIE,
  IMPORTED_TEAM_EVENT_COOKIE,
  playersFromImport,
} from "./imported-team";
import { pricingTiers, usageState } from "./mock";
// Pure helpers with no next/headers dependency, shared with squad/page.tsx's client-side roster
// loading (see squad-roster-shared.ts's own comment on why this split exists).
import {
  healthSource,
  importedOnlyDiagnostics,
  importedSafeDiagnostics,
  mergeSources,
  TAB_TIMEOUT_MS,
  unavailableSource,
  unwrap,
  withTabTimeout,
} from "./squad-roster-shared";
import type {
  ApiResult,
  CaptaincyCentre,
  CaptaincyOption,
  CommandCentre,
  DataSourceStatus,
  DecisionCentre,
  MarketBoard,
  MarketSignal,
  ModelTrust,
  MultiGwPlanner,
  Player,
  PlayerComparison,
  PlannerRoute,
  PlannerStep,
  ReviewAudit,
  SquadHealthDiagnostics,
  SquadIssue,
  TransferRoute,
  UserGameState,
  Watchlist,
} from "./types";

// Deduplicate importTeam within a single render tree — both loadPageContext (fast shell)
// and the heavy loaders call loadImportedContext, but only one network request is made.
const fetchImportedTeam = cache(importTeam);

const pricingAppState: UserGameState = {
  manager_name: "Manager",
  team_name: "Import your team",
  team_id_label: "Not imported",
  gameweek: 1,
  gameweek_label: "GW1",
  deadline_label: "Import your FPL team",
  formation: "3-4-3",
  bank: 0,
  free_transfers: 1,
  current_tier: "Free",
};

export class ImportRequiredError extends Error {
  constructor(route = "this page") {
    super(`Import required. Import your FPL team before opening ${route}.`);
    this.name = "ImportRequiredError";
  }
}

function apiPlayerId(player: Pick<Player, "id" | "api_id">) {
  return player.api_id ?? player.id;
}

async function loadImportedContext(route: string) {
  const cookieStore = await cookies();
  const entryId = (cookieStore.get(FPL_ENTRY_COOKIE)?.value ?? cookieStore.get(IMPORTED_TEAM_ENTRY_COOKIE)?.value)?.trim();
  const eventValue = cookieStore.get(FPL_EVENT_COOKIE)?.value ?? cookieStore.get(IMPORTED_TEAM_EVENT_COOKIE)?.value;
  const event = eventValue ? Number(eventValue) : undefined;

  if (!entryId) {
    throw new ImportRequiredError(route);
  }

  const importedResult = await fetchImportedTeam(entryId, Number.isFinite(event) ? event : undefined);
  const imported = importedTeamFromResponse(importedResult.data);
  const payload = commandCentrePayloadFromImport(imported);
  const players = playersFromImport(imported);

  return {
    imported,
    appState: appStateFromImport(imported),
    payload,
    players,
    importSource: importedResult.source,
  };
}

function scenarioPayload(payload: Record<string, unknown>, players: Player[]) {
  const captain = players.find((player) => player.role === "captain") ?? players.find((player) => player.position !== "GK") ?? players[0];
  const viceCaptain = players.find((player) => player.role === "vice captain") ?? players.find((player) => player.id !== captain?.id && player.position !== "GK") ?? players[1] ?? captain;

  return {
    ...payload,
    scenarios: [
      {
        scenario_id: "imported_roll_transfer",
        name: "Roll transfer",
        scenario_type: "roll",
        transfers: [],
        captain_id: captain ? apiPlayerId(captain) : undefined,
        vice_captain_id: viceCaptain ? apiPlayerId(viceCaptain) : undefined,
      },
    ],
    auto_generate: true,
    max_auto_scenarios: 6,
    save: false,
  };
}

function comparableImportedPlayers(players: Player[]) {
  const first = players.find((player) => player.position !== "GK") ?? players[0];
  const second = players.find((player) => player.id !== first?.id && player.position === first?.position) ?? players.find((player) => player.id !== first?.id) ?? players[1];
  return [first, second].filter(Boolean) as Player[];
}

function importedSafeRoute(players: Player[], routeType: TransferRoute["route_type"] = "roll"): TransferRoute {
  return {
    id: `imported-${routeType}`,
    title: routeType === "roll" ? "Imported squad loaded" : "Analysis pending",
    move: routeType === "roll" ? "Roll transfer while analysis loads" : "Backend analysis pending",
    expected_gain: 0,
    confidence: "Low",
    risk: "Low",
    why: [`Imported squad loaded with ${players.length} players.`],
    why_this_could_be_wrong: ["Full backend analysis did not finish during initial page load."],
    route_type: routeType,
  };
}

function importedSafeDecision(players: Player[]): DecisionCentre {
  const roll = importedSafeRoute(players, "roll");
  const safe = importedSafeRoute(players, "safe");
  const upside = importedSafeRoute(players, "upside");
  const captaincy = importedSafeCaptaincy(players);

  return {
    best_move: {
      recommended_action: "Roll transfer",
      move: "Imported squad loaded",
      expected_gain: 0,
      confidence_band: "Low",
      risk_level: "Low",
      why: ["Your imported squad is available. Full decision analysis is still pending."],
      why_this_could_be_wrong: ["Backend decision analysis did not finish during initial page load."],
    },
    expected_gain: 0,
    confidence: "Low",
    risk: "Low",
    why_this_move: ["Imported squad loaded successfully."],
    what_could_go_wrong: ["Backend decision analysis did not finish in time."],
    safe_alternative: safe,
    upside_alternative: upside,
    roll_alternative: roll,
    no_strong_move: true,
    buy_candidates: [],
    captain_pick: captaincy.best_captain.player,
    vice_captain_pick: captaincy.vice_captain.player,
  };
}

function captaincyOption(player: Player): CaptaincyOption {
  return {
    player,
    projected_points: player.projected ?? 0,
    ceiling: null,
    safety: null,
    minutes_risk: player.risk,
    fixture_difficulty: player.fixture_difficulty ?? 3,
    confidence: "Low",
    risk: player.risk,
    why: ["Imported squad captaincy placeholder while backend analysis loads."],
    why_this_could_go_wrong: ["Full captaincy model did not finish during initial page load."],
  };
}

function importedSafeCaptaincy(players: Player[]): CaptaincyCentre {
  const starters = players.slice(0, 11);
  const captain = starters.find((player) => player.role === "captain") ?? starters.find((player) => player.position !== "GK") ?? players[0];
  const vice = starters.find((player) => player.role === "vice captain") ?? starters.find((player) => player.id !== captain?.id && player.position !== "GK") ?? captain;
  const top = starters.filter((player) => player.position !== "GK").slice(0, 5);

  return {
    best_captain: captaincyOption(captain),
    vice_captain: captaincyOption(vice),
    top_options: (top.length ? top : players.slice(0, 5)).map(captaincyOption),
    ceiling_vs_safety: "Backend analysis pending.",
    minutes_risk_summary: "Backend analysis pending.",
    fixture_difficulty_summary: "Backend analysis pending.",
    why_this_captain: ["Imported squad loaded."],
    what_could_go_wrong: ["Backend captaincy analysis timed out."],
  };
}


function importedSafePlanner(appState: UserGameState, players: Player[]): MultiGwPlanner {
  const captain = players.find((player) => player.role === "captain") ?? players.find((player) => player.position !== "GK") ?? players[0];
  const steps: PlannerStep[] = [0, 1, 2].map((offset) => ({
    gw: `GW${appState.gameweek + offset}`,
    headline: offset === 0 ? "Imported squad loaded" : "Plan pending",
    action: offset === 0 ? "Hold while backend planner loads." : "Backend planner pending.",
    projected_points: null,
    risk: "Low",
    captain,
    fixture: captain?.fixture ?? "TBC",
    fixture_difficulty: captain?.fixture_difficulty ?? 3,
    warning: "Full planner did not finish during initial page load.",
  }));
  const route: PlannerRoute = {
    id: "imported-planner-pending",
    title: "Imported squad loaded",
    route_type: "roll",
    expected_total_points: 0,
    expected_gain: 0,
    confidence: "Low",
    risk: "Low",
    steps,
    warnings: ["Backend planner analysis pending."],
    why: ["Imported squad is available immediately."],
    why_this_could_be_wrong: ["Full backend planner did not complete yet."],
  };

  return {
    status: "ok",
    horizon: 3,
    horizon_requested: 5,
    horizon_clamped: false,
    horizon_clamp_reason: null,
    current_gameweek: null,
    max_fixture_gameweek: null,
    fixture_calendar_available: true,
    fixture_calendar_stale: false,
    season_status: null,
    fixture_season: null,
    risk_profile: "Balanced",
    bank: appState.bank,
    free_transfers: appState.free_transfers,
    recommended_route: route,
    alternative_routes: [],
    locked_pro_preview: route,
    usage: usageState,
  };
}

function importedMarketSignal(player: Player, signal: MarketSignal["signal"] = "Watch"): MarketSignal {
  return { player, signal, score: null, reason: "Imported squad loaded. Full market analysis pending." };
}

function importedSafeMarket(players: Player[]): MarketBoard {
  const alerts = players.slice(0, usageState.market_signal_limit).map((player) => importedMarketSignal(player));
  return {
    rising_players: [],
    falling_players: [],
    owned_squad_alerts: alerts,
    market_alerts: alerts,
    top_free_limit: usageState.market_signal_limit,
    full_market_locked: true,
    signal_explanations: {
      Buy: "Backend analysis pending.",
      Hold: "Backend analysis pending.",
      Sell: "Backend analysis pending.",
      Avoid: "Backend analysis pending.",
      Watch: "Imported squad loaded while market analysis runs.",
    },
  };
}

function importedSafeComparison(players: Player[]): PlayerComparison {
  const [a, b] = comparableImportedPlayers(players);
  const playerA = a ?? players[0];
  const playerB = b ?? playerA;
  return {
    player_a: playerA,
    player_b: playerB,
    metrics: {
      projected_next_gw: [playerA.projected, playerB.projected],
      three_gw_projection: [playerA.three_gw_projected ?? null, playerB.three_gw_projected ?? null],
      fixture_difficulty: [playerA.fixture_difficulty ?? 3, playerB.fixture_difficulty ?? 3],
      minutes_risk: [playerA.risk, playerB.risk],
      ownership: [playerA.ownership ?? 0, playerB.ownership ?? 0],
      form: [playerA.form ?? 0, playerB.form ?? 0],
      stock_signal: ["Watch", "Watch"],
    },
    verdict: {
      winner: playerA,
      summary: "Imported squad loaded. Full comparison pending.",
      confidence: "Low",
      risk: "Low",
      why: ["Both players are from the imported squad context."],
      why_this_could_be_wrong: ["Backend comparison did not finish during initial page load."],
    },
  };
}

function importedSafeCommandCentre(appState: UserGameState, players: Player[]): CommandCentre {
  const captaincy = importedSafeCaptaincy(players);
  const decision = importedSafeDecision(players);
  const diagnostics = importedSafeDiagnostics(players);
  const planner = importedSafePlanner(appState, players);
  return {
    lightweight: true,
    gameweek: appState.gameweek,
    deadline: appState.deadline_label,
    best_move: decision.best_move,
    captain_pick: captaincy.best_captain.player,
    vice_captain: captaincy.vice_captain.player,
    squad_health: diagnostics.health,
    transfer_preview: [decision.safe_alternative, decision.upside_alternative, decision.roll_alternative],
    planner: planner.recommended_route.steps,
    market_alerts: players.slice(0, 5).map((player) => importedMarketSignal(player)),
    risk_alerts: ["Backend command centre analysis pending."],
  };
}

export async function loadCommandCentreData() {
  const context = await loadImportedContext("/dashboard");
  const [commandCentreResult, projectionStatus, health] = await Promise.all([
    withTabTimeout(getGameweekCommandCentre(context.payload, { disableFallback: true }), "/gameweek-command-centre/dashboard"),
    withTabTimeout(getProjectionStatus(), "/projections/status", 2500),
    healthSource(),
  ]);

  return {
    appState: context.appState,
    usageState,
    squadPlayers: context.players,
    commandCentre: commandCentreResult ? unwrap(commandCentreResult) : importedSafeCommandCentre(context.appState, context.players),
    projectionStatus: projectionStatus ? unwrap(projectionStatus) : { status: "unavailable", fallback_used: true, fallback_reason: "Projection status timed out." },
    dataSource: mergeSources(health, context.importSource, commandCentreResult?.source ?? unavailableSource("/gameweek-command-centre/dashboard", "Command Centre timed out."), projectionStatus?.source ?? unavailableSource("/projections/status", "Projection status timed out.")),
  };
}

export async function loadSquadData() {
  const context = await loadImportedContext("/squad/health");
  const [diagnostics, health] = await Promise.all([
    withTabTimeout(getSquadHealthDiagnostics(context.payload), "/squad-health/analyse"),
    healthSource(),
  ]);
  const diagnosticsData = diagnostics ? importedOnlyDiagnostics(unwrap(diagnostics), context.players) : importedSafeDiagnostics(context.players);

  return {
    appState: context.appState,
    squadPlayers: context.players,
    diagnostics: diagnosticsData,
    dataSource: mergeSources(health, context.importSource, diagnostics?.source ?? unavailableSource("/squad-health/analyse", "Squad health analysis timed out. Showing imported squad.")),
  };
}

export async function loadSquadRosterData() {
  const context = await loadImportedContext("/squad");
  const [diagnostics, health] = await Promise.all([
    withTabTimeout(getSquadHealthDiagnostics(context.payload), "/squad-health/analyse"),
    healthSource(),
  ]);
  const diagnosticsData = diagnostics ? importedOnlyDiagnostics(unwrap(diagnostics), context.players) : importedSafeDiagnostics(context.players);
  // context.players comes from playersFromImport() - the raw imported squad snapshot, which
  // hardcodes projected/ownership to 0 (that data only exists via a real analysis call, never
  // from the import payload itself). Merge in the real per-player numbers from the same
  // squad-health analysis already being fetched above (matched by player id) instead of showing
  // literal 0 pts / 0% for every player on the pitch and Starting XI/Bench cards.
  const analysedById = new Map(diagnostics ? unwrap(diagnostics).players.map((player) => [player.id, player] as const) : []);
  const squadPlayers = context.players.map((player) => {
    const analysed = analysedById.get(player.id);
    return analysed ? { ...player, projected: analysed.projected, ownership: analysed.ownership } : player;
  });
  return {
    appState: context.appState,
    squadPlayers,
    diagnostics: diagnosticsData,
    dataSource: mergeSources(health, context.importSource, diagnostics?.source ?? unavailableSource("/squad-health/analyse", "Squad health analysis timed out.")),
  };
}

export async function loadCaptaincyData() {
  const context = await loadImportedContext("/captaincy");
  const [captaincy, health] = await Promise.all([
    withTabTimeout(getCaptaincyCentre(context.payload), "/gameweek-command-centre/dashboard"),
    healthSource(),
  ]);

  return {
    appState: context.appState,
    captaincy: captaincy ? unwrap(captaincy) : importedSafeCaptaincy(context.players),
    dataSource: mergeSources(health, context.importSource, captaincy?.source ?? unavailableSource("/gameweek-command-centre/dashboard", "Captaincy analysis timed out. Showing imported squad.")),
  };
}

export async function loadDecisionData() {
  const context = await loadImportedContext("/transfers");
  const [decision, health] = await Promise.all([
    withTabTimeout(getDecisionCentre(context.payload), "/gameweek-command-centre/dashboard"),
    healthSource(),
  ]);

  return {
    appState: context.appState,
    squadPlayers: context.players,
    availablePlayers: context.players,
    decision: decision ? unwrap(decision) : importedSafeDecision(context.players),
    dataSource: mergeSources(health, context.importSource, decision?.source ?? unavailableSource("/gameweek-command-centre/dashboard", "Decision analysis timed out. Showing imported squad.")),
  };
}

export async function loadScenarioData() {
  const context = await loadImportedContext("/scenarios");
  const [scenario, squadMarket, health] = await Promise.all([
    withTabTimeout(analyseScenario(scenarioPayload(context.payload, context.players)), "/scenario-simulator/analyse"),
    withTabTimeout(analyseStockMarketSquad(context.payload), "/player-stock-market/squad"),
    healthSource(),
  ]);
  const fallbackRoute = importedSafeRoute(context.players, "roll");
  const scenarioData = scenario ? unwrap(scenario) : { ranked_scenarios: [fallbackRoute] };

  const richSignals = squadMarket && squadMarket.source.mode !== "mock" ? squadMarket.data.owned_player_alerts : [];
  const richById = new Map(richSignals.map((s) => [s.player.id, s.player]));
  const enrichedPlayers = context.players.map((player) => {
    const rich = richById.get(player.id);
    if (!rich) return player;
    return {
      ...player,
      projected: rich.projected || player.projected,
      three_gw_projected: rich.three_gw_projected ?? player.three_gw_projected,
      fixture: rich.fixture !== "TBC" ? rich.fixture : player.fixture,
      fixture_difficulty: rich.fixture_difficulty ?? player.fixture_difficulty,
      ownership: rich.ownership || player.ownership,
      form: rich.form || player.form,
    };
  });

  return {
    appState: context.appState,
    players: enrichedPlayers,
    recommendedRoute: scenarioData.ranked_scenarios[0] ?? fallbackRoute,
    usage: usageState,
    dataSource: mergeSources(health, context.importSource, scenario?.source ?? unavailableSource("/scenario-simulator/analyse", "Scenario analysis timed out. Showing imported squad.")),
  };
}

export async function loadPlannerData() {
  const context = await loadImportedContext("/planner");
  const [planner, health] = await Promise.all([
    withTabTimeout(planMultiGw(context.payload), "/multi-gw-planner/plan"),
    healthSource(),
  ]);

  return {
    appState: context.appState,
    planner: planner ? unwrap(planner) : importedSafePlanner(context.appState, context.players),
    dataSource: mergeSources(health, context.importSource, planner?.source ?? unavailableSource("/multi-gw-planner/plan", "Planner analysis timed out. Showing imported squad.")),
  };
}

export async function loadMarketData(filters: Record<string, string | number> = {}) {
  const context = await loadImportedContext("/market");
  const [board, owned, health] = await Promise.all([
    withTabTimeout(getMarketBoard({ limit: usageState.market_signal_limit, ...filters }), "/player-stock-market/market"),
    withTabTimeout(analyseStockMarketSquad(context.payload), "/player-stock-market/squad"),
    healthSource(),
  ]);
  const fallbackBoard = importedSafeMarket(context.players);
  const boardData = board ? unwrap(board) : fallbackBoard;
  const ownedData = owned ? unwrap(owned) : { owned_player_alerts: fallbackBoard.owned_squad_alerts };

  return {
    appState: context.appState,
    usageState,
    board: {
      ...boardData,
      owned_squad_alerts: ownedData.owned_player_alerts.length ? ownedData.owned_player_alerts : boardData.owned_squad_alerts,
    },
    dataSource: mergeSources(health, context.importSource, board?.source ?? unavailableSource("/player-stock-market/market", "Market board timed out."), owned?.source ?? unavailableSource("/player-stock-market/squad", "Owned squad market analysis timed out.")),
  };
}

// preselectedApiIds lets another tab (e.g. Market's "Compare" action) deep-link straight into
// a real comparison for two arbitrary players, not just the imported squad's default pair -
// /decision-centre/compare already accepts any api_ids, this just skips comparableImportedPlayers.
export async function loadCompareData(preselectedApiIds?: [number, number]) {
  const context = await loadImportedContext("/compare");
  const comparisonPlayers = comparableImportedPlayers(context.players);
  const apiIds = preselectedApiIds ?? comparisonPlayers.map(apiPlayerId);
  const comparison = await withTabTimeout(getPlayerComparison(apiIds), "/decision-centre/compare", TAB_TIMEOUT_MS);

  return {
    appState: context.appState,
    comparison: comparison ? unwrap(comparison) : importedSafeComparison(context.players),
    players: context.players,
    usageState,
    dataSource: mergeSources(context.importSource, comparison?.source ?? unavailableSource("/decision-centre/compare", "Comparison timed out. Showing imported squad.")),
  };
}

export async function loadWatchlistData() {
  const context = await loadImportedContext("/watchlist");
  const list = await withTabTimeout(getWatchlist(), "TODO /watchlist", 1000);
  const fallback: Watchlist = {
    saved_players: context.players.slice(0, 5).map((player) => ({ player, status: "Monitor", reason: "Imported squad loaded. Watchlist backend not connected.", trigger: "Manual review" })),
    fixture_swing_alerts: [],
    price_value_alerts: [],
    empty_state: { title: "Imported squad loaded", body: "Watchlist persistence is not connected yet." },
  };

  return {
    appState: context.appState,
    watchlist: list ? unwrap(list) : fallback,
    usageState,
    dataSource: mergeSources(context.importSource, list?.source ?? { mode: "future", label: "Future UI preview", detail: "No watchlist persistence endpoint exists yet." }),
  };
}

export async function loadReviewData() {
  const context = await loadImportedContext("/review");
  const [audit, health] = await Promise.all([
    withTabTimeout(getRecommendationReview(), "/recommendation-audit/report"),
    healthSource(),
  ]);
  const fallback: ReviewAudit = {
    last_gw_recommendation: "Imported squad loaded",
    actual_outcome: "Review analysis pending.",
    result: "Neutral",
    captain_result: "Review analysis pending.",
    transfer_result: "Review analysis pending.",
    model_note: "Backend review did not finish during initial page load.",
    lessons_for_next_gw: ["Imported squad context is available."],
    confidence: "Low",
    risk: "Low",
    what_could_go_wrong: ["Historical recommendation audit is not available yet."],
  };

  return {
    appState: context.appState,
    audit: audit ? unwrap(audit) : fallback,
    dataSource: mergeSources(health, context.importSource, audit?.source ?? unavailableSource("/recommendation-audit/report", "Review timed out. Showing imported context.")),
  };
}

export async function loadTrustData() {
  const context = await loadImportedContext("/trust");
  const [trust, projectionStatus, health] = await Promise.all([
    withTabTimeout(getModelTrust(), "/projections/status"),
    withTabTimeout(getProjectionStatus(), "/projections/status", 2500),
    healthSource(),
  ]);
  const fallbackTrust: ModelTrust = {
    prediction_system: "Imported squad loaded. Model status pending.",
    confidence_risk_labels: "Confidence and risk labels are shown when backend status is available.",
    fallback_warning: "Projection status did not finish during initial page load.",
    previous_model_comparison: "Model comparison unavailable.",
    rollback_safety: "Rollback safety unavailable.",
  };

  return {
    appState: context.appState,
    trust: trust ? unwrap(trust) : fallbackTrust,
    projectionStatus: projectionStatus ? unwrap(projectionStatus) : { status: "unavailable", fallback_used: true, fallback_reason: "Projection status timed out.", projection_model_type: null },
    dataSource: mergeSources(health, context.importSource, trust?.source ?? unavailableSource("/projections/status", "Trust/model status timed out."), projectionStatus?.source ?? unavailableSource("/projections/status", "Projection status timed out.")),
  };
}

export function loadPricingData() {
  return {
    appState: pricingAppState,
    usageState,
    pricingTiers,
    dataSource: { mode: "future", label: "Future UI preview", detail: "Pricing and gates are frontend-only beta states." } as DataSourceStatus,
  };
}
