// Pure helpers shared between the server-only command-centre loader (use-command-centre.ts,
// which imports next/headers and therefore can never be imported from a client component) and
// squad/page.tsx's client-side roster loading (see its own comment on why it fetches this way).
// Nothing here touches cookies() or any other server-only API, so both sides can import it.
import { getBackendHealth } from "./api";
import type { ApiResult, DataSourceStatus, Player, SquadHealthDiagnostics, SquadIssue } from "./types";

export const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
export const TAB_TIMEOUT_MS = Number(process.env.NEXT_PUBLIC_TAB_ANALYSIS_TIMEOUT_MS ?? 120000);
export const HEALTH_TIMEOUT_MS = 1500;

export function unavailableSource(endpoint: string, detail: string): DataSourceStatus {
  return { mode: "unavailable", label: "Backend unavailable", endpoint, detail };
}

export function mergeSources(...sources: DataSourceStatus[]): DataSourceStatus {
  const unavailable = sources.find((source) => source.mode === "unavailable");
  if (unavailable) return { ...unavailable, label: "Backend unavailable" };
  const mock = sources.find((source) => source.mode === "mock");
  if (mock) return { ...mock, label: "Using mock fallback" };
  const future = sources.find((source) => source.mode === "future");
  if (future) return { ...future, label: "Future UI preview" };
  return sources[0] ?? { mode: "real", label: "Real backend connected" };
}

export function unwrap<T>(result: ApiResult<T>) {
  if (result.source.mode === "mock" && !DEMO_MODE) {
    throw new Error(`Backend returned mock fallback for ${result.source.endpoint ?? "a core feature page"}. Demo mode is not enabled.`);
  }
  return result.data;
}

export function errorText(error: unknown) {
  return error instanceof Error ? error.message : "Backend request failed.";
}

export async function withTabTimeout<T>(promise: Promise<ApiResult<T>>, endpoint: string, ms = TAB_TIMEOUT_MS): Promise<ApiResult<T> | null> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    const timer = new Promise<null>((resolve) => {
      timeout = setTimeout(() => resolve(null), ms);
    });
    return await Promise.race([promise, timer]);
  } catch {
    // Treat errors the same as timeout — callers already handle null with safe fallbacks.
    return null;
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export async function healthSource() {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    const timer = new Promise<DataSourceStatus>((resolve) => {
      timeout = setTimeout(() => resolve(unavailableSource("/health", "Health check timed out.")), HEALTH_TIMEOUT_MS);
    });
    return await Promise.race([getBackendHealth(), timer]);
  } catch (error) {
    return unavailableSource("/health", errorText(error));
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export function importedOnlyDiagnostics(diagnostics: SquadHealthDiagnostics, players: Player[]): SquadHealthDiagnostics {
  const importedIds = new Set(players.flatMap((player) => [player.id, player.api_id].filter((value): value is number => typeof value === "number")));
  const importedIssues = (issues: SquadIssue[]) => issues.filter((issue) => importedIds.has(issue.affected_player.id) || (typeof issue.affected_player.api_id === "number" && importedIds.has(issue.affected_player.api_id)));
  const allIssues = [
    ...importedIssues(diagnostics.urgent_issues),
    ...importedIssues(diagnostics.minutes_risk_list),
    ...importedIssues(diagnostics.injury_suspension_risk_list),
    ...importedIssues(diagnostics.weak_bench_alerts),
    ...importedIssues(diagnostics.fixture_problem_areas),
  ];
  const primaryIssue = allIssues[0];

  return {
    ...diagnostics,
    urgent_issues: importedIssues(diagnostics.urgent_issues),
    minutes_risk_list: importedIssues(diagnostics.minutes_risk_list),
    injury_suspension_risk_list: importedIssues(diagnostics.injury_suspension_risk_list),
    weak_bench_alerts: importedIssues(diagnostics.weak_bench_alerts),
    fixture_problem_areas: importedIssues(diagnostics.fixture_problem_areas),
    recommended_fix: primaryIssue
      ? {
          action: primaryIssue.suggested_action,
          why: primaryIssue.reason,
          confidence: primaryIssue.severity === "High" ? "Medium" : "High",
          risk: primaryIssue.severity,
          why_this_could_be_wrong: "This fix is based only on the imported squad context and current backend diagnostics.",
        }
      : {
          action: "No urgent imported-squad fix",
          why: "The backend diagnostics did not flag an imported player as an urgent transfer priority.",
          confidence: "Medium",
          risk: "Low",
          why_this_could_be_wrong: "Run full analysis again after team news or fixture data changes.",
        },
  };
}

export function importedSafeDiagnostics(players: Player[]): SquadHealthDiagnostics {
  const flagged = players.filter((player) => player.status !== "Available" || player.risk !== "Low");
  const issue = (player: Player, index: number): SquadIssue => ({
    id: `imported-issue-${player.id}-${index}`,
    severity: player.risk,
    category: player.status !== "Available" ? "Injury" : "Minutes",
    affected_player: player,
    reason: player.status !== "Available" ? `${player.name} is marked ${player.status}.` : `${player.name} has ${player.risk.toLowerCase()} risk.`,
    suggested_action: "Review before deadline.",
  });
  const issues = flagged.map(issue);

  return {
    health: {
      score: null,
      grade: "Stable",
      minutes_risk: null,
      injury_risk: null,
      weak_bench_alerts: [],
      captaincy_strength: "Medium",
    },
    urgent_issues: issues.filter((item) => item.severity === "High").slice(0, 3),
    minutes_risk_list: issues.filter((item) => item.category === "Minutes").slice(0, 4),
    injury_suspension_risk_list: issues.filter((item) => item.category === "Injury").slice(0, 4),
    weak_bench_alerts: [],
    captaincy_strength: "Medium",
    fixture_problem_areas: [],
    transfer_pressure: { level: issues.some((item) => item.severity === "High") ? "High" : "Low", reason: "Imported squad loaded. Full backend diagnostics pending." },
    recommended_fix: {
      action: issues[0]?.suggested_action ?? "No urgent imported-squad fix",
      why: issues[0]?.reason ?? "Imported squad loaded successfully.",
      confidence: "Medium",
      risk: issues[0]?.severity ?? "Low",
      why_this_could_be_wrong: "Full backend diagnostics did not finish during initial page load.",
    },
    players,
  };
}
