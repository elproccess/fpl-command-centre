import type {
  BestMove,
  CommandCentre,
  ConfidenceBand,
  MarketSignal,
  Player,
  RiskLevel,
  SquadHealth,
  TransferRoute,
} from "./types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function asNumber(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function asStringArray(value: unknown, fallback: string[]) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : fallback;
}

function asConfidence(value: unknown, fallback: ConfidenceBand): ConfidenceBand {
  return value === "High" || value === "Medium" || value === "Low" ? value : fallback;
}

function asRisk(value: unknown, fallback: RiskLevel): RiskLevel {
  return value === "High" || value === "Medium" || value === "Low" ? value : fallback;
}

function asFixtureDifficulty(value: unknown, fallback: Player["fixture_difficulty"]): Player["fixture_difficulty"] {
  return value === 1 || value === 2 || value === 3 || value === 4 || value === 5 ? value : fallback;
}

export function normalizePlayer(raw: unknown, fallback: Player): Player {
  if (!isRecord(raw)) return fallback;

  return {
    ...fallback,
    id: asNumber(raw.id, fallback.id),
    api_id: asNumber(raw.api_id ?? raw.player_id ?? raw.fpl_element_id, fallback.api_id ?? asNumber(raw.id, fallback.id)),
    code: raw.code === undefined ? fallback.code : asNumber(raw.code, fallback.code ?? 0),
    name: asString(raw.name, fallback.name),
    team: asString(raw.team, fallback.team),
    position:
      raw.position === "GK" || raw.position === "DEF" || raw.position === "MID" || raw.position === "FWD"
        ? raw.position
        : fallback.position,
    price: asNumber(raw.price, fallback.price),
    projected: asNumber(raw.projected ?? raw.projected_points, fallback.projected),
    fixture: asString(raw.fixture, fallback.fixture ?? "TBC"),
    fixture_difficulty: asFixtureDifficulty(raw.fixture_difficulty, fallback.fixture_difficulty),
    ownership: asNumber(raw.ownership, fallback.ownership ?? 0),
    form: asNumber(raw.form, fallback.form ?? 0),
    three_gw_projected: (typeof raw.three_gw_projected === "number" && Number.isFinite(raw.three_gw_projected))
      ? raw.three_gw_projected
      : fallback.three_gw_projected,
    price_movement: asNumber(raw.price_movement, fallback.price_movement ?? 0),
    trend: raw.trend === "up" || raw.trend === "flat" || raw.trend === "down" ? raw.trend : fallback.trend,
    status:
      raw.status === "Available" || raw.status === "Doubt" || raw.status === "Injured" || raw.status === "Suspended"
        ? raw.status
        : fallback.status,
    risk: asRisk(raw.risk, fallback.risk),
    role: asString(raw.role, fallback.role ?? ""),
    team_has_fixture: typeof raw.team_has_fixture === "boolean" ? raw.team_has_fixture : fallback.team_has_fixture,
  };
}

export function normalizeBestMove(raw: unknown, fallback: BestMove): BestMove {
  if (!isRecord(raw)) return fallback;

  return {
    ...fallback,
    recommended_action: asString(raw.recommended_action, fallback.recommended_action),
    move: asString(raw.move, fallback.move),
    expected_gain: asNumber(raw.expected_gain, fallback.expected_gain),
    confidence_band: asConfidence(raw.confidence_band ?? raw.confidence, fallback.confidence_band),
    risk_level: asRisk(raw.risk_level ?? raw.risk, fallback.risk_level),
    why: asStringArray(raw.why, fallback.why),
    why_this_could_be_wrong: asStringArray(raw.why_this_could_be_wrong, fallback.why_this_could_be_wrong),
    fallback_used: Boolean(raw.fallback_used ?? fallback.fallback_used),
    fallback_reason: typeof raw.fallback_reason === "string" ? raw.fallback_reason : fallback.fallback_reason,
  };
}

export function normalizeTransferRoute(raw: unknown, fallback: TransferRoute): TransferRoute {
  if (!isRecord(raw)) return fallback;

  return {
    ...fallback,
    id: asString(raw.id, fallback.id),
    title: asString(raw.title, fallback.title),
    move: asString(raw.move, fallback.move),
    expected_gain: asNumber(raw.expected_gain, fallback.expected_gain),
    confidence: asConfidence(raw.confidence, fallback.confidence),
    risk: asRisk(raw.risk, fallback.risk),
    why: asStringArray(raw.why, fallback.why),
    why_this_could_be_wrong: asStringArray(raw.why_this_could_be_wrong, fallback.why_this_could_be_wrong),
    route_type:
      raw.route_type === "safe" || raw.route_type === "upside" || raw.route_type === "roll" || raw.route_type === "risk"
        ? raw.route_type
        : fallback.route_type,
  };
}

export function normalizeSquadHealth(raw: unknown, fallback: SquadHealth): SquadHealth {
  if (!isRecord(raw)) return fallback;

  return {
    ...fallback,
    score: (typeof raw.score === "number" && Number.isFinite(raw.score)) ? raw.score : fallback.score,
    grade:
      raw.grade === "Strong" || raw.grade === "Stable" || raw.grade === "Fragile" || raw.grade === "Critical"
        ? raw.grade
        : fallback.grade,
    minutes_risk: (typeof raw.minutes_risk === "number" && Number.isFinite(raw.minutes_risk)) ? raw.minutes_risk : fallback.minutes_risk,
    injury_risk: (typeof raw.injury_risk === "number" && Number.isFinite(raw.injury_risk)) ? raw.injury_risk : fallback.injury_risk,
    weak_bench_alerts: asStringArray(raw.weak_bench_alerts, fallback.weak_bench_alerts),
    captaincy_strength: asConfidence(raw.captaincy_strength, fallback.captaincy_strength),
  };
}

export function normalizeMarketSignal(raw: unknown, fallback: MarketSignal): MarketSignal {
  if (!isRecord(raw)) return fallback;

  const signal =
    raw.signal === "Buy" || raw.signal === "Hold" || raw.signal === "Sell" || raw.signal === "Avoid" || raw.signal === "Watch"
      ? raw.signal
      : fallback.signal;

  return {
    ...fallback,
    player: normalizePlayer(raw.player, fallback.player),
    signal,
    score: (typeof raw.score === "number" && Number.isFinite(raw.score)) ? raw.score : fallback.score,
    reason: asString(raw.reason, fallback.reason),
  };
}

export function normalizeCommandCentre(raw: unknown, fallback: CommandCentre): CommandCentre {
  if (!isRecord(raw)) return fallback;

  const transferPreview = Array.isArray(raw.transfer_preview)
    ? raw.transfer_preview.map((route, index) => normalizeTransferRoute(route, fallback.transfer_preview[index] ?? fallback.transfer_preview[0]))
    : fallback.transfer_preview;

  const marketAlerts = Array.isArray(raw.market_alerts)
    ? raw.market_alerts.map((signal, index) => normalizeMarketSignal(signal, fallback.market_alerts[index] ?? fallback.market_alerts[0]))
    : fallback.market_alerts;

  return {
    ...fallback,
    gameweek: asNumber(raw.gameweek, fallback.gameweek),
    deadline: asString(raw.deadline, fallback.deadline),
    best_move: normalizeBestMove(raw.best_move, fallback.best_move),
    captain_pick: normalizePlayer(raw.captain_pick, fallback.captain_pick),
    vice_captain: normalizePlayer(raw.vice_captain, fallback.vice_captain),
    squad_health: normalizeSquadHealth(raw.squad_health, fallback.squad_health),
    transfer_preview: transferPreview,
    market_alerts: marketAlerts,
    risk_alerts: asStringArray(raw.risk_alerts, fallback.risk_alerts),
  };
}
