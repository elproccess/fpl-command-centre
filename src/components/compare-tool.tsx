"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Player, PlayerComparison, RiskLevel } from "@/lib/types";
import {
  getPlayerComparison,
  getPlayerDecisionBreakdown,
  getPlayerProjectionDetail,
  getPlayersDirectory,
  type PlayerDirectoryEntry,
} from "@/lib/api";
import {
  getPlayerHeatmap,
  getPlayerShotMap,
  type PlayerHeatmapResponse,
  type PlayerShotMapResponse,
} from "@/lib/api/playerMaps";
import { ConfidenceBadge, RiskBadge, SignalBadge } from "@/components/badges";
import { PlayerSlotPicker } from "@/components/compare-any-two-players";
import { FixturePill, formatPrice } from "@/components/fpl-ui";
import { PlayerHeatmap } from "@/components/player-maps/PlayerHeatmap";
import { RoleMapSummary } from "@/components/player-maps/RoleMapSummary";
import { ShotMap } from "@/components/player-maps/ShotMap";
import { PlayerVisual } from "@/components/player-visual";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function displayValue(value: unknown): string {
  if (value == null) return "—";
  if (typeof value === "number") return Number.isInteger(value) ? String(value) : value.toFixed(3);
  if (typeof value === "string" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    if (!value.length) return "—";
    if (value.every((item) => typeof item !== "object" || item === null)) return value.join(", ");
    return `${value.length} item${value.length === 1 ? "" : "s"}`;
  }
  if (isRecord(value)) {
    const keys = Object.keys(value);
    return keys.length ? `${keys.length} fields` : "—";
  }
  return String(value);
}

function classifyTrend(value: unknown): "up" | "down" | null {
  if (typeof value !== "string") return null;
  const normalized = value.toLowerCase();
  if (["rising", "stable", "aligned", "strong"].includes(normalized)) return "up";
  if (["falling", "weak", "declining"].includes(normalized)) return "down";
  return null;
}

function TrendDot({ direction }: { direction: "up" | "down" }) {
  return <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${direction === "up" ? "bg-[#00C853]" : "bg-[#FFB800]"}`} aria-hidden />;
}

function BreakdownRow({ label, value, trend, zebra }: { label: string; value: ReactNode; trend?: "up" | "down" | null; zebra: boolean }) {
  return (
    <div className={`grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-start gap-3 rounded-lg px-3 py-2 text-xs ${zebra ? "bg-[#F7F8FC]" : ""}`}>
      <span className="min-w-0 break-words font-bold capitalize text-[#69708F]">{label}</span>
      <span className="flex min-w-0 items-start justify-end gap-1.5 break-words text-right font-black tabular-nums text-[#101631]">
        {trend ? <TrendDot direction={trend} /> : null}
        {value}
      </span>
    </div>
  );
}

function KeyValueGrid({ data }: { data: unknown }) {
  if (!isRecord(data) || !Object.keys(data).length) return <p className="text-xs font-semibold text-[#8A91AA]">No data supplied.</p>;
  const entries = Object.entries(data);
  const primary = entries.filter(([key]) => !key.startsWith("weighted_"));
  const weighted = entries.filter(([key]) => key.startsWith("weighted_"));
  let index = 0;

  return (
    <div className="grid gap-0.5">
      {primary.map(([key, value]) => (
        <BreakdownRow
          key={key}
          label={key.replace(/_/g, " ")}
          value={displayValue(value)}
          trend={key.endsWith("_trend") ? classifyTrend(value) : null}
          zebra={index++ % 2 === 1}
        />
      ))}
      {weighted.length ? (
        <>
          <p className="mt-3 border-t border-[#E6E9F2] pt-3 text-[10px] font-black uppercase tracking-[0.14em] text-[#9AA1B7]">Recent weighted</p>
          {weighted.map(([key, value]) => (
            <BreakdownRow key={key} label={key.replace(/^weighted_/, "").replace(/_/g, " ")} value={displayValue(value)} zebra={index++ % 2 === 1} />
          ))}
        </>
      ) : null}
    </div>
  );
}

const SECTION_LABELS: Record<string, string> = {
  trend_analysis: "Trend analysis",
  fixture_analysis: "Fixture analysis",
  role_analysis: "Role analysis",
  market_analysis: "Market analysis",
};

type BreakdownStatus = "idle" | "loading" | "ready" | "error";

type PlayerBreakdown = {
  decision: Record<string, unknown> | null;
  projection: Record<string, unknown> | null;
  heatmap: PlayerHeatmapResponse | null;
  shotMap: PlayerShotMapResponse | null;
  mapsStatus: "idle" | "loading" | "ready" | "unavailable";
};

function playerApiId(player: Player) {
  return player.api_id ?? player.id;
}

function playerDirectoryEntry(player: Player): PlayerDirectoryEntry {
  return {
    player_id: playerApiId(player),
    web_name: player.name,
    team_short_name: player.team,
    position: player.position,
  };
}

function samePlayer(a: Player, b: Player) {
  return playerApiId(a) === playerApiId(b) || a.id === b.id;
}

function riskScore(risk: RiskLevel) {
  if (risk === "Low") return 1;
  if (risk === "Medium") return 2;
  return 3;
}

function signalScore(signal: string) {
  const normalized = signal.toLowerCase();
  if (normalized === "buy") return 5;
  if (normalized === "watch") return 4;
  if (normalized === "hold") return 3;
  if (normalized === "sell") return 2;
  return 1;
}

function formatMetric(value: number | null | undefined, suffix = "") {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value.toFixed(1)}${suffix}`;
}

function MetricValue({ value, winning }: { value: ReactNode; winning: boolean }) {
  return (
    <div
      className={`relative flex min-h-[46px] min-w-0 items-center justify-center rounded-xl border px-2 py-2.5 text-center text-xs font-black tabular-nums sm:min-h-0 sm:px-3 sm:py-3 sm:text-sm ${
        winning ? "border-[#BDEFD2] bg-[#ECFBF3] text-[#008F49]" : "border-[#E4E8F1] bg-white text-[#141A35]"
      }`}
    >
      {winning ? <span className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-[#00A85A] text-[10px] text-white">✓</span> : null}
      <span className="min-w-0 max-w-full break-words leading-tight">{value}</span>
    </div>
  );
}

function MetricBattleRow({
  label,
  a,
  b,
  aScore,
  bScore,
  preference = "higher",
  note,
  playerAName = "Player A",
  playerBName = "Player B",
}: {
  label: string;
  a: ReactNode;
  b: ReactNode;
  aScore?: number | null;
  bScore?: number | null;
  preference?: "higher" | "lower" | "neutral";
  note?: string;
  playerAName?: string;
  playerBName?: string;
}) {
  const comparable = preference !== "neutral" && aScore != null && bScore != null && Number.isFinite(aScore) && Number.isFinite(bScore) && aScore !== bScore;
  const aWins = comparable ? (preference === "higher" ? aScore! > bScore! : aScore! < bScore!) : false;
  const bWins = comparable ? !aWins : false;

  return (
    <div className="border-b border-[#EDF0F6] py-4 last:border-0 sm:grid sm:grid-cols-[minmax(160px,1fr)_110px_110px] sm:items-center sm:gap-4 sm:py-3">
      <div className="min-w-0">
        <p className="text-sm font-black text-[#141A35]">{label}</p>
        {note ? <p className="mt-0.5 text-[11px] font-semibold leading-4 text-[#858CA4]">{note}</p> : null}
      </div>

      <div className="mt-3 grid min-w-0 grid-cols-2 gap-2 sm:contents">
        <div className="min-w-0">
          <p className="mb-1.5 truncate text-[10px] font-black uppercase tracking-[0.08em] text-[#7D859D] sm:hidden">{playerAName}</p>
          <MetricValue value={a} winning={aWins} />
        </div>
        <div className="min-w-0">
          <p className="mb-1.5 truncate text-[10px] font-black uppercase tracking-[0.08em] text-[#7D859D] sm:hidden">{playerBName}</p>
          <MetricValue value={b} winning={bWins} />
        </div>
      </div>
    </div>
  );
}

function PlayerHero({ player, label, winner }: { player: Player; label: string; winner: boolean }) {
  return (
    <article className={`relative overflow-hidden rounded-[24px] border bg-white p-4 shadow-[0_18px_50px_rgba(15,23,60,0.08)] sm:p-6 ${winner ? "border-[#00C56A] ring-2 ring-[#00C56A]/12" : "border-[#E1E6F0]"}`}>
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#6C1DFF] via-[#00B8FF] to-[#00C56A]" />
      <div className="flex items-start justify-between gap-3">
        <span className="rounded-full bg-[#F2ECFF] px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-[#6C1DFF]">{label}</span>
        {winner ? <span className="rounded-full bg-[#E9FBF2] px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-[#008F49]">Model pick</span> : null}
      </div>

      <div className="mt-5 flex items-center gap-4">
        <PlayerVisual player={player} size="lg" />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-2xl font-black tracking-tight text-[#101631] sm:text-3xl">{player.name}</h2>
          <p className="mt-1 text-sm font-bold text-[#68708E]">{player.team} · {player.position} · {formatPrice(player.price)}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <FixturePill fixture={player.fixture ?? "TBC"} difficulty={player.fixture_difficulty ?? 3} />
            <RiskBadge value={player.risk} />
          </div>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3">
        <div className="rounded-xl bg-[#F7F8FC] p-3">
          <p className="text-[10px] font-black uppercase tracking-[0.1em] text-[#8A91A9]">Next GW</p>
          <p className="mt-1 text-xl font-black text-[#101631]">{formatMetric(player.projected)}</p>
        </div>
        <div className="rounded-xl bg-[#F7F8FC] p-3">
          <p className="text-[10px] font-black uppercase tracking-[0.1em] text-[#8A91A9]">3 GW</p>
          <p className="mt-1 text-xl font-black text-[#101631]">{formatMetric(player.three_gw_projected)}</p>
        </div>
        <div className="col-span-2 rounded-xl bg-[#F7F8FC] p-3 sm:col-span-1">
          <p className="text-[10px] font-black uppercase tracking-[0.1em] text-[#8A91A9]">Owned</p>
          <p className="mt-1 text-xl font-black text-[#101631]">{formatMetric(player.ownership, "%")}</p>
        </div>
      </div>
    </article>
  );
}

function VerdictPanel({ comparison }: { comparison: PlayerComparison }) {
  const verdict = comparison.verdict;
  return (
    <aside className="relative overflow-hidden rounded-[24px] border border-[#12182A] bg-[#080B16] p-5 text-white shadow-[0_26px_70px_rgba(0,0,0,0.24)] sm:p-6">
      <div className="absolute -right-14 -top-16 h-44 w-44 rounded-full bg-[#6C1DFF]/20 blur-2xl" />
      <div className="absolute -bottom-16 -left-12 h-40 w-40 rounded-full bg-[#00E6A8]/10 blur-2xl" />
      <div className="relative">
        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#A7F3D0]">Ownership verdict</p>
        <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Own {verdict.winner.name}</h2>
        <p className="mt-3 text-sm font-semibold leading-6 text-white/70">{verdict.summary}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <ConfidenceBadge value={verdict.confidence} />
          <RiskBadge value={verdict.risk} />
        </div>

        {verdict.why.length ? (
          <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.06] p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/50">Why the model prefers them</p>
            <ul className="mt-3 space-y-2 text-sm font-semibold leading-5 text-white/80">
              {verdict.why.slice(0, 3).map((reason) => <li key={reason} className="flex gap-2"><span className="text-[#00E6A8]">✓</span><span>{reason}</span></li>)}
            </ul>
          </div>
        ) : null}

        <div className="mt-5 grid gap-2">
          <Link href="/scenarios" className="rounded-xl bg-[#00E6A8] px-4 py-3 text-center text-sm font-black text-[#05070D]">Test this decision</Link>
          <Link href="/watchlist" className="rounded-xl border border-white/16 px-4 py-3 text-center text-sm font-black text-white">Track both players</Link>
        </div>
      </div>
    </aside>
  );
}

function RoleMapCard({ label, breakdown }: { label: string; breakdown: PlayerBreakdown | null }) {
  if (!breakdown || breakdown.mapsStatus === "idle") return null;
  if (breakdown.mapsStatus === "loading") {
    return <div className="rounded-2xl border border-[#E3E7F0] bg-white p-4 text-sm font-semibold text-[#737B97]">Loading {label}&apos;s role map…</div>;
  }
  if (breakdown.mapsStatus === "unavailable" || !breakdown.heatmap) {
    return <div className="rounded-2xl border border-[#E3E7F0] bg-white p-4 text-sm font-semibold text-[#737B97]">Role map unavailable for {label}.</div>;
  }
  return (
    <div className="rounded-[22px] border border-[#12182A] bg-[#080B16] p-4 text-white">
      <p className="mb-3 text-xs font-black uppercase tracking-[0.14em] text-[#A7F3D0]">{label} role map</p>
      <div className="grid gap-4 2xl:grid-cols-2">
        <PlayerHeatmap heatmap={breakdown.heatmap} />
        {breakdown.shotMap ? <ShotMap shotMap={breakdown.shotMap} /> : null}
      </div>
      <div className="mt-4"><RoleMapSummary heatmap={breakdown.heatmap} shotMap={breakdown.shotMap} /></div>
    </div>
  );
}

function BreakdownContent({ breakdown }: { breakdown: PlayerBreakdown }) {
  return (
    <div className="space-y-4">
      {breakdown.decision ? (
        <>
          <div className="rounded-2xl bg-[#F4F0FF] p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#8067B5]">Decision</p>
            <p className="mt-1 text-base font-black text-[#161A35]">{String(breakdown.decision.decision ?? "—")} · {String(breakdown.decision.recommendation_tier ?? "—")}</p>
          </div>
          {(["trend_analysis", "fixture_analysis", "role_analysis", "market_analysis"] as const).map((section) => (
            <div key={section} className="rounded-2xl border border-[#E4E8F1] bg-white p-4">
              <p className="text-xs font-black uppercase tracking-[0.12em] text-[#6C1DFF]">{SECTION_LABELS[section]}</p>
              <div className="mt-3"><KeyValueGrid data={breakdown.decision?.[section]} /></div>
            </div>
          ))}
          <details className="rounded-2xl border border-[#E4E8F1] bg-white p-4">
            <summary className="cursor-pointer text-xs font-black uppercase tracking-[0.12em] text-[#6C1DFF]">Model explanation and evidence</summary>
            <pre className="mt-3 max-h-64 overflow-auto rounded-xl bg-[#080B16] p-4 text-[11px] font-semibold leading-5 text-[#A7F3D0]">
              {JSON.stringify({ explanation: breakdown.decision.explanation, evidence: breakdown.decision.evidence }, null, 2)}
            </pre>
          </details>
        </>
      ) : null}

      {breakdown.projection ? (
        <div className="rounded-2xl border border-[#E4E8F1] bg-white p-4">
          <p className="text-xs font-black uppercase tracking-[0.12em] text-[#6C1DFF]">Projection provenance</p>
          <div className="mt-3 grid gap-0.5">
            {[
              { label: "Trained model", value: String(breakdown.projection.trained_model_version ?? "—") },
              { label: "Fallback used", value: String(breakdown.projection.fallback_used ?? "—") },
              ...(breakdown.projection.fallback_reason ? [{ label: "Fallback reason", value: String(breakdown.projection.fallback_reason) }] : []),
              { label: "Candidate holdout MAE", value: displayValue(breakdown.projection.candidate_holdout_mae) },
              { label: "Champion replay MAE", value: displayValue(breakdown.projection.champion_replay_mae) },
            ].map((row, index) => <BreakdownRow key={row.label} label={row.label} value={row.value} zebra={index % 2 === 1} />)}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function PlayerBreakdownPanel({
  player,
  status,
  error,
  breakdown,
  onLoad,
}: {
  player: Player;
  status: BreakdownStatus;
  error: string;
  breakdown: PlayerBreakdown | null;
  onLoad: () => void;
}) {
  const action = (
    <button
      type="button"
      onClick={onLoad}
      disabled={status === "loading"}
      className="rounded-xl border border-[#D7CCFF] bg-white px-4 py-2 text-xs font-black text-[#6C1DFF] shadow-sm disabled:cursor-wait disabled:opacity-60"
    >
      {status === "loading" ? "Loading…" : status === "ready" ? "Refresh analysis" : "Load full analysis"}
    </button>
  );

  return (
    <>
      <details className="rounded-[22px] border border-[#E1E6F0] bg-white p-4 shadow-[0_18px_50px_rgba(15,23,60,0.06)] lg:hidden">
        <summary className="cursor-pointer list-none">
          <div className="flex items-center gap-3">
            <PlayerVisual player={player} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-black text-[#101631]">{player.name}</p>
              <p className="text-xs font-semibold text-[#7A829C]">Deep model analysis</p>
            </div>
            <span className="text-xl font-black text-[#6C1DFF]">+</span>
          </div>
        </summary>
        <div className="mt-4 border-t border-[#E8EBF2] pt-4">
          {action}
          {status === "error" ? <p className="mt-3 text-xs font-bold text-[#C80046]">{error}</p> : null}
          {status === "ready" && breakdown ? <div className="mt-4"><BreakdownContent breakdown={breakdown} /></div> : null}
        </div>
      </details>

      <section className="hidden rounded-[22px] border border-[#E1E6F0] bg-white p-5 shadow-[0_18px_50px_rgba(15,23,60,0.06)] lg:block">
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <PlayerVisual player={player} size="sm" />
            <div className="min-w-0">
              <p className="truncate text-lg font-black text-[#101631]">{player.name}</p>
              <p className="text-xs font-semibold text-[#7A829C]">Decision, role, market and projection evidence</p>
            </div>
          </div>
          {action}
        </div>
        {status === "error" ? <p className="mt-3 text-xs font-bold text-[#C80046]">{error}</p> : null}
        {status === "ready" && breakdown ? <div className="mt-5"><BreakdownContent breakdown={breakdown} /></div> : null}
      </section>
    </>
  );
}

export function CompareTool({ initialComparison, players }: { initialComparison: PlayerComparison; players: Player[] }) {
  const router = useRouter();
  const resultRef = useRef<HTMLDivElement | null>(null);
  const compareRequestIdRef = useRef(0);

  const [comparison, setComparison] = useState<PlayerComparison>(initialComparison);
  const [directory, setDirectory] = useState<PlayerDirectoryEntry[]>([]);
  const [directoryError, setDirectoryError] = useState("");
  const [selectedAId, setSelectedAId] = useState(playerApiId(initialComparison.player_a));
  const [selectedBId, setSelectedBId] = useState(playerApiId(initialComparison.player_b));
  const [fetchState, setFetchState] = useState<"idle" | "loading" | "error">("idle");
  const [fetchError, setFetchError] = useState("");

  const [breakdownStatusA, setBreakdownStatusA] = useState<BreakdownStatus>("idle");
  const [breakdownErrorA, setBreakdownErrorA] = useState("");
  const [breakdownA, setBreakdownA] = useState<PlayerBreakdown | null>(null);
  const [breakdownStatusB, setBreakdownStatusB] = useState<BreakdownStatus>("idle");
  const [breakdownErrorB, setBreakdownErrorB] = useState("");
  const [breakdownB, setBreakdownB] = useState<PlayerBreakdown | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getPlayersDirectory()
      .then((result) => {
        if (!cancelled) setDirectory(result.data);
      })
      .catch((error) => {
        if (!cancelled) setDirectoryError(error instanceof Error ? error.message : "Player directory unavailable.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const fallbackDirectory = useMemo(() => {
    const entries = new Map<number, PlayerDirectoryEntry>();
    for (const player of [...players, initialComparison.player_a, initialComparison.player_b, comparison.player_a, comparison.player_b]) {
      entries.set(playerApiId(player), playerDirectoryEntry(player));
    }
    return [...entries.values()];
  }, [players, initialComparison, comparison]);

  const pickerDirectory = directory.length ? directory : fallbackDirectory;
  const selectedA = pickerDirectory.find((entry) => entry.player_id === selectedAId) ?? playerDirectoryEntry(comparison.player_a);
  const selectedB = pickerDirectory.find((entry) => entry.player_id === selectedBId) ?? playerDirectoryEntry(comparison.player_b);
  const currentAId = playerApiId(comparison.player_a);
  const currentBId = playerApiId(comparison.player_b);
  const selectionDirty = selectedAId !== currentAId || selectedBId !== currentBId;

  async function runCompare(idA = selectedAId, idB = selectedBId) {
    if (!idA || !idB || idA === idB) return;
    const requestId = ++compareRequestIdRef.current;
    setFetchState("loading");
    setFetchError("");
    try {
      const result = await getPlayerComparison([idA, idB]);
      if (requestId !== compareRequestIdRef.current) return;
      if (result.source.mode !== "real") throw new Error("The comparison endpoint did not return live data.");
      setComparison(result.data);
      setSelectedAId(playerApiId(result.data.player_a));
      setSelectedBId(playerApiId(result.data.player_b));
      setBreakdownStatusA("idle");
      setBreakdownStatusB("idle");
      setBreakdownA(null);
      setBreakdownB(null);
      setFetchState("idle");
      router.replace(`/compare?a=${idA}&b=${idB}`, { scroll: false });
      requestAnimationFrame(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    } catch (error) {
      if (requestId !== compareRequestIdRef.current) return;
      setFetchState("error");
      setFetchError(error instanceof Error ? error.message : "Could not compare these players.");
    }
  }

  function swapPlayers() {
    setSelectedAId(selectedBId);
    setSelectedBId(selectedAId);
  }

  async function loadBreakdown(side: "A" | "B") {
    const player = side === "A" ? comparison.player_a : comparison.player_b;
    const apiId = playerApiId(player);
    const setStatus = side === "A" ? setBreakdownStatusA : setBreakdownStatusB;
    const setError = side === "A" ? setBreakdownErrorA : setBreakdownErrorB;
    const setBreakdown = side === "A" ? setBreakdownA : setBreakdownB;

    setStatus("loading");
    setError("");
    try {
      const [decisionResult, projectionResult] = await Promise.all([
        getPlayerDecisionBreakdown(apiId),
        getPlayerProjectionDetail(apiId),
      ]);
      setBreakdown({ decision: decisionResult.data, projection: projectionResult.data, heatmap: null, shotMap: null, mapsStatus: "loading" });
      setStatus("ready");

      try {
        const heatmapResult = await getPlayerHeatmap(apiId, 5, ["touch", "shot", "pass", "defensive_action"]);
        let shotMapResult: PlayerShotMapResponse | null = null;
        try {
          shotMapResult = await getPlayerShotMap(apiId, 5);
        } catch {
          shotMapResult = null;
        }
        setBreakdown({ decision: decisionResult.data, projection: projectionResult.data, heatmap: heatmapResult, shotMap: shotMapResult, mapsStatus: "ready" });
      } catch {
        setBreakdown({ decision: decisionResult.data, projection: projectionResult.data, heatmap: null, shotMap: null, mapsStatus: "unavailable" });
      }
    } catch (error) {
      setStatus("error");
      setError(error instanceof Error ? error.message : "Could not load full player analysis.");
    }
  }

  const playerA = comparison.player_a;
  const playerB = comparison.player_b;
  const metrics = comparison.metrics;
  const winnerIsA = samePlayer(comparison.verdict.winner, playerA);
  const winnerIsB = samePlayer(comparison.verdict.winner, playerB);
  const stockA = metrics.stock_signal[0];
  const stockB = metrics.stock_signal[1];

  return (
    <div className="min-w-0 space-y-6">
      <section className="min-w-0 rounded-[24px] border border-[#E1E6F0] bg-white p-4 shadow-[0_18px_55px_rgba(15,23,60,0.07)] sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#6C1DFF]">Head-to-head lab</p>
            <h2 className="mt-2 text-2xl font-black tracking-tight text-[#101631] sm:text-3xl">Compare any two Premier League players</h2>
            <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-[#69708F]">Use the live projection, fixture, market and role models to decide who deserves the squad place.</p>
          </div>
          <div className="flex flex-wrap gap-2 text-[11px] font-black">
            <span className="rounded-full bg-[#EEF9F4] px-3 py-1.5 text-[#008F49]">Live projections</span>
            <span className="rounded-full bg-[#F3EEFF] px-3 py-1.5 text-[#6C1DFF]">Full-league directory</span>
            <span className="rounded-full bg-[#EEF7FF] px-3 py-1.5 text-[#007AA8]">Role maps</span>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-end lg:grid-cols-[1fr_auto_1fr_auto]">
          <PlayerSlotPicker
            label="Player A"
            selected={selectedA}
            otherSelectedId={selectedBId}
            directory={pickerDirectory}
            onSelect={(entry) => setSelectedAId(entry.player_id)}
          />
          <button
            type="button"
            onClick={swapPlayers}
            className="mx-auto grid h-11 w-11 place-items-center rounded-full border border-[#D9DFF0] bg-white text-lg font-black text-[#6C1DFF] shadow-sm transition hover:-rotate-180 sm:mb-0"
            aria-label="Swap players"
          >
            ⇄
          </button>
          <PlayerSlotPicker
            label="Player B"
            selected={selectedB}
            otherSelectedId={selectedAId}
            directory={pickerDirectory}
            onSelect={(entry) => setSelectedBId(entry.player_id)}
          />
          <button
            type="button"
            onClick={() => void runCompare()}
            disabled={!selectionDirty || fetchState === "loading" || selectedAId === selectedBId}
            className="rounded-xl bg-[#6C1DFF] px-5 py-3 text-sm font-black text-white shadow-[0_12px_28px_rgba(108,29,255,0.22)] disabled:cursor-not-allowed disabled:opacity-40 sm:col-span-3 lg:col-span-1"
          >
            {fetchState === "loading" ? "Comparing…" : selectionDirty ? "Run comparison" : "Comparison current"}
          </button>
        </div>

        {selectionDirty ? <p className="mt-3 text-xs font-bold text-[#6C1DFF]">Selection changed. Run the comparison to update the verdict and metrics.</p> : null}
        {directoryError ? <p className="mt-3 text-xs font-semibold text-[#B97800]">Full player directory could not load; currently known players remain available.</p> : null}
        {fetchState === "error" ? <p className="mt-3 text-xs font-bold text-[#C80046]">{fetchError}</p> : null}
      </section>

      <div ref={resultRef} className="scroll-mt-4">
        <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px_minmax(0,1fr)] xl:items-stretch">
          <PlayerHero player={playerA} label="Player A" winner={winnerIsA} />
          <div className="order-first xl:order-none"><VerdictPanel comparison={comparison} /></div>
          <PlayerHero player={playerB} label="Player B" winner={winnerIsB} />
        </section>
      </div>

      <section className="rounded-[24px] border border-[#E1E6F0] bg-white p-4 shadow-[0_18px_55px_rgba(15,23,60,0.07)] sm:p-6">
        <div className="flex flex-col gap-3 border-b border-[#E9ECF3] pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#6C1DFF]">Metric battle</p>
            <h2 className="mt-1 text-2xl font-black text-[#101631]">Where each player wins</h2>
          </div>
          <div className="hidden grid-cols-[1fr_110px_110px] gap-4 text-center text-[11px] font-black uppercase tracking-[0.08em] text-[#7D859D] sm:grid">
            <span />
            <span className="truncate">{playerA.name}</span>
            <span className="truncate">{playerB.name}</span>
          </div>
        </div>

        <div className="mt-4 grid min-w-0 grid-cols-2 gap-2 sm:hidden">
          <div className="min-w-0 rounded-xl bg-[#F4F0FF] px-3 py-2">
            <p className="text-[9px] font-black uppercase tracking-[0.1em] text-[#8067B5]">Player A</p>
            <p className="truncate text-xs font-black text-[#101631]">{playerA.name}</p>
          </div>
          <div className="min-w-0 rounded-xl bg-[#EEF9F4] px-3 py-2">
            <p className="text-[9px] font-black uppercase tracking-[0.1em] text-[#008F49]">Player B</p>
            <p className="truncate text-xs font-black text-[#101631]">{playerB.name}</p>
          </div>
        </div>

        <div className="mt-2 min-w-0">
          <MetricBattleRow playerAName={playerA.name} playerBName={playerB.name} label="Next-GW projection" note="Immediate expected points" a={formatMetric(metrics.projected_next_gw[0], " pts")} b={formatMetric(metrics.projected_next_gw[1], " pts")} aScore={metrics.projected_next_gw[0]} bScore={metrics.projected_next_gw[1]} />
          <MetricBattleRow playerAName={playerA.name} playerBName={playerB.name} label="Three-GW projection" note="Medium-term squad value" a={formatMetric(metrics.three_gw_projection[0], " pts")} b={formatMetric(metrics.three_gw_projection[1], " pts")} aScore={metrics.three_gw_projection[0]} bScore={metrics.three_gw_projection[1]} />
          <MetricBattleRow playerAName={playerA.name} playerBName={playerB.name} label="Fixture difficulty" note="Lower is better" a={metrics.fixture_difficulty[0]} b={metrics.fixture_difficulty[1]} aScore={metrics.fixture_difficulty[0]} bScore={metrics.fixture_difficulty[1]} preference="lower" />
          <MetricBattleRow playerAName={playerA.name} playerBName={playerB.name} label="Minutes risk" note="Lower availability risk is better" a={<RiskBadge value={metrics.minutes_risk[0]} />} b={<RiskBadge value={metrics.minutes_risk[1]} />} aScore={riskScore(metrics.minutes_risk[0])} bScore={riskScore(metrics.minutes_risk[1])} preference="lower" />
          <MetricBattleRow playerAName={playerA.name} playerBName={playerB.name} label="Form" note="Recent FPL output" a={formatMetric(metrics.form[0])} b={formatMetric(metrics.form[1])} aScore={metrics.form[0]} bScore={metrics.form[1]} />
          <MetricBattleRow playerAName={playerA.name} playerBName={playerB.name} label="Market signal" note="Modelled buy / hold / sell state" a={<SignalBadge value={stockA} />} b={<SignalBadge value={stockB} />} aScore={signalScore(stockA)} bScore={signalScore(stockB)} />
          <MetricBattleRow playerAName={playerA.name} playerBName={playerB.name} label="Ownership" note="Popularity, not a quality score" a={formatMetric(metrics.ownership[0], "%")} b={formatMetric(metrics.ownership[1], "%")} preference="neutral" />
          <MetricBattleRow playerAName={playerA.name} playerBName={playerB.name} label="Price" note="Budget impact, lower is cheaper" a={formatPrice(playerA.price)} b={formatPrice(playerB.price)} aScore={playerA.price} bScore={playerB.price} preference="lower" />
        </div>
      </section>

      {comparison.verdict.why_this_could_be_wrong.length ? (
        <section className="rounded-[22px] border border-[#FFE2BA] bg-[#FFF9EE] p-5">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[#B97800]">What could change the verdict?</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {comparison.verdict.why_this_could_be_wrong.map((item) => (
              <p key={item} className="rounded-xl bg-white/80 p-3 text-sm font-semibold leading-6 text-[#6E5200]">{item}</p>
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <div className="mb-4">
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#6C1DFF]">Advanced player intelligence</p>
          <h2 className="mt-1 text-2xl font-black text-[#101631]">Load the evidence behind the comparison</h2>
          <p className="mt-2 text-sm font-semibold text-[#69708F]">Trend, fixture, role, market and projection provenance remain optional so the main decision stays fast to scan.</p>
        </div>
        <div className="grid gap-5 lg:grid-cols-2">
          <PlayerBreakdownPanel player={playerA} status={breakdownStatusA} error={breakdownErrorA} breakdown={breakdownA} onLoad={() => void loadBreakdown("A")} />
          <PlayerBreakdownPanel player={playerB} status={breakdownStatusB} error={breakdownErrorB} breakdown={breakdownB} onLoad={() => void loadBreakdown("B")} />
        </div>
      </section>

      {[breakdownA, breakdownB].some((breakdown) => breakdown && breakdown.mapsStatus !== "idle") ? (
        <section className="space-y-4">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#6C1DFF]">On-pitch role comparison</p>
            <h2 className="mt-1 text-2xl font-black text-[#101631]">Where they actually operate</h2>
          </div>
          <div className="grid gap-5">
            <RoleMapCard label={playerA.name} breakdown={breakdownA} />
            <RoleMapCard label={playerB.name} breakdown={breakdownB} />
          </div>
        </section>
      ) : null}

      {selectionDirty ? (
        <div className="fixed inset-x-3 bottom-20 z-30 sm:hidden">
          <button
            type="button"
            onClick={() => void runCompare()}
            disabled={fetchState === "loading" || selectedAId === selectedBId}
            className="w-full rounded-2xl bg-[#6C1DFF] px-5 py-4 text-sm font-black text-white shadow-[0_18px_50px_rgba(57,20,130,0.35)] disabled:opacity-50"
          >
            {fetchState === "loading" ? "Comparing players…" : `Compare ${selectedA.web_name} vs ${selectedB.web_name}`}
          </button>
        </div>
      ) : null}
    </div>
  );
}