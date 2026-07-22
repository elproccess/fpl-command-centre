export type PlayerMapIdentity = {
  player_id: number;
  fpl_element_id: number;
  code?: number | null;
  web_name: string;
  first_name?: string | null;
  second_name?: string | null;
  team_id?: number | null;
  team_short_name?: string | null;
  position?: string | null;
};

export type MapPoint = {
  fixture_id: string | number;
  minute?: number | null;
  x: number;
  y: number;
  event_type: "touch" | "shot" | "pass" | "defensive_action";
  weight: number;
  xg?: number | null;
};

export type ShotPoint = {
  fixture_id: string | number;
  minute?: number | null;
  x: number;
  y: number;
  xg: number | null;
  outcome: "goal" | "saved" | "blocked" | "off_target" | "unknown";
  body_part?: string | null;
  is_penalty: boolean;
};

export type RoleSummary = {
  average_x: number | null;
  average_y: number | null;
  dominant_side: "left" | "central" | "right";
  dominant_third: "defensive" | "middle" | "attacking";
  box_involvement_rate: number | null;
  advanced_role_score: number;
};

export type PlayerHeatmapResponse = {
  player: PlayerMapIdentity;
  matches_used: Record<string, unknown>[];
  has_coordinate_data: boolean;
  points: MapPoint[];
  zones: Record<string, number>;
  role_summary: RoleSummary;
  fallback_summary?: Record<string, unknown> | null;
  data_source?: string;
  source_note?: string;
};

export type PlayerShotMapResponse = {
  player: PlayerMapIdentity;
  matches_used: Record<string, unknown>[];
  has_coordinate_data: boolean;
  shots: ShotPoint[];
  summary: {
    shots: number;
    goals: number;
    xg: number | null;
    non_penalty_xg: number | null;
    box_shot_rate: number | null;
    big_chance_count: number;
  };
  fallback_summary?: Record<string, unknown> | null;
  data_source?: string;
  source_note?: string;
};

async function requestBackend<T>(path: string): Promise<T> {
  const response = await fetch(`/api/backend${path}`, { cache: "no-store" });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Player maps request failed (${response.status})${text ? `: ${text.slice(0, 220)}` : ""}`);
  }
  return (await response.json()) as T;
}

export async function getPlayerHeatmap(playerId: number, lastN = 5, eventTypes?: string[]): Promise<PlayerHeatmapResponse> {
  const query = new URLSearchParams({ last_n: String(lastN) });
  if (eventTypes?.length) query.set("event_types", eventTypes.join(","));
  return requestBackend<PlayerHeatmapResponse>(`/player-maps/${encodeURIComponent(String(playerId))}/heatmap?${query.toString()}`);
}

export async function getPlayerShotMap(playerId: number, lastN = 5): Promise<PlayerShotMapResponse> {
  const query = new URLSearchParams({ last_n: String(lastN) });
  return requestBackend<PlayerShotMapResponse>(`/player-maps/${encodeURIComponent(String(playerId))}/shot-map?${query.toString()}`);
}
