export type ConfidenceBand = "High" | "Medium" | "Low";
export type RiskLevel = "Low" | "Medium" | "High";
export type PricingTierName = "Free" | "Plus" | "Pro";
export type RiskProfile = "Safe" | "Balanced" | "Aggressive";
export type DataMode = "real" | "mock" | "unavailable" | "future";

export type DataSourceStatus = {
  mode: DataMode;
  label: "Real backend connected" | "Using mock fallback" | "Backend unavailable" | "Future UI preview";
  endpoint?: string;
  detail?: string;
};

export type ApiResult<T> = {
  data: T;
  source: DataSourceStatus;
  // Set when the backend response carried a cache_status field (the persisted background-
  // job analysis cache): "pending"/"running" means `data` is the fallback shape, not real
  // data yet - callers that care should poll again rather than render it. Undefined for
  // endpoints that don't use that cache at all.
  analysisStatus?: "pending" | "running" | "completed" | "failed";
  // The backend's real, growing in-progress snapshot (see analysis_cache.update_partial_progress)
  // when analysisStatus is pending/running and the cached row already carries one. Only present
  // for endpoints whose "still computing" response attaches it (e.g. multi-gw-planner/plan's
  // _still_computing_response) - undefined otherwise, never a fabricated placeholder.
  partial?: Record<string, unknown>;
};

export type AnalysisJobStatus = {
  status: "not_scheduled" | "pending" | "running" | "completed" | "failed" | string;
  updated_at?: string | null;
  error_message?: string | null;
  // Only present while status is pending/running AND the backend has a genuine in-progress
  // snapshot to show (see analysis_cache.update_partial_progress on the backend) - e.g. the
  // multi-GW planner's real per-gameweek streaming progress. Raw backend shape, not yet adapted
  // into frontend types - see planner-content.tsx's buildStreamingPlanner.
  payload?: Record<string, unknown> | null;
};

export type AnalysisStatus = {
  entry_id: string;
  gameweek: number | null;
  analysis: Record<string, AnalysisJobStatus>;
  all_done: boolean;
};

export type ImportedSquadPick = {
  player_id?: number;
  element?: number;
  id?: number;
  multiplier?: number;
  is_captain?: boolean;
  is_vice_captain?: boolean;
  squad_position?: number;
  position?: Player["position"] | number | string;
  web_name?: string;
  first_name?: string;
  second_name?: string;
  team?: string;
  team_short_name?: string;
  team_id?: number;
  code?: number;
  photo_url?: string;
  image_url?: string;
  price?: number;
  status?: string;
  news?: string | null;
};

export type ImportTeamResponse = {
  entry_id: string;
  planning_event?: number;
  gameweek?: number;
  event?: number;
  current_event?: number;
  resolved_event?: number;
  resolved_gameweek?: number;
  saved: boolean;
  saved_team_id?: number | null;
  source: string;
  team_name?: string | null;
  bank?: number | null;
  free_transfers?: number | null;
  entry_history?: Record<string, unknown>;
  squad: ImportedSquadPick[];
};

export type StoredImportedTeam = {
  entry_id: string;
  event: number;
  gameweek: number;
  // The raw squad-snapshot gameweek the backend actually fetched picks for (e.g. 38, the last
  // finished GW, during the off-season) - deliberately kept separate from `event`/`gameweek`
  // above, which are planning_event-first (see resolvedImportEvent's own comment for why that
  // priority must not change). Only this field is safe to persist into
  // IMPORTED_TEAM_EVENT_COOKIE (see saveImportedTeam) - writing the planning event there instead
  // corrupts the next /squad-health/import call into fetching a different, often bogus GW.
  squad_snapshot_event: number;
  team_name?: string | null;
  squad: ImportedSquadPick[];
  imported_at: string;
  bank?: number | null;
  free_transfers?: number | null;
  entry_history?: Record<string, unknown>;
};

export type ApiAuditEntry = {
  feature: string;
  frontendNeed: string;
  status: "real" | "mapped" | "future-bff";
  realEndpoint?: string;
  oldSpeculativeEndpoint?: string;
  note: string;
};

export type Player = {
  id: number;
  api_id?: number;
  code?: number;
  name: string;
  team: string;
  position: "GK" | "DEF" | "MID" | "FWD";
  price: number;
  projected: number;
  fixture?: string;
  fixture_difficulty?: 1 | 2 | 3 | 4 | 5;
  ownership?: number;
  form?: number;
  three_gw_projected?: number;
  price_movement?: number;
  trend?: "up" | "flat" | "down";
  status: "Available" | "Doubt" | "Injured" | "Suspended";
  risk: RiskLevel;
  role?: string;
  // False only when this player's club has zero unfinished fixtures anywhere in the loaded
  // calendar (e.g. a relegated club with no games in the new season) - a real 0 projection here
  // means "no fixture to project against", not "projected to score nothing". Defaults to true
  // (assume a fixture exists) wherever the backend doesn't send this field at all.
  team_has_fixture?: boolean;
};

export type BestMove = {
  recommended_action: "Transfer" | "Roll transfer" | "Captaincy change" | "Bench change" | string;
  move: string;
  expected_gain: number;
  confidence_band: ConfidenceBand;
  risk_level: RiskLevel;
  why: string[];
  why_this_could_be_wrong: string[];
  fallback_used?: boolean;
  fallback_reason?: string | null;
  // True only while the backend's best_move_panel (the slowest panel - it needs the full
  // multi-gw planner search to finish) genuinely hasn't computed yet, e.g. mid-stream right
  // after import. expected_gain/move are meaningless placeholders while this is true - renderers
  // MUST show a loading state instead of the number, not a real (if boring-looking) "+0" gain.
  __pending?: boolean;
};

export type TransferRoute = {
  id: string;
  title: string;
  move: string;
  expected_gain: number;
  confidence: ConfidenceBand;
  risk: RiskLevel;
  why: string[];
  why_this_could_be_wrong: string[];
  route_type: "safe" | "upside" | "roll" | "risk";
};

export type TransferCandidate = {
  out_player: Player;
  in_player: Player;
  net_projected_gain: number;
  recommendation_strength?: string;
  reasoning: string[];
  why_not_chosen: string[];
};

export type PlannerStep = {
  gw: string;
  headline: string;
  action: string;
  projected_points: number | null;
  risk: RiskLevel;
  captain?: Player;
  fixture?: string;
  fixture_difficulty?: 1 | 2 | 3 | 4 | 5;
  warning?: string;
  // The backend's own per-gameweek net_gain (multi_gw_planner.py's _build_sequential_step):
  // this route's squad points for THIS gameweek minus the roll-baseline's squad points for the
  // SAME gameweek. This is the authoritative "was this week's squad state worth it" figure -
  // NOT the same as a week-over-week delta against the previous gameweek in this route (which
  // would be dominated by fixture-difficulty swings across the whole squad, unrelated to any
  // transfer). Populated on every step, transfer week or not.
  net_gain?: number | null;
  // Real transfer moves made THIS gameweek (empty on a hold week) - the backend already computes
  // these (multi_gw_planner.py's per-step transfers_out/transfers_in), this was just never mapped
  // into the frontend shape before, so the card had no way to show who's arriving/leaving.
  transfers_out?: Player[];
  transfers_in?: Player[];
  // The backend's own per-step reasoning list, kept as distinct lines (not pre-joined into
  // `warning`) so the UI can render it as its own clearly separated block instead of one
  // run-together paragraph.
  reasoning?: string[];
  // Distinct from `warning` (which carries the route's own reasoning/insight text): this is a
  // data-coverage confidence signal for this specific gameweek - populated only when the
  // backend genuinely found thin/missing fixture or projection data for a meaningful share of
  // the squad this far out, so the UI can say so instead of presenting every GW as equally
  // confident.
  data_quality_warning?: string;
  data_quality_evidence?: {
    players_total: number;
    players_with_fixture: number;
    players_missing_or_fallback: number;
  };
  // Other one-transfer options scenario_simulator ranked for this exact gameweek but didn't
  // choose (multi_gw_planner.py's transfer_candidates_considered) - shown for every gameweek,
  // transfer or hold, not just the one the route actually made, so a hold week can still show
  // what was considered and why it didn't beat holding.
  transfer_candidates_considered?: TransferCandidate[];
  // True for a gameweek that hasn't actually finished computing yet - a placeholder card built
  // client-side (see planner-content.tsx's pendingStep) to fill the slot until the real
  // per-gameweek streaming update replaces it. Every other field on a pending step is a neutral
  // placeholder value, not real data - renderers must check this before trusting them.
  __pending?: boolean;
};

export type PlannerRoute = {
  id: string;
  title: string;
  route_type: TransferRoute["route_type"];
  expected_total_points: number;
  expected_gain: number;
  confidence: ConfidenceBand;
  risk: RiskLevel;
  steps: PlannerStep[];
  warnings: string[];
  why: string[];
  why_this_could_be_wrong: string[];
  // True for an alternative-route slot that hasn't finished computing yet (see planner-content.tsx's
  // pendingRoute) - rendered as its own placeholder card, distinct from a real (if still-partial)
  // route that already has at least one real step.
  __pending?: boolean;
};

export type MarketSignal = {
  player: Player;
  signal: "Buy" | "Hold" | "Sell" | "Avoid" | "Watch";
  score: number | null;
  reason: string;
};

export type SquadHealth = {
  score: number | null;
  grade: "Strong" | "Stable" | "Fragile" | "Critical";
  minutes_risk: number | null;
  injury_risk: number | null;
  weak_bench_alerts: string[];
  captaincy_strength: ConfidenceBand;
};

export type SquadIssue = {
  id: string;
  severity: RiskLevel;
  category: "Minutes" | "Injury" | "Bench" | "Captaincy" | "Fixtures" | "Transfer";
  affected_player: Player;
  reason: string;
  suggested_action: string;
};

export type SquadHealthDiagnostics = {
  health: SquadHealth;
  urgent_issues: SquadIssue[];
  minutes_risk_list: SquadIssue[];
  injury_suspension_risk_list: SquadIssue[];
  weak_bench_alerts: SquadIssue[];
  captaincy_strength: ConfidenceBand;
  fixture_problem_areas: SquadIssue[];
  transfer_pressure: {
    level: RiskLevel;
    reason: string;
  };
  recommended_fix: {
    action: string;
    why: string;
    confidence: ConfidenceBand;
    risk: RiskLevel;
    why_this_could_be_wrong: string;
  };
  // The full analysed squad (real projected_points/ownership_percent per player, computed by
  // squad_health.py's _build_player_cards) - used to enrich the /squad page's player list, which
  // otherwise only has whatever the raw FPL import snapshot carries (price/team/photo, but never
  // live projection/ownership numbers).
  players: Player[];
};

export type CaptaincyOption = {
  player: Player;
  projected_points: number;
  ceiling: number | null;
  safety: number | null;
  minutes_risk: RiskLevel;
  fixture_difficulty: 1 | 2 | 3 | 4 | 5;
  confidence: ConfidenceBand;
  risk: RiskLevel;
  why: string[];
  why_this_could_go_wrong: string[];
};

export type CaptaincyCentre = {
  best_captain: CaptaincyOption;
  vice_captain: CaptaincyOption;
  top_options: CaptaincyOption[];
  ceiling_vs_safety: string;
  minutes_risk_summary: string;
  fixture_difficulty_summary: string;
  why_this_captain: string[];
  what_could_go_wrong: string[];
};

export type DecisionCentre = {
  best_move: BestMove;
  expected_gain: number;
  confidence: ConfidenceBand;
  risk: RiskLevel;
  why_this_move: string[];
  what_could_go_wrong: string[];
  safe_alternative: TransferRoute;
  upside_alternative: TransferRoute;
  roll_alternative: TransferRoute;
  no_strong_move: boolean;
  // Exact players attached to the recommended route by the backend. These are optional because
  // roll/captaincy/bench decisions legitimately have no transfer pair. Using these rich player
  // cards avoids guessing an incoming player from recommendation text or an unrelated market row.
  recommended_outgoing?: Player | null;
  recommended_incoming?: Player | null;
  // Real backend "Buy" market signals (external players worth adding, not the imported squad) -
  // the same stock-market analysis embedded in this same dashboard call, not the user's own team.
  buy_candidates: MarketSignal[];
  // The real captaincy engine's pick for this gameweek (captaincy_panel.captain/vice_captain) -
  // NOT the imported squad snapshot's is_captain flag, which only reflects whoever was captain
  // whenever the team was last imported and can be stale or even injured by the time this page
  // is viewed (found live: a player with a live "Achilles injury" news flag was still being shown
  // as the recommended captain because the snapshot said so at import time).
  captain_pick: Player;
  vice_captain_pick: Player;
};

export type ScenarioSeed = {
  players: Player[];
  recommended_route: TransferRoute;
  usage: UsageState;
};

export type MultiGwPlanner = {
  // "ok" means a genuine plan was computed. Anything else (fixture_calendar_stale,
  // new_season_fixtures_missing, season_complete) means the backend explicitly refused to
  // fabricate a route - recommended_route/alternative_routes are empty in that case and must
  // not be rendered as if the planner is working.
  status: "ok" | "fixture_calendar_stale" | "new_season_fixtures_missing" | "season_complete" | string;
  // The real number of gameweeks actually returned - can be as low as 1 near a genuine
  // end-of-fixture-calendar boundary (see horizon_clamped/horizon_clamp_reason below). Never
  // artificially floored to look like a fuller plan than the backend actually computed.
  horizon: number;
  horizon_requested: number;
  horizon_clamped: boolean;
  horizon_clamp_reason: string | null;
  current_gameweek: number | null;
  max_fixture_gameweek: number | null;
  fixture_calendar_available: boolean;
  fixture_calendar_stale: boolean;
  season_status: string | null;
  fixture_season: string | null;
  risk_profile: RiskProfile;
  bank: number;
  free_transfers: number;
  recommended_route: PlannerRoute;
  alternative_routes: PlannerRoute[];
  locked_pro_preview: PlannerRoute;
  usage: UsageState;
  // True only for the fast recommended-route-only preview returned by /multi-gw-planner/preview
  // (see planner-content.tsx's progressive loading). Absent/false for the real, full /plan result.
  is_preview?: boolean;
};

export type MarketBoard = {
  rising_players: MarketSignal[];
  falling_players: MarketSignal[];
  owned_squad_alerts: MarketSignal[];
  market_alerts: MarketSignal[];
  top_free_limit: number;
  full_market_locked: boolean;
  signal_explanations: Record<MarketSignal["signal"], string>;
};

export type PlayerComparison = {
  player_a: Player;
  player_b: Player;
  metrics: {
    projected_next_gw: [number, number];
    three_gw_projection: [number | null, number | null];
    fixture_difficulty: [number, number];
    minutes_risk: [RiskLevel, RiskLevel];
    ownership: [number, number];
    form: [number, number];
    stock_signal: [MarketSignal["signal"], MarketSignal["signal"]];
  };
  verdict: {
    winner: Player;
    summary: string;
    confidence: ConfidenceBand;
    risk: RiskLevel;
    why: string[];
    why_this_could_be_wrong: string[];
  };
};

export type WatchlistItem = {
  player: Player;
  status: "Buy soon" | "Monitor" | "Avoid" | "Sell soon";
  reason: string;
  trigger: string;
};

export type Watchlist = {
  saved_players: WatchlistItem[];
  fixture_swing_alerts: string[];
  price_value_alerts: string[];
  empty_state: {
    title: string;
    body: string;
  };
};

export type ReviewAudit = {
  last_gw_recommendation: string;
  actual_outcome: string;
  result: "Good call" | "Bad call" | "Neutral";
  captain_result: string;
  transfer_result: string;
  model_note: string;
  lessons_for_next_gw: string[];
  confidence: ConfidenceBand;
  risk: RiskLevel;
  what_could_go_wrong: string[];
};

export type ModelTrust = {
  prediction_system: string;
  confidence_risk_labels: string;
  fallback_warning: string;
  previous_model_comparison: string;
  rollback_safety: string;
};

export type CommandCentre = {
  lightweight?: boolean;
  gameweek: number;
  deadline: string;
  best_move: BestMove;
  captain_pick: Player;
  vice_captain: Player;
  squad_health: SquadHealth;
  transfer_preview: TransferRoute[];
  planner: PlannerStep[];
  market_alerts: MarketSignal[];
  risk_alerts: string[];
};

export type PricingTier = {
  name: PricingTierName;
  price: string;
  summary: string;
  features: string[];
  highlight?: boolean;
};

export type UserGameState = {
  manager_name: string;
  team_name: string;
  team_id_label: string;
  gameweek: number;
  gameweek_label: string;
  deadline_label: string;
  formation: string;
  bank: number;
  free_transfers: number;
  current_tier: PricingTierName;
};

export type UsageState = {
  current_tier: PricingTierName;
  scenario_checks_used: number;
  scenario_checks_limit: number;
  market_signal_limit: number;
  has_full_market: boolean;
  has_full_planner: boolean;
  has_transfer_comparisons: boolean;
  has_saved_plans: boolean;
  has_full_command_centre: boolean;
};
