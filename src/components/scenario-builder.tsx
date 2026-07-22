"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  analyseCustomScenario,
  getSavedScenarioSimulation,
  saveScenarioSimulation,
  type PlayerDirectoryEntry,
  type ScenarioCardPlayer,
  type ScenarioCustomResult,
} from "@/lib/api";
import type { ConfidenceBand, Player, RiskLevel, TransferRoute } from "@/lib/types";
import { ConfidenceBadge, RiskBadge } from "./badges";
import { TransferRouteCard } from "./cards";
import { PlayerSlotPicker } from "./compare-any-two-players";
import { FixturePill, formatPrice } from "./fpl-ui";
import { PlayerVisual, TeamShirtImage } from "./player-visual";

type ScenarioMode = "transfer" | "captaincy";
type MobileView = "build" | "compare";
type AsyncStatus = "idle" | "loading" | "ready" | "error";
type DirectoryStatus = "loading" | "ready" | "error";
type RecommendationStatus = "loading" | "ready" | "error";

type RecentSavedScenario = {
  id: number;
  name: string;
  createdAt: string;
};

const RECENT_SCENARIOS_KEY = "fpl-os-recent-scenarios-v1";

const EMPTY_PLAYER: Player = {
  id: 0,
  name: "Player unavailable",
  team: "TBC",
  position: "MID",
  price: 0,
  projected: 0,
  fixture: "TBC",
  fixture_difficulty: 3,
  ownership: 0,
  status: "Available",
  risk: "Low",
};

function findPlayer(players: Player[], id: number) {
  return players.find((player) => player.id === id) ?? players[0] ?? EMPTY_PLAYER;
}

function apiPlayerId(player?: Player | null) {
  return player ? player.api_id ?? player.id : undefined;
}

function findDirectoryEntry(directory: PlayerDirectoryEntry[], apiId: unknown): PlayerDirectoryEntry | null {
  return directory.find((entry) => entry.player_id === apiId) ?? null;
}

function signed(value: number, digits = 1) {
  if (!Number.isFinite(value)) return "—";
  return `${value > 0 ? "+" : ""}${value.toFixed(digits)}`;
}

function points(value: number | null | undefined, digits = 1) {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value.toFixed(digits)} pts`;
}

function buildResultExplanation(result: ScenarioCustomResult, recommendedRoute: TransferRoute, diffAgainstRecommended: number): string[] {
  const sentences: string[] = [];
  const out = result.out_player;
  const inPlayer = result.in_player;

  if (out && inPlayer) {
    const edge = Number((inPlayer.expected_points - out.expected_points).toFixed(1));
    const outStr = out.expected_points.toFixed(1);
    const inStr = inPlayer.expected_points.toFixed(1);
    const netStr = signed(result.net_projected_gain_after_hit, 2);
    const hitClause = result.hit_cost > 0 ? `, reduced by the -${result.hit_cost} hit,` : "";

    if (edge > 0.3) {
      sentences.push(
        `${inPlayer.web_name} projects ${inStr} points against ${out.web_name}'s ${outStr}, a ${edge.toFixed(1)}-point player edge${hitClause} with ${netStr} points net once the full squad and captaincy are included.`,
      );
    } else if (edge < -0.3) {
      sentences.push(
        `${inPlayer.web_name} projects below ${out.web_name} this week (${inStr} versus ${outStr}), so the transfer itself does not create a points edge${hitClause}.`,
      );
    } else {
      sentences.push(
        `${inPlayer.web_name} and ${out.web_name} project almost identically (${inStr} versus ${outStr}), making the transfer close to points-neutral before the rest of the scenario is considered.`,
      );
    }
  }

  const recommendedWhy = recommendedRoute.why[0];
  if (diffAgainstRecommended < -1) {
    sentences.push(
      `The scenario finishes ${Math.abs(diffAgainstRecommended).toFixed(1)} points behind the recommended move (${recommendedRoute.move})${
        recommendedWhy ? ` because ${recommendedWhy.charAt(0).toLowerCase()}${recommendedWhy.slice(1).replace(/\.$/, "")}.` : "."
      }`,
    );
  } else if (diffAgainstRecommended > 1) {
    sentences.push(
      `The scenario is ${diffAgainstRecommended.toFixed(1)} points ahead of the current recommendation (${recommendedRoute.move} at ${signed(recommendedRoute.expected_gain)} points).`,
    );
  } else {
    sentences.push(
      `The scenario is within ${Math.abs(diffAgainstRecommended).toFixed(1)} points of the recommendation, so both routes remain defensible on current projections.`,
    );
  }

  if (result.captain) {
    const captainProjection = result.captain.expected_points.toFixed(1);
    const doubled = (result.captain.expected_points * 2).toFixed(1);
    const viceClause = result.vice_captain
      ? ` ${result.vice_captain.web_name} remains the fallback if ${result.captain.web_name} does not play.`
      : "";
    sentences.push(`${result.captain.web_name}'s ${captainProjection}-point projection contributes ${doubled} points with the armband.${viceClause}`);
  }

  return sentences;
}

function cardToPlayer(card: ScenarioCardPlayer | null, fallback: Player, platformPlayers: Player[]): Player {
  const platformPlayer = card
    ? platformPlayers.find((player) => apiPlayerId(player) === card.player_id || player.id === card.player_id)
    : undefined;
  const rawPosition = card?.position;
  const position: Player["position"] =
    rawPosition === "GK" || rawPosition === "DEF" || rawPosition === "MID" || rawPosition === "FWD"
      ? rawPosition
      : platformPlayer?.position ?? fallback.position;

  return {
    ...fallback,
    ...platformPlayer,
    id: card?.player_id ?? platformPlayer?.id ?? fallback.id,
    api_id: card?.player_id ?? platformPlayer?.api_id ?? fallback.api_id,
    code: card?.code ?? platformPlayer?.code ?? fallback.code,
    name: card?.web_name ?? platformPlayer?.name ?? fallback.name,
    team: card?.team_short_name ?? card?.team ?? platformPlayer?.team ?? fallback.team,
    position,
    price: card?.price ?? platformPlayer?.price ?? fallback.price,
    projected: card?.expected_points ?? platformPlayer?.projected ?? fallback.projected,
    fixture: platformPlayer?.fixture ?? fallback.fixture ?? "TBC",
    fixture_difficulty: platformPlayer?.fixture_difficulty ?? fallback.fixture_difficulty ?? 3,
    ownership: platformPlayer?.ownership ?? fallback.ownership,
    three_gw_projected: platformPlayer?.three_gw_projected ?? fallback.three_gw_projected,
    status: platformPlayer?.status ?? fallback.status,
    risk:
      card?.risk_level === "high"
        ? "High"
        : card?.risk_level === "medium"
          ? "Medium"
          : platformPlayer?.risk ?? fallback.risk,
    role: card?.decision ?? platformPlayer?.role ?? fallback.role,
  };
}

function directoryEntryToPlayer(entry: PlayerDirectoryEntry | null): Player | null {
  if (!entry) return null;
  const position: Player["position"] =
    entry.position === "GK" || entry.position === "DEF" || entry.position === "MID" || entry.position === "FWD"
      ? entry.position
      : "MID";
  return {
    id: entry.player_id,
    api_id: entry.player_id,
    name: entry.web_name,
    team: entry.team_short_name,
    position,
    price: 0,
    projected: 0,
    fixture: "TBC",
    fixture_difficulty: 3,
    status: "Available",
    risk: "Low",
  };
}

function PlayerMetric({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "green" | "pink" | "amber" }) {
  const toneClass =
    tone === "green"
      ? "text-[#008F4C]"
      : tone === "pink"
        ? "text-[#D9004A]"
        : tone === "amber"
          ? "text-[#B57700]"
          : "text-[#101947]";
  return (
    <div className="rounded-xl bg-[#F7F8FC] px-3 py-2.5">
      <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#737A9B]">{label}</p>
      <p className={`mt-1 text-sm font-black ${toneClass}`}>{value}</p>
    </div>
  );
}

function SquadPlayerCard({ label, player, tone }: { label: string; player: Player; tone: "pink" | "purple" }) {
  const labelClass = tone === "pink" ? "bg-[#FFF0F5] text-[#D9004A]" : "bg-[#F1E8FF] text-[#6C1DFF]";
  return (
    <div className="rounded-2xl border border-[#E1E7F2] bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <span className={`rounded-lg px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${labelClass}`}>{label}</span>
        <FixturePill fixture={player.fixture ?? "TBC"} difficulty={player.fixture_difficulty ?? 3} />
      </div>
      <div className="mt-4 flex items-center gap-3">
        <PlayerVisual player={player} size="sm" />
        <div className="min-w-0">
          <p className="truncate text-base font-black text-[#101947]">{player.name}</p>
          <p className="text-xs font-bold text-[#737A9B]">{player.team} / {player.position}</p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <PlayerMetric label="Price" value={formatPrice(player.price)} />
        <PlayerMetric label="Next GW" value={points(player.projected)} tone="green" />
        <PlayerMetric label="3-GW" value={points(player.three_gw_projected)} />
        <PlayerMetric label="Owned" value={player.ownership == null ? "—" : `${player.ownership.toFixed(1)}%`} />
      </div>
    </div>
  );
}

function IncomingPlayerCard({ entry, directoryStatus }: { entry: PlayerDirectoryEntry | null; directoryStatus: DirectoryStatus }) {
  const player = directoryEntryToPlayer(entry);
  return (
    <div className="rounded-2xl border border-[#E1E7F2] bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="rounded-lg bg-[#EFFFF5] px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-[#008F4C]">Buy</span>
        <span className="rounded-full bg-[#F7F8FC] px-3 py-1 text-[10px] font-black text-[#737A9B]">
          {directoryStatus === "loading" ? "Loading players" : "Same position"}
        </span>
      </div>
      {player ? (
        <div className="mt-4 flex min-h-[92px] items-center gap-3">
          <span className="grid h-12 w-12 shrink-0 place-items-center">
            <TeamShirtImage team={player.team} position={player.position} size={66} className="h-full w-full object-contain" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-base font-black text-[#101947]">{player.name}</p>
            <p className="text-xs font-bold text-[#737A9B]">{player.team} / {player.position}</p>
            <p className="mt-2 text-xs font-black text-[#6C1DFF]">Full metrics appear in the analysed result</p>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex min-h-[92px] items-center justify-center rounded-xl border border-dashed border-[#DDE3F0] bg-[#FBFCFF] px-4 text-center">
          <p className="text-sm font-bold text-[#737A9B]">Choose a non-owned {directoryStatus === "loading" ? "player once loading completes" : "player"}.</p>
        </div>
      )}
    </div>
  );
}

function CaptainChoice({
  label,
  value,
  players,
  excludeId,
  onChange,
}: {
  label: string;
  value: number;
  players: Player[];
  excludeId?: number;
  onChange: (value: number) => void;
}) {
  const selectable = players.slice(0, 15).filter((player) => player.id !== excludeId);
  const selected = findPlayer(players, value);
  return (
    <label className="block rounded-2xl border border-[#E1E7F2] bg-white p-4">
      <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[#737A9B]">{label}</span>
      <div className="mt-3 flex items-center gap-3">
        <PlayerVisual player={selected} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-black text-[#101947]">{selected.name}</p>
          <p className="text-xs font-bold text-[#737A9B]">{points(selected.projected)} projected</p>
        </div>
      </div>
      <select
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-3 w-full rounded-xl border border-[#DDE3F0] bg-white px-3 py-2.5 text-sm font-bold text-[#101947] outline-none focus:border-[#6C1DFF] focus:ring-2 focus:ring-[#6C1DFF]/10"
      >
        {selectable.map((player) => (
          <option key={player.id} value={player.id}>
            {player.name} - {player.team} - {points(player.projected)}
          </option>
        ))}
      </select>
    </label>
  );
}

function SummaryItem({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "green" | "pink" | "amber" }) {
  const toneClass =
    tone === "green"
      ? "text-[#008F4C]"
      : tone === "pink"
        ? "text-[#D9004A]"
        : tone === "amber"
          ? "text-[#B57700]"
          : "text-[#101947]";
  return (
    <div className="flex items-center justify-between gap-4 border-b border-[#EDF0F6] py-3 last:border-b-0">
      <span className="text-sm font-semibold text-[#626A8B]">{label}</span>
      <span className={`text-right text-sm font-black ${toneClass}`}>{value}</span>
    </div>
  );
}

function ResultPlayerCard({ label, player, tone }: { label: string; player: Player; tone: "pink" | "green" | "purple" | "cyan" }) {
  const toneClass = {
    pink: "bg-[#FFF0F5] text-[#D9004A]",
    green: "bg-[#EFFFF5] text-[#008F4C]",
    purple: "bg-[#F1E8FF] text-[#6C1DFF]",
    cyan: "bg-[#E9F9FF] text-[#007EA8]",
  }[tone];
  return (
    <article className="flex h-full flex-col rounded-2xl border border-[#E1E7F2] bg-white p-4 shadow-[0_14px_34px_rgba(15,23,60,0.05)]">
      <div className="flex items-center justify-between gap-3">
        <span className={`rounded-lg px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${toneClass}`}>{label}</span>
        <FixturePill fixture={player.fixture ?? "TBC"} difficulty={player.fixture_difficulty ?? 3} />
      </div>
      <div className="mt-4 flex items-center gap-3">
        <PlayerVisual player={player} size="sm" />
        <div className="min-w-0">
          <p className="truncate text-base font-black text-[#101947]">{player.name}</p>
          <p className="text-xs font-bold text-[#737A9B]">{player.team} / {player.position}</p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <PlayerMetric label="Price" value={formatPrice(player.price)} />
        <PlayerMetric label="Next GW" value={points(player.projected)} tone="green" />
        <PlayerMetric label="3-GW" value={points(player.three_gw_projected)} />
        <PlayerMetric label="Owned" value={player.ownership == null ? "—" : `${player.ownership.toFixed(1)}%`} />
      </div>
    </article>
  );
}

function ComparisonRow({ label, scenario, recommended, emphasis }: { label: string; scenario: string; recommended: string; emphasis?: boolean }) {
  return (
    <div className={`grid grid-cols-[1.2fr_0.9fr_0.9fr] items-center gap-3 border-b border-white/10 py-3 last:border-b-0 ${emphasis ? "text-base" : "text-sm"}`}>
      <span className="font-semibold text-white/62">{label}</span>
      <span className={`text-right font-black ${emphasis ? "text-[#00E6A8]" : "text-white"}`}>{scenario}</span>
      <span className="text-right font-black text-white/76">{recommended}</span>
    </div>
  );
}

function RecentSavedScenarios({
  items,
  loadingId,
  onLoad,
}: {
  items: RecentSavedScenario[];
  loadingId: number | null;
  onLoad: (id: number) => void;
}) {
  if (!items.length) return <p className="text-sm font-semibold text-[#737A9B]">Saved scenarios from this browser will appear here.</p>;
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onLoad(item.id)}
          disabled={loadingId === item.id}
          className="flex w-full items-center justify-between gap-3 rounded-xl border border-[#E1E7F2] bg-white px-3 py-3 text-left transition hover:border-[#BCA6FF] disabled:cursor-wait disabled:opacity-60"
        >
          <span className="min-w-0">
            <span className="block truncate text-sm font-black text-[#101947]">{item.name}</span>
            <span className="block text-xs font-semibold text-[#737A9B]">{new Date(item.createdAt).toLocaleString()}</span>
          </span>
          <span className="shrink-0 text-xs font-black text-[#6C1DFF]">{loadingId === item.id ? "Loading" : "Open"}</span>
        </button>
      ))}
    </div>
  );
}

export function ScenarioBuilder({
  players,
  payload,
  directory,
  directoryStatus,
  directoryMessage,
  recommendedRoute,
  recommendationStatus,
  recommendationMessage,
  entryId,
}: {
  players: Player[];
  payload: Record<string, unknown>;
  directory: PlayerDirectoryEntry[];
  directoryStatus: DirectoryStatus;
  directoryMessage?: string;
  recommendedRoute: TransferRoute;
  recommendationStatus: RecommendationStatus;
  recommendationMessage?: string;
  entryId?: string;
}) {
  const [mode, setMode] = useState<ScenarioMode>("transfer");
  const [mobileView, setMobileView] = useState<MobileView>("build");
  const [playerOutId, setPlayerOutId] = useState(players[3]?.id ?? players[0]?.id ?? 0);
  const [playerIn, setPlayerIn] = useState<PlayerDirectoryEntry | null>(null);
  const [captainId, setCaptainId] = useState(players.find((player) => player.role === "captain")?.id ?? players[8]?.id ?? players[0]?.id ?? 0);
  const [viceCaptainId, setViceCaptainId] = useState(
    players.find((player) => player.role === "vice captain")?.id ?? players[4]?.id ?? players[1]?.id ?? players[0]?.id ?? 0,
  );
  const [benchSwitch, setBenchSwitch] = useState(false);
  const [hitCost, setHitCost] = useState<0 | 4 | 8>(0);

  const [runStatus, setRunStatus] = useState<AsyncStatus>("idle");
  const [runError, setRunError] = useState("");
  const [scenarioResult, setScenarioResult] = useState<ScenarioCustomResult | null>(null);
  const resultRef = useRef<HTMLDivElement | null>(null);

  const [saveStatus, setSaveStatus] = useState<AsyncStatus>("idle");
  const [saveError, setSaveError] = useState("");
  const [savedSimulationId, setSavedSimulationId] = useState<number | null>(null);
  const [recentSaved, setRecentSaved] = useState<RecentSavedScenario[]>([]);

  const [loadIdInput, setLoadIdInput] = useState("");
  const [loadStatus, setLoadStatus] = useState<AsyncStatus>("idle");
  const [loadError, setLoadError] = useState("");
  const [loadingSavedId, setLoadingSavedId] = useState<number | null>(null);

  const outgoing = findPlayer(players, playerOutId);
  const captain = findPlayer(players, captainId);
  const vice = findPlayer(players, viceCaptainId);

  useEffect(() => {
    if (captainId !== viceCaptainId) return;
    const replacement = players.slice(0, 15).find((player) => player.id !== captainId && player.position !== "GK") ?? players.find((player) => player.id !== captainId);
    if (replacement) setViceCaptainId(replacement.id);
  }, [captainId, viceCaptainId, players]);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(RECENT_SCENARIOS_KEY);
      const parsed = stored ? JSON.parse(stored) : [];
      if (Array.isArray(parsed)) setRecentSaved(parsed.slice(0, 6));
    } catch {
      setRecentSaved([]);
    }
  }, []);

  const squadApiIds = useMemo(() => new Set(players.slice(0, 15).map(apiPlayerId)), [players]);
  const inDirectory = useMemo(
    () => directory.filter((entry) => !squadApiIds.has(entry.player_id) && entry.position === outgoing.position),
    [directory, squadApiIds, outgoing.position],
  );

  useEffect(() => {
    if (playerIn && playerIn.position !== outgoing.position) setPlayerIn(null);
  }, [outgoing.position, playerIn]);

  const requiresTransfer = mode === "transfer";
  const requestPayload = useMemo(() => {
    if (requiresTransfer && !playerIn) return null;
    const scenarioName = requiresTransfer && playerIn ? `${outgoing.name} to ${playerIn.web_name}` : `Captain ${captain.name}`;
    return {
      ...payload,
      scenarios: [
        {
          scenario_id: "ui_custom_scenario",
          name: scenarioName,
          // A captaincy-only test uses the already-supported roll shape: no transfer, but the
          // chosen captain and vice are still evaluated by the scenario engine.
          scenario_type: requiresTransfer ? (benchSwitch ? "bench_switch_transfer" : "transfer") : "roll",
          transfers:
            requiresTransfer && playerIn
              ? [{ out_player_id: apiPlayerId(outgoing), in_player_id: playerIn.player_id }]
              : [],
          captain_id: apiPlayerId(captain),
          vice_captain_id: apiPlayerId(vice),
          hit_cost: requiresTransfer ? hitCost : 0,
        },
      ],
      auto_generate: false,
      save: false,
    };
  }, [payload, requiresTransfer, playerIn, outgoing, benchSwitch, captain, vice, hitCost]);

  const scenarioName = requiresTransfer
    ? `${outgoing.name} → ${playerIn?.web_name ?? "Select player"}`
    : `${captain.name} captain, ${vice.name} vice`;

  function resetResult() {
    setRunStatus("idle");
    setRunError("");
    setScenarioResult(null);
    setSaveStatus("idle");
    setSaveError("");
    setSavedSimulationId(null);
  }

  function changeMode(nextMode: ScenarioMode) {
    setMode(nextMode);
    if (nextMode === "captaincy") {
      setBenchSwitch(false);
      setHitCost(0);
    }
    resetResult();
  }

  async function handleRunScenario() {
    if (!requestPayload) return;
    setRunStatus("loading");
    setRunError("");
    try {
      const response = await analyseCustomScenario(requestPayload);
      setScenarioResult(response.data);
      setRunStatus("ready");
      setMobileView("compare");
      window.setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
    } catch (error) {
      setRunStatus("error");
      setRunError(error instanceof Error ? error.message : "Could not analyse this scenario.");
    }
  }

  async function handleSaveScenario() {
    if (!requestPayload) return;
    setSaveStatus("loading");
    setSaveError("");
    try {
      const response = await saveScenarioSimulation({ entry_id: entryId, simulation: requestPayload });
      const savedId = response.data.simulation_id;
      setSavedSimulationId(savedId);
      setSaveStatus("ready");
      const item: RecentSavedScenario = { id: savedId, name: scenarioName, createdAt: new Date().toISOString() };
      setRecentSaved((current) => {
        const next = [item, ...current.filter((entry) => entry.id !== savedId)].slice(0, 6);
        try {
          window.localStorage.setItem(RECENT_SCENARIOS_KEY, JSON.stringify(next));
        } catch {
          // Local history is a convenience only; the backend save already succeeded.
        }
        return next;
      });
    } catch (error) {
      setSaveStatus("error");
      setSaveError(error instanceof Error ? error.message : "Could not save this scenario.");
    }
  }

  const handleLoadScenario = useCallback(
    async (idText: string) => {
      const id = Number(idText);
      if (!Number.isFinite(id) || id <= 0) {
        setLoadStatus("error");
        setLoadError("Enter a valid saved scenario ID.");
        return;
      }
      setLoadingSavedId(id);
      setLoadStatus("loading");
      setLoadError("");
      try {
        const response = await getSavedScenarioSimulation(id);
        const simulation = response.data.simulation as Record<string, unknown>;
        const scenarios = Array.isArray(simulation.scenarios) ? simulation.scenarios : [];
        const scenario = scenarios[0] as Record<string, unknown> | undefined;
        if (!scenario) throw new Error("The saved scenario contains no decision data.");

        const transfers = Array.isArray(scenario.transfers) ? scenario.transfers : [];
        const transfer = transfers[0] as Record<string, unknown> | undefined;
        const outPlayer = transfer ? players.find((player) => apiPlayerId(player) === transfer.out_player_id) : undefined;
        const inEntry = transfer ? findDirectoryEntry(directory, transfer.in_player_id) : null;
        const captainPlayer = players.find((player) => apiPlayerId(player) === scenario.captain_id);
        const vicePlayer = players.find((player) => apiPlayerId(player) === scenario.vice_captain_id);

        setMode(transfer ? "transfer" : "captaincy");
        if (outPlayer) setPlayerOutId(outPlayer.id);
        if (inEntry) setPlayerIn(inEntry);
        if (captainPlayer) setCaptainId(captainPlayer.id);
        if (vicePlayer) setViceCaptainId(vicePlayer.id);
        setBenchSwitch(scenario.scenario_type === "bench_switch_transfer");
        const restoredHitCost = Number(scenario.hit_cost ?? 0);
        setHitCost(restoredHitCost === 4 || restoredHitCost === 8 ? (restoredHitCost as 4 | 8) : 0);
        resetResult();
        setMobileView("build");
        setLoadStatus("ready");
      } catch (error) {
        setLoadStatus("error");
        setLoadError(error instanceof Error ? error.message : "Could not load the saved scenario.");
      } finally {
        setLoadingSavedId(null);
      }
    },
    [players, directory],
  );

  const searchParams = useSearchParams();
  const deepLinkedSimulationId = searchParams.get("simulation_id");
  const debugMode = searchParams.get("debug") === "1";
  const autoLoadedRef = useRef(false);
  useEffect(() => {
    if (!deepLinkedSimulationId || autoLoadedRef.current || directoryStatus === "loading") return;
    autoLoadedRef.current = true;
    setLoadIdInput(deepLinkedSimulationId);
    void handleLoadScenario(deepLinkedSimulationId);
  }, [deepLinkedSimulationId, directoryStatus, handleLoadScenario]);

  const netGain = scenarioResult?.net_projected_gain_after_hit ?? 0;
  const diffAgainstRecommended = scenarioResult ? Number((netGain - recommendedRoute.expected_gain).toFixed(1)) : 0;
  const verdict = !scenarioResult
    ? ""
    : !scenarioResult.valid
      ? "Invalid scenario"
      : diffAgainstRecommended > 1
        ? "Your scenario wins"
        : diffAgainstRecommended < -1
          ? "Recommendation wins"
          : "Close call";
  const confidenceBand: ConfidenceBand =
    scenarioResult && scenarioResult.confidence >= 70 ? "High" : scenarioResult && scenarioResult.confidence >= 45 ? "Medium" : "Low";
  const riskBand: RiskLevel = scenarioResult && scenarioResult.risk_delta > 8 ? "High" : scenarioResult && scenarioResult.risk_delta > 2 ? "Medium" : "Low";
  const resultExplanation = scenarioResult?.valid ? buildResultExplanation(scenarioResult, recommendedRoute, diffAgainstRecommended) : [];

  const displayOut = scenarioResult?.out_player ? cardToPlayer(scenarioResult.out_player, outgoing, players) : null;
  const incomingFallback = directoryEntryToPlayer(playerIn) ?? EMPTY_PLAYER;
  const displayIn = scenarioResult?.in_player ? cardToPlayer(scenarioResult.in_player, incomingFallback, players) : null;
  const displayCaptain = scenarioResult?.captain ? cardToPlayer(scenarioResult.captain, captain, players) : captain;
  const displayVice = scenarioResult?.vice_captain ? cardToPlayer(scenarioResult.vice_captain, vice, players) : vice;
  const transferEdge = scenarioResult?.out_player && scenarioResult.in_player
    ? scenarioResult.in_player.expected_points - scenarioResult.out_player.expected_points
    : null;

  return (
    <section className="space-y-4">
      <div className="grid grid-cols-2 rounded-2xl border border-[#E1E7F2] bg-white p-1 shadow-[0_10px_26px_rgba(15,23,60,0.05)] lg:hidden">
        <button
          type="button"
          onClick={() => setMobileView("build")}
          className={`rounded-xl px-4 py-3 text-sm font-black transition ${mobileView === "build" ? "bg-[#6C1DFF] text-white" : "text-[#626A8B]"}`}
        >
          Build
        </button>
        <button
          type="button"
          onClick={() => setMobileView("compare")}
          className={`rounded-xl px-4 py-3 text-sm font-black transition ${mobileView === "compare" ? "bg-[#6C1DFF] text-white" : "text-[#626A8B]"}`}
        >
          {scenarioResult ? "Result" : "Review"}
        </button>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,440px)_minmax(0,1fr)] lg:items-start">
        <div className={`${mobileView === "build" ? "block" : "hidden"} lg:block`}>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void handleRunScenario();
            }}
            className="rounded-[22px] border border-[#E1E7F2] bg-white p-4 shadow-[0_22px_60px_rgba(15,23,60,0.08)] sm:p-5 lg:sticky lg:top-24"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[#6C1DFF]">Test a decision</p>
                <h2 className="mt-1 text-2xl font-black tracking-tight text-[#101947]">Scenario builder</h2>
                <p className="mt-1 text-sm font-semibold leading-6 text-[#626A8B]">Build one clear alternative and compare it with the live recommendation.</p>
              </div>
              <span className="rounded-full bg-[#EFFFF5] px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-[#008F4C]">Live model</span>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2 rounded-xl bg-[#F5F2FF] p-1">
              <button
                type="button"
                onClick={() => changeMode("transfer")}
                className={`rounded-lg px-3 py-2.5 text-sm font-black transition ${mode === "transfer" ? "bg-white text-[#6C1DFF] shadow-[0_8px_20px_rgba(108,29,255,0.12)]" : "text-[#737A9B]"}`}
              >
                Transfer
              </button>
              <button
                type="button"
                onClick={() => changeMode("captaincy")}
                className={`rounded-lg px-3 py-2.5 text-sm font-black transition ${mode === "captaincy" ? "bg-white text-[#6C1DFF] shadow-[0_8px_20px_rgba(108,29,255,0.12)]" : "text-[#737A9B]"}`}
              >
                Captaincy
              </button>
            </div>

            {requiresTransfer ? (
              <div className="mt-5 space-y-4">
                <label className="block">
                  <span className="text-xs font-black uppercase tracking-[0.14em] text-[#737A9B]">Player to sell</span>
                  <select
                    value={playerOutId}
                    onChange={(event) => {
                      setPlayerOutId(Number(event.target.value));
                      resetResult();
                    }}
                    className="mt-2 w-full rounded-xl border border-[#DDE3F0] bg-white px-3 py-3 text-sm font-bold text-[#101947] outline-none focus:border-[#6C1DFF] focus:ring-2 focus:ring-[#6C1DFF]/10"
                  >
                    {players.slice(0, 15).map((player) => (
                      <option key={player.id} value={player.id}>
                        {player.name} - {player.position} - {formatPrice(player.price)} - {points(player.projected)}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                  <SquadPlayerCard label="Sell" player={outgoing} tone="pink" />
                  <IncomingPlayerCard entry={playerIn} directoryStatus={directoryStatus} />
                </div>

                <PlayerSlotPicker
                  label={`Player in (${outgoing.position})`}
                  selected={playerIn}
                  otherSelectedId={apiPlayerId(outgoing)}
                  directory={inDirectory}
                  onSelect={(entry) => {
                    setPlayerIn(entry);
                    resetResult();
                  }}
                />

                {directoryStatus === "loading" ? (
                  <p className="rounded-xl bg-[#F7F8FC] px-3 py-2.5 text-xs font-bold text-[#737A9B]">Loading the full league player picker…</p>
                ) : null}
                {directoryStatus === "error" ? (
                  <p className="rounded-xl border border-[#FFD0DF] bg-[#FFF7FA] px-3 py-2.5 text-xs font-bold text-[#C80046]">{directoryMessage || "The incoming-player directory is unavailable."}</p>
                ) : null}
              </div>
            ) : (
              <div className="mt-5 rounded-2xl border border-[#D8C9FF] bg-[#F8F5FF] p-4">
                <p className="text-sm font-black text-[#6C1DFF]">Captaincy-only test</p>
                <p className="mt-1 text-sm font-semibold leading-6 text-[#626A8B]">Keep the squad and transfer plan unchanged, then test a different armband combination.</p>
              </div>
            )}

            <details open={mode === "captaincy"} className="mt-5 rounded-2xl border border-[#E1E7F2] bg-[#FBFCFF] p-4">
              <summary className="cursor-pointer list-none text-sm font-black text-[#101947] [&::-webkit-details-marker]:hidden">
                <span className="flex items-center justify-between gap-3">
                  Captain and vice captain
                  <span className="text-xs font-black text-[#6C1DFF]">Edit</span>
                </span>
              </summary>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                <CaptainChoice
                  label="Captain"
                  value={captainId}
                  players={players}
                  excludeId={viceCaptainId}
                  onChange={(value) => {
                    setCaptainId(value);
                    resetResult();
                  }}
                />
                <CaptainChoice
                  label="Vice captain"
                  value={viceCaptainId}
                  players={players}
                  excludeId={captainId}
                  onChange={(value) => {
                    setViceCaptainId(value);
                    resetResult();
                  }}
                />
              </div>
            </details>

            {requiresTransfer ? (
              <details className="mt-3 rounded-2xl border border-[#E1E7F2] bg-[#FBFCFF] p-4">
                <summary className="cursor-pointer list-none text-sm font-black text-[#101947] [&::-webkit-details-marker]:hidden">
                  <span className="flex items-center justify-between gap-3">
                    Transfer cost and bench
                    <span className="text-xs font-black text-[#6C1DFF]">Optional</span>
                  </span>
                </summary>
                <div className="mt-4 space-y-4">
                  <label className="flex items-center justify-between gap-4 rounded-xl border border-[#E1E7F2] bg-white px-3 py-3">
                    <span>
                      <span className="block text-sm font-black text-[#101947]">Include bench switch</span>
                      <span className="block text-xs font-semibold text-[#737A9B]">Evaluate the transfer with a lineup adjustment.</span>
                    </span>
                    <input
                      type="checkbox"
                      checked={benchSwitch}
                      onChange={(event) => {
                        setBenchSwitch(event.target.checked);
                        resetResult();
                      }}
                      className="h-5 w-5 accent-[#6C1DFF]"
                    />
                  </label>
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-[#737A9B]">Hit cost</p>
                    <div className="mt-2 grid grid-cols-3 gap-2">
                      {[0, 4, 8].map((value) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => {
                            setHitCost(value as 0 | 4 | 8);
                            resetResult();
                          }}
                          className={`rounded-xl border px-3 py-3 text-sm font-black transition ${hitCost === value ? "border-[#6C1DFF] bg-[#F1E8FF] text-[#6C1DFF]" : "border-[#DDE3F0] bg-white text-[#101947] hover:border-[#BCA6FF]"}`}
                        >
                          {value === 0 ? "No hit" : `-${value}`}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </details>
            ) : null}

            <div className="mt-5 rounded-2xl border border-[#E1E7F2] bg-white p-4">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[#6C1DFF]">Scenario summary</p>
              <SummaryItem label="Decision" value={scenarioName} />
              <SummaryItem label="Captain" value={captain.name} />
              <SummaryItem label="Vice" value={vice.name} />
              <SummaryItem label="Hit" value={requiresTransfer && hitCost ? `-${hitCost} points` : "No hit"} tone={hitCost ? "amber" : "green"} />
              {requiresTransfer ? <SummaryItem label="Bench switch" value={benchSwitch ? "Included" : "No"} /> : null}
            </div>

            <div className="sticky bottom-3 z-20 mt-5 rounded-2xl bg-white/92 p-1 shadow-[0_16px_34px_rgba(15,23,60,0.14)] backdrop-blur lg:static lg:bg-transparent lg:p-0 lg:shadow-none">
              <button
                type="submit"
                disabled={!requestPayload || runStatus === "loading" || (requiresTransfer && directoryStatus === "loading")}
                className="w-full rounded-xl bg-[#6C1DFF] px-4 py-3.5 text-sm font-black text-white shadow-[0_12px_24px_rgba(108,29,255,0.22)] transition hover:bg-[#5813E4] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {runStatus === "loading" ? "Running scenario…" : "Run scenario"}
              </button>
            </div>
            {requiresTransfer && !playerIn ? <p className="mt-2 text-xs font-bold text-[#737A9B]">Choose the incoming player before running the scenario.</p> : null}
            {runStatus === "error" ? <p className="mt-2 rounded-xl border border-[#FFD0DF] bg-[#FFF7FA] px-3 py-2 text-xs font-bold text-[#C80046]">{runError}</p> : null}

            <details className="mt-4 rounded-2xl border border-[#E1E7F2] bg-[#FBFCFF] p-4">
              <summary className="cursor-pointer list-none text-sm font-black text-[#101947] [&::-webkit-details-marker]:hidden">
                <span className="flex items-center justify-between gap-3">
                  Saved scenarios
                  <span className="text-xs font-black text-[#6C1DFF]">Restore</span>
                </span>
              </summary>
              <div className="mt-4">
                <RecentSavedScenarios items={recentSaved} loadingId={loadingSavedId} onLoad={(id) => void handleLoadScenario(String(id))} />
                <div className="mt-4 flex gap-2 border-t border-[#E1E7F2] pt-4">
                  <input
                    value={loadIdInput}
                    onChange={(event) => setLoadIdInput(event.target.value)}
                    inputMode="numeric"
                    placeholder="Load by ID"
                    className="min-w-0 flex-1 rounded-xl border border-[#DDE3F0] bg-white px-3 py-2.5 text-sm font-semibold text-[#101947] outline-none focus:border-[#6C1DFF]"
                  />
                  <button
                    type="button"
                    onClick={() => void handleLoadScenario(loadIdInput)}
                    disabled={loadStatus === "loading"}
                    className="shrink-0 rounded-xl border border-[#6C1DFF] bg-white px-4 py-2.5 text-sm font-black text-[#6C1DFF] disabled:cursor-wait disabled:opacity-60"
                  >
                    {loadStatus === "loading" ? "Loading" : "Load"}
                  </button>
                </div>
                {loadStatus === "error" ? <p className="mt-2 text-xs font-bold text-[#C80046]">{loadError}</p> : null}
                {loadStatus === "ready" ? <p className="mt-2 text-xs font-bold text-[#008F4C]">Scenario restored. Run it for fresh projections.</p> : null}
              </div>
            </details>
          </form>
        </div>

        <div ref={resultRef} className={`${mobileView === "compare" ? "block" : "hidden"} scroll-mt-24 lg:block`}>
          {runStatus === "ready" && scenarioResult ? (
            <div className="space-y-5">
              <section className="overflow-hidden rounded-[22px] border border-[#111827] bg-[#070912] text-white shadow-[0_28px_70px_rgba(0,0,0,0.22)]">
                <div className="border-b border-white/10 p-5 sm:p-6">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.2em] text-[#A7F3D0]">Scenario verdict</p>
                      <h2 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">{verdict}</h2>
                      <p className="mt-2 text-sm font-semibold text-white/62">Your decision compared with {recommendedRoute.move}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                      <ConfidenceBadge value={confidenceBand} />
                      <RiskBadge value={riskBand} />
                      <button
                        type="button"
                        onClick={() => void handleSaveScenario()}
                        disabled={saveStatus === "loading" || !scenarioResult.valid}
                        className="rounded-xl bg-[#00E6A8] px-4 py-2.5 text-xs font-black text-[#05070D] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {saveStatus === "loading" ? "Saving…" : "Save scenario"}
                      </button>
                    </div>
                  </div>
                  {saveStatus === "ready" && savedSimulationId ? <p className="mt-3 text-xs font-bold text-[#A7F3D0]">Saved successfully as scenario {savedSimulationId}.</p> : null}
                  {saveStatus === "error" ? <p className="mt-3 text-xs font-bold text-[#FF7CAA]">{saveError}</p> : null}
                </div>

                {!scenarioResult.valid ? (
                  <div className="m-5 rounded-2xl border border-[#FF4D8D]/40 bg-[#FF4D8D]/10 p-4 sm:m-6">
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-[#FF7CAA]">Scenario rejected</p>
                    <ul className="mt-3 space-y-2 text-sm font-semibold leading-6 text-white/82">
                      {(scenarioResult.invalid_reasons.length ? scenarioResult.invalid_reasons : scenarioResult.reasons).map((reason) => (
                        <li key={reason} className="flex gap-2"><span className="text-[#FF7CAA]">•</span><span>{reason}</span></li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <div className="p-5 sm:p-6">
                    <div className="grid grid-cols-[1.2fr_0.9fr_0.9fr] gap-3 border-b border-white/15 pb-2 text-[10px] font-black uppercase tracking-[0.14em] text-white/42">
                      <span>Comparison</span>
                      <span className="text-right">Your scenario</span>
                      <span className="text-right">Recommended</span>
                    </div>
                    <ComparisonRow label="Net projected gain" scenario={`${signed(netGain)} pts`} recommended={`${signed(recommendedRoute.expected_gain)} pts`} emphasis />
                    <ComparisonRow label="Confidence" scenario={`${scenarioResult.confidence.toFixed(0)}% (${confidenceBand})`} recommended={recommendedRoute.confidence} />
                    <ComparisonRow label="Risk" scenario={riskBand} recommended={recommendedRoute.risk} />
                    <ComparisonRow label="Hit cost" scenario={scenarioResult.hit_cost ? `-${scenarioResult.hit_cost} pts` : "No hit"} recommended="Route-defined" />
                    <ComparisonRow label="Projected team total" scenario={points(scenarioResult.projected_points)} recommended="—" />
                  </div>
                )}
              </section>

              {scenarioResult.valid ? (
                <>
                  <section className="rounded-[22px] border border-[#E1E7F2] bg-white p-5 shadow-[0_22px_60px_rgba(15,23,60,0.08)] sm:p-6">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#6C1DFF]">Impact breakdown</p>
                        <h3 className="mt-1 text-2xl font-black text-[#101947]">Where the result comes from</h3>
                      </div>
                      <span className="rounded-full bg-[#F1E8FF] px-3 py-1 text-xs font-black text-[#6C1DFF]">Transparent model output</span>
                    </div>
                    <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                      {transferEdge != null ? <PlayerMetric label="Transfer edge" value={`${signed(transferEdge)} pts`} tone={transferEdge >= 0 ? "green" : "pink"} /> : null}
                      <PlayerMetric label="Gross points delta" value={`${signed(scenarioResult.projected_points_delta)} pts`} tone={scenarioResult.projected_points_delta >= 0 ? "green" : "pink"} />
                      <PlayerMetric label="Hit cost" value={scenarioResult.hit_cost ? `-${scenarioResult.hit_cost} pts` : "0 pts"} tone={scenarioResult.hit_cost ? "amber" : "green"} />
                      <PlayerMetric label="Net gain" value={`${signed(netGain)} pts`} tone={netGain >= 0 ? "green" : "pink"} />
                      <PlayerMetric label="Squad health" value={signed(scenarioResult.squad_health_delta)} tone={scenarioResult.squad_health_delta >= 0 ? "green" : "pink"} />
                      <PlayerMetric label="Risk delta" value={signed(scenarioResult.risk_delta)} tone={scenarioResult.risk_delta <= 0 ? "green" : "amber"} />
                    </div>
                  </section>

                  <section className="grid gap-4 sm:grid-cols-2">
                    {displayOut ? <ResultPlayerCard label="Out" player={displayOut} tone="pink" /> : null}
                    {displayIn ? <ResultPlayerCard label="In" player={displayIn} tone="green" /> : null}
                    <ResultPlayerCard label="Captain" player={displayCaptain} tone="purple" />
                    <ResultPlayerCard label="Vice" player={displayVice} tone="cyan" />
                  </section>

                  <section className="grid gap-4 xl:grid-cols-2">
                    <div className="rounded-[22px] border border-[#D8C9FF] bg-[#F8F5FF] p-5 sm:p-6">
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-[#6C1DFF]">Why this result</p>
                      <ul className="mt-4 space-y-3 text-sm font-semibold leading-6 text-[#3E4770]">
                        {(resultExplanation.length ? resultExplanation : scenarioResult.reasons).map((reason) => (
                          <li key={reason} className="flex gap-3"><span className="mt-0.5 text-[#6C1DFF]">•</span><span>{reason}</span></li>
                        ))}
                      </ul>
                    </div>
                    <div className="rounded-[22px] border border-[#FFE0EA] bg-[#FFF7FA] p-5 sm:p-6">
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-[#D9004A]">Monitor before deadline</p>
                      <ul className="mt-4 space-y-3 text-sm font-semibold leading-6 text-[#6D4560]">
                        {(
                          scenarioResult.what_to_monitor.length
                            ? scenarioResult.what_to_monitor
                            : scenarioResult.risks.length
                              ? scenarioResult.risks
                              : ["No specific deadline risk was returned for this scenario."]
                        ).map((item) => (
                          <li key={item} className="flex gap-3"><span className="mt-0.5 text-[#D9004A]">•</span><span>{item}</span></li>
                        ))}
                      </ul>
                    </div>
                  </section>
                </>
              ) : null}

              <details className="rounded-[22px] border border-[#E1E7F2] bg-white p-5 shadow-[0_18px_45px_rgba(15,23,60,0.05)]">
                <summary className="cursor-pointer list-none text-sm font-black text-[#101947] [&::-webkit-details-marker]:hidden">
                  <span className="flex items-center justify-between gap-3">Recommended route detail <span className="text-xs font-black text-[#6C1DFF]">Compare reasoning</span></span>
                </summary>
                <div className="mt-4"><TransferRouteCard route={recommendedRoute} /></div>
              </details>

              {debugMode ? (
                <details className="rounded-[22px] border border-[#E1E7F2] bg-white p-5">
                  <summary className="cursor-pointer text-sm font-black text-[#6C1DFF]">Developer request and response</summary>
                  <p className="mt-4 text-xs font-black uppercase tracking-[0.12em] text-[#737A9B]">Request</p>
                  <pre className="mt-2 max-h-64 overflow-auto rounded-xl bg-[#070912] p-4 text-xs font-semibold leading-5 text-[#A7F3D0]">{JSON.stringify(requestPayload, null, 2)}</pre>
                  <p className="mt-4 text-xs font-black uppercase tracking-[0.12em] text-[#737A9B]">Response</p>
                  <pre className="mt-2 max-h-64 overflow-auto rounded-xl bg-[#070912] p-4 text-xs font-semibold leading-5 text-[#A7F3D0]">{JSON.stringify(scenarioResult, null, 2)}</pre>
                </details>
              ) : null}
            </div>
          ) : (
            <div className="space-y-5">
              <section className="rounded-[22px] border border-[#E1E7F2] bg-white p-5 shadow-[0_22px_60px_rgba(15,23,60,0.08)] sm:p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-[#6C1DFF]">Review before running</p>
                    <h2 className="mt-1 text-2xl font-black text-[#101947]">Your scenario</h2>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-black ${requestPayload ? "bg-[#EFFFF5] text-[#008F4C]" : "bg-[#FFF4D7] text-[#B57700]"}`}>
                    {requestPayload ? "Ready" : "Incomplete"}
                  </span>
                </div>
                <div className="mt-5 rounded-2xl border border-[#E1E7F2] bg-[#FBFCFF] px-4">
                  <SummaryItem label="Decision" value={scenarioName} />
                  <SummaryItem label="Captain" value={`${captain.name} (${points(captain.projected)})`} />
                  <SummaryItem label="Vice" value={vice.name} />
                  <SummaryItem label="Hit" value={requiresTransfer && hitCost ? `-${hitCost} points` : "No hit"} tone={hitCost ? "amber" : "green"} />
                  {requiresTransfer ? <SummaryItem label="Bench switch" value={benchSwitch ? "Included" : "No"} /> : null}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setMobileView("build");
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  className="mt-4 w-full rounded-xl border border-[#D8C9FF] bg-white px-4 py-3 text-sm font-black text-[#6C1DFF] lg:hidden"
                >
                  Edit scenario
                </button>
              </section>

              {recommendationStatus === "loading" ? (
                <section className="rounded-[22px] border border-[#E1E7F2] bg-white p-6 shadow-[0_22px_60px_rgba(15,23,60,0.08)]">
                  <div className="flex items-center gap-3">
                    <span className="h-6 w-6 animate-spin rounded-full border-2 border-[#6C1DFF] border-t-transparent" aria-hidden />
                    <div>
                      <p className="text-sm font-black text-[#101947]">Recommended route is computing</p>
                      <p className="mt-1 text-sm font-semibold text-[#626A8B]">You can finish building the scenario while the comparison route loads.</p>
                    </div>
                  </div>
                </section>
              ) : recommendationStatus === "error" ? (
                <section className="rounded-[22px] border border-[#FFD0DF] bg-[#FFF7FA] p-5">
                  <p className="text-sm font-black text-[#C80046]">The recommended route could not be loaded.</p>
                  <p className="mt-1 text-sm font-semibold text-[#6D4560]">{recommendationMessage || "The Scenario Builder remains available, but the comparison will use the neutral hold fallback."}</p>
                </section>
              ) : null}

              <TransferRouteCard route={recommendedRoute} />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}