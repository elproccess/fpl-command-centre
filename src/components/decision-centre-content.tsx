"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { DataModeBadge } from "@/components/app-shell";
import { ConfidenceBadge, RiskBadge } from "@/components/badges";
import { PlayerVisual, TeamShirtImage } from "@/components/player-visual";
import { ErrorState } from "@/components/states";
import { useStreamingAnalysis } from "@/components/polled-analysis";
import { adaptDecisionCentrePartial, getDecisionCentre } from "@/lib/api";
import { getPlayerImageUrl } from "@/lib/player-images";
import type { DecisionCentre, Player, TransferRoute, UserGameState } from "@/lib/types";

const shell = "rounded-[24px] border border-[#E8E2F0] bg-white shadow-[0_18px_50px_rgba(30,8,51,0.07)]";

// Match the Planner's low-load behavior: one real dashboard request on a cold visit, then only
// lightweight status checks with increasing delays. Once any genuine dashboard panel is visible,
// two checks per minute are enough; hidden browser tabs make no requests at all.
const DECISION_INITIAL_STATUS_DELAYS_MS = [5000, 10000, 20000, 30000] as const;
const DECISION_VISIBLE_STATUS_INTERVAL_MS = 30000;
const DECISION_STATUS_ERROR_RETRY_MS = 60000;

const PENDING_PLAYER: Player = {
  id: 0,
  name: "Pending",
  team: "",
  position: "MID",
  price: 0,
  projected: 0,
  status: "Available",
  risk: "Low",
};

function pendingRoute(routeType: TransferRoute["route_type"]): TransferRoute {
  return {
    id: `pending-${routeType}`,
    title: "Calculating route...",
    move: "Analysing the strongest option",
    expected_gain: 0,
    confidence: "Low",
    risk: "Low",
    why: [],
    why_this_could_be_wrong: [],
    route_type: routeType,
  };
}

const PENDING_DECISION: DecisionCentre = {
  best_move: {
    recommended_action: "Analysis",
    move: "Finding the strongest transfer decision",
    expected_gain: 0,
    confidence_band: "Low",
    risk_level: "Low",
    why: [],
    why_this_could_be_wrong: [],
    __pending: true,
  },
  expected_gain: 0,
  confidence: "Low",
  risk: "Low",
  why_this_move: [],
  what_could_go_wrong: [],
  safe_alternative: pendingRoute("safe"),
  upside_alternative: pendingRoute("upside"),
  roll_alternative: pendingRoute("roll"),
  no_strong_move: false,
  recommended_outgoing: null,
  recommended_incoming: null,
  buy_candidates: [],
  captain_pick: PENDING_PLAYER,
  vice_captain_pick: PENDING_PLAYER,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function decisionIdentityKey(payload: Record<string, unknown>) {
  const squad = Array.isArray(payload.squad)
    ? payload.squad
        .filter(isRecord)
        .map((pick) => ({
          playerId: Number(pick.player_id ?? pick.element ?? pick.id ?? 0),
          multiplier: Number(pick.multiplier ?? 0),
          captain: pick.is_captain === true,
          viceCaptain: pick.is_vice_captain === true,
        }))
        .filter((pick) => Number.isFinite(pick.playerId) && pick.playerId > 0)
        .sort((left, right) => left.playerId - right.playerId)
    : [];

  return JSON.stringify({
    entryId: payload.entry_id ?? payload.team_id ?? null,
    gameweek: payload.gameweek ?? payload.start_gw ?? null,
    bank: payload.bank ?? null,
    freeTransfers: payload.free_transfers ?? null,
    squad,
  });
}

function Spinner({ className = "h-4 w-4" }: { className?: string }) {
  return <span className={`inline-block animate-spin rounded-full border-2 border-current border-t-transparent ${className}`} aria-label="Calculating" />;
}

function LoadingLines({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="flex items-center gap-3 rounded-2xl border border-[#EEE9F4] bg-[#FBFAFD] p-4">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#F2ECFF] text-[#6C1DFF]"><Spinner /></span>
          <div className="min-w-0 flex-1">
            <div className="h-2.5 w-[82%] animate-pulse rounded-full bg-[#E6DDF7]" />
            <div className="mt-2 h-2.5 w-[58%] animate-pulse rounded-full bg-[#EFEAF5]" />
          </div>
        </div>
      ))}
    </div>
  );
}

function formatGain(value: number) {
  const numeric = Number(value) || 0;
  return `${numeric > 0 ? "+" : ""}${numeric.toFixed(1)}`;
}

function routeTone(type: TransferRoute["route_type"]) {
  if (type === "safe") return { accent: "#00A86B", soft: "#EAF9F3", label: "Most secure" };
  if (type === "upside") return { accent: "#6C1DFF", soft: "#F2ECFF", label: "Highest ceiling" };
  if (type === "roll") return { accent: "#087EA4", soft: "#EAF8FC", label: "Preserve flexibility" };
  return { accent: "#D97706", soft: "#FFF6E8", label: "Higher variance" };
}

function CheckIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4 fill-none stroke-current stroke-[2.2]">
      <path d="m4.5 10.5 3.2 3.2 7.8-8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function WarningIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4 fill-none stroke-current stroke-2">
      <path d="M10 3.2 17 16H3l7-12.8Z" strokeLinejoin="round" />
      <path d="M10 7v4.2M10 14h.01" strokeLinecap="round" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4 fill-none stroke-current stroke-2">
      <path d="M4 10h12M11.5 5.5 16 10l-4.5 4.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}


function normalizePlayerName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function bestPlayerMatch(value: string, players: Player[]) {
  const normalizedValue = normalizePlayerName(value);
  if (!normalizedValue) return null;

  const uniquePlayers = Array.from(new Map(players.map((player) => [String(player.id), player])).values());
  const matches = uniquePlayers
    .map((player) => ({ player, key: normalizePlayerName(player.name) }))
    .filter(({ key }) => key.length >= 3 && normalizedValue.includes(key))
    .sort((left, right) => right.key.length - left.key.length);

  return matches[0]?.player ?? null;
}

function resolveMovePlayers(move: string, players: Player[]) {
  const sections = move.split(/(?:→|->|\s+to\s+|\s+for\s+)/i).filter(Boolean);
  if (sections.length >= 2) {
    return {
      outgoing: bestPlayerMatch(sections[0], players),
      incoming: bestPlayerMatch(sections.slice(1).join(" "), players),
    };
  }

  const normalizedMove = normalizePlayerName(move);
  const matches = Array.from(new Map(players.map((player) => [String(player.id), player])).values())
    .map((player) => ({ player, key: normalizePlayerName(player.name) }))
    .filter(({ key }) => key.length >= 3 && normalizedMove.includes(key))
    .sort((left, right) => normalizedMove.indexOf(left.key) - normalizedMove.indexOf(right.key));

  return {
    outgoing: matches[0]?.player ?? null,
    incoming: matches.length > 1 ? matches[matches.length - 1].player : null,
  };
}


function samePlayer(left: Player, right: Player) {
  if (left.id > 0 && right.id > 0 && left.id === right.id) return true;
  if (left.api_id && right.api_id && left.api_id === right.api_id) return true;
  if (left.code && right.code && left.code === right.code) return true;
  return normalizePlayerName(left.name) === normalizePlayerName(right.name) && left.team === right.team;
}

function enrichRecommendedPlayer(player: Player | null | undefined, players: Player[]) {
  if (!player?.id) return null;
  const richer = players.find((candidate) => samePlayer(player, candidate));
  if (!richer) return player;

  return {
    ...richer,
    ...player,
    code: player.code ?? richer.code,
    team: player.team && player.team !== "Unknown" ? player.team : richer.team,
    name: player.name && player.name !== "Unknown player" ? player.name : richer.name,
    position: player.position ?? richer.position,
  };
}

function HeroPlayerArtwork({ player }: { player: Player }) {
  const photo = getPlayerImageUrl(player);
  const artworkKey = `${player.id}-${player.code ?? "no-code"}-${player.team}`;
  const [mode, setMode] = useState<"photo" | "kit" | "fallback">(photo ? "photo" : "kit");

  useEffect(() => {
    setMode(photo ? "photo" : "kit");
  }, [artworkKey, photo]);

  return (
    <div className="relative h-full w-full" aria-hidden>
      <div className="absolute bottom-4 right-1/2 h-24 w-24 translate-x-1/2 rounded-full bg-[#6C1DFF]/10 blur-2xl sm:h-32 sm:w-32" />
      {mode === "photo" && photo ? (
        <Image
          src={photo}
          alt=""
          fill
          priority
          sizes="(max-width: 639px) 128px, (max-width: 1023px) 176px, 240px"
          className="object-contain object-bottom drop-shadow-[0_22px_28px_rgba(41,15,72,0.24)]"
          onError={() => setMode("kit")}
        />
      ) : mode === "kit" ? (
        <div className="absolute bottom-5 right-1/2 grid h-[118px] w-[118px] translate-x-1/2 place-items-center rounded-[30px] border border-[#D9CBFF] bg-white/90 p-3 shadow-[0_20px_36px_rgba(55,0,60,0.15)] backdrop-blur sm:h-[154px] sm:w-[154px] sm:p-4 lg:h-[176px] lg:w-[176px]">
          <TeamShirtImage
            team={player.team}
            position={player.position}
            size={110}
            className="h-full w-full object-contain drop-shadow-[0_14px_18px_rgba(23,0,47,0.18)]"
            onError={() => setMode("fallback")}
          />
        </div>
      ) : (
        <div className="absolute bottom-5 right-3 scale-[1.08] sm:bottom-8 sm:right-5 sm:scale-[1.34]">
          <PlayerVisual player={player} size="xl" preferPhoto={false} />
        </div>
      )}
    </div>
  );
}

function HeroArtworkLoading() {
  return (
    <div className="grid h-full w-full place-items-end pb-5 pr-3" aria-label="Finding recommended player">
      <div className="grid h-24 w-24 place-items-center rounded-[26px] border border-[#D9CCFF] bg-white/90 text-[#6C1DFF] shadow-[0_18px_44px_rgba(108,29,255,0.18)] backdrop-blur sm:h-32 sm:w-32 lg:h-40 lg:w-40">
        <div className="text-center">
          <Spinner className="h-7 w-7 sm:h-9 sm:w-9" />
          <p className="mt-2 text-[9px] font-black uppercase tracking-[0.12em] text-[#81748E]">Player</p>
        </div>
      </div>
    </div>
  );
}

function DecisionHero({
  action,
  move,
  noStrongMove,
  outgoing,
  incoming,
  heroPlayer,
  expectedGain,
  hitCost,
  captain,
  confidence,
  risk,
  appState,
  pending,
  heroPending,
}: {
  action: string;
  move: string;
  noStrongMove: boolean;
  outgoing?: Player | null;
  incoming?: Player | null;
  heroPlayer?: Player | null;
  expectedGain: number;
  hitCost: number;
  captain?: Player | null;
  confidence: TransferRoute["confidence"];
  risk: TransferRoute["risk"];
  appState: UserGameState;
  // True while the backend's best_move_panel hasn't computed yet - move/expectedGain/
  // noStrongMove are all meaningless placeholders in that state (see BestMove.__pending), so
  // this must show a real loading state instead of presenting them as the actual recommendation.
  pending?: boolean;
  heroPending?: boolean;
}) {
  const primaryTitle = pending
    ? "Finding your best move..."
    : noStrongMove
      ? "Keep the free transfer"
      : outgoing
        ? `Replace ${outgoing.name}`
        : "Recommended transfer";
  const accentTitle = pending
    ? "Still analysing your squad"
    : noStrongMove
      ? "Roll into the next gameweek"
      : incoming
        ? `→ ${incoming.name}`
        : move;
  const supportCopy = pending
    ? "The full transfer search is still running - this finishes shortly after the rest of your team loads."
    : noStrongMove
      ? "The model does not see enough immediate value to force a move this week."
      : hitCost
        ? `The move carries a -${hitCost} hit, so the projected edge must justify the cost.`
        : `Use the free transfer this gameweek. The model projects ${formatGain(expectedGain)} points of value.`;

  return (
    <section className="relative mt-10 overflow-visible rounded-[28px] border border-[#D9CCFF] bg-white shadow-[0_28px_72px_rgba(47,18,77,0.12)] sm:mt-14">
      <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[28px]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_88%_14%,rgba(108,29,255,0.18),transparent_34%),radial-gradient(circle_at_8%_92%,rgba(0,230,168,0.10),transparent_28%)]" />
        <div className="absolute inset-y-0 right-0 w-[46%] bg-[linear-gradient(135deg,transparent,rgba(108,29,255,0.06))]" />
        <div className="absolute -right-12 -top-16 h-48 w-48 rounded-full border border-[#6C1DFF]/10 sm:h-64 sm:w-64" />
        <div className="absolute -right-5 top-16 h-28 w-28 rounded-full border border-[#00A86B]/10 sm:h-36 sm:w-36" />
      </div>

      <div className="absolute -top-12 right-1 z-20 h-44 w-32 sm:-top-16 sm:right-7 sm:h-56 sm:w-44 lg:-top-20 lg:right-10 lg:h-72 lg:w-60">
        {heroPending || !heroPlayer ? <HeroArtworkLoading /> : <HeroPlayerArtwork key={`${heroPlayer.id}-${heroPlayer.code ?? "no-code"}`} player={heroPlayer} />}
      </div>

      <div className="relative p-5 sm:p-7 lg:p-8 lg:pr-[300px]">
        <div className="min-h-[145px] pr-24 sm:min-h-[175px] sm:pr-40 lg:min-h-0 lg:pr-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[#6C1DFF] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-white">Recommended</span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#BCEBD2] bg-[#EDFFF5] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-[#008F5A]">
              {pending ? <><Spinner className="h-3 w-3" /> Cost</> : hitCost ? `-${hitCost} hit` : "No hit"}
            </span>
            {pending ? (
              <>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[#E5D9FF] bg-[#F7F3FF] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-[#6C1DFF]"><Spinner className="h-3 w-3" /> Confidence</span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[#F5D9E4] bg-[#FFF5F8] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-[#C52759]"><Spinner className="h-3 w-3" /> Risk</span>
              </>
            ) : (
              <>
                <ConfidenceBadge value={confidence} />
                <RiskBadge value={risk} />
              </>
            )}
          </div>

          <p className="mt-5 text-[10px] font-black uppercase tracking-[0.16em] text-[#81748E]">{action}</p>
          <h2 className="mt-2 max-w-3xl text-[28px] font-black leading-[1.02] tracking-[-0.045em] text-[#19052D] sm:text-4xl lg:text-[46px]">
            <span className="block">{primaryTitle}</span>
            <span className="mt-1 block text-[#6C1DFF]">{accentTitle}</span>
          </h2>
          <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-[#6F6280]">{supportCopy}</p>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
          <Metric label="Expected gain" value={`${formatGain(expectedGain)} pts`} tone="positive" loading={pending} />
          <Metric label="Transfer cost" value={hitCost ? `-${hitCost} pts` : "0 pts"} loading={pending} />
          <Metric label="Bank" value={`£${appState.bank.toFixed(1)}m`} />
          <Metric label="Free transfers" value={String(appState.free_transfers)} />
          <div className="col-span-2 min-w-0 rounded-2xl border border-[#EEE9F4] bg-[#FBFAFD] px-4 py-3.5 sm:col-span-1">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#81748E]">Captain</p>
            <div className="mt-2 flex min-w-0 items-center gap-2.5">
              {captain ? <PlayerVisual player={captain} size="sm" /> : <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#F2ECFF] text-[#6C1DFF]"><Spinner /></span>}
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-[#19052D]">{captain?.name ?? "Finding captain..."}</p>
                <p className="truncate text-[11px] font-semibold text-[#81748E]">{captain ? `${captain.team} · ${captain.position}` : "Captaincy analysis running"}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Link href="/scenarios" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#6C1DFF] px-5 py-3 text-sm font-black text-white shadow-[0_14px_30px_rgba(108,29,255,0.24)] transition hover:bg-[#5916D4] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6C1DFF]">
            Test this decision <ArrowIcon />
          </Link>
          <Link href="/planner" className="inline-flex min-h-12 items-center justify-center rounded-xl border border-[#D9CCFF] bg-white px-5 py-3 text-sm font-black text-[#6C1DFF] transition hover:bg-[#F7F3FF] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6C1DFF]">
            View multi-GW impact
          </Link>
        </div>
      </div>
    </section>
  );
}

function Metric({ label, value, detail, tone = "default", loading = false }: { label: string; value: string; detail?: string; tone?: "default" | "positive" | "warning"; loading?: boolean }) {
  const valueTone = tone === "positive" ? "text-[#008F5A]" : tone === "warning" ? "text-[#B86500]" : "text-[#19052D]";
  return (
    <div className="min-w-0 rounded-2xl border border-[#EEE9F4] bg-[#FBFAFD] px-4 py-3.5">
      <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#81748E]">{label}</p>
      {loading ? (
        <p className="mt-2 flex items-center gap-2 text-sm font-black text-[#6C1DFF]"><Spinner /> Calculating</p>
      ) : (
        <p className={`mt-1.5 truncate text-xl font-black tracking-[-0.02em] ${valueTone}`}>{value}</p>
      )}
      {detail ? <p className="mt-1 text-xs font-semibold text-[#756781]">{detail}</p> : null}
    </div>
  );
}

function PlayerRow({ player, mode }: { player: Player; mode: "sell" | "buy" }) {
  const isSell = mode === "sell";
  return (
    <article className="flex items-center gap-3 rounded-2xl border border-[#EEE9F4] bg-white p-3 transition hover:border-[#D9CDEC] hover:shadow-[0_10px_28px_rgba(44,13,69,0.08)]">
      <PlayerVisual player={player} size="sm" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-black text-[#19052D]">{player.name}</p>
          <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-black ${isSell ? "bg-[#FFF0F4] text-[#C52759]" : "bg-[#EAF9F3] text-[#008F5A]"}`}>
            {isSell ? player.risk : `${player.projected.toFixed(1)} pts`}
          </span>
        </div>
        <p className="mt-0.5 text-xs font-semibold text-[#81748E]">{player.team} · {player.position}</p>
      </div>
    </article>
  );
}

function RouteCard({ route, recommended }: { route: TransferRoute; recommended: boolean }) {
  const tone = routeTone(route.route_type);
  // backendRoute()/pendingRoute() give a not-yet-computed route this id prefix (see api.ts) -
  // its expected_gain is a meaningless 0 placeholder until then, must not render as a real gain.
  const pending = route.id.startsWith("pending-");
  return (
    <article className={`relative overflow-hidden rounded-[22px] border bg-white p-4 transition hover:-translate-y-0.5 hover:shadow-[0_16px_36px_rgba(31,7,49,0.09)] ${recommended ? "border-[#6C1DFF]/35 ring-2 ring-[#6C1DFF]/8" : "border-[#E8E2F0]"}`}>
      <div className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: tone.accent }} />
      <div className="flex items-start justify-between gap-3 pt-1">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.09em]" style={{ color: tone.accent, backgroundColor: tone.soft }}>
              {tone.label}
            </span>
            {recommended ? <span className="rounded-full bg-[#19052D] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.09em] text-white">Recommended</span> : null}
          </div>
          <h3 className="mt-3 text-base font-black leading-snug text-[#19052D]">{route.title}</h3>
        </div>
        <p className="shrink-0 text-2xl font-black tracking-[-0.04em]" style={{ color: tone.accent }}>
          {pending ? <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent align-middle" aria-label="Calculating" /> : formatGain(route.expected_gain)}
        </p>
      </div>
      <p className="mt-2 line-clamp-2 text-sm font-bold leading-5 text-[#4E3D5B]">{route.move}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {pending ? (
          <>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#E5D9FF] bg-[#F7F3FF] px-2.5 py-1 text-[10px] font-black text-[#6C1DFF]"><Spinner className="h-3 w-3" /> Confidence</span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#F0E7F3] bg-[#FBFAFD] px-2.5 py-1 text-[10px] font-black text-[#81748E]"><Spinner className="h-3 w-3" /> Risk</span>
          </>
        ) : (
          <>
            <ConfidenceBadge value={route.confidence} />
            <RiskBadge value={route.risk} />
          </>
        )}
      </div>
      <p className="mt-4 border-t border-[#F0ECF4] pt-3 text-xs font-semibold leading-5 text-[#756781]">
        {pending ? <span className="inline-flex items-center gap-2 text-[#6C1DFF]"><Spinner className="h-3.5 w-3.5" /> Route reasoning is loading</span> : route.why[0] ?? "Route assessed against the current squad and fixture horizon."}
      </p>
    </article>
  );
}

export function DecisionCentreContent({
  payload,
  appState,
  squadPlayers,
  availablePlayers,
}: {
  payload: Record<string, unknown>;
  appState: UserGameState;
  squadPlayers: Player[];
  availablePlayers: Player[];
}) {
  const entryIdValue = payload.entry_id ?? payload.team_id;
  const entryId = entryIdValue == null ? null : String(entryIdValue);
  const gameweekValue = payload.gameweek ?? payload.start_gw;
  const gameweekNumber = typeof gameweekValue === "number" ? gameweekValue : Number(gameweekValue);
  const identityKey = decisionIdentityKey(payload);
  const state = useStreamingAnalysis(
    // The cold visit starts this real request exactly once. Its short client timeout lets the
    // background job continue while the page switches to lightweight status checks and genuine
    // partial-panel streaming instead of holding a blank route for 50-100 seconds.
    () => getDecisionCentre(payload, { timeoutMs: 5000, disableFallback: true }),
    {
      entryId,
      gameweek: Number.isFinite(gameweekNumber) ? gameweekNumber : undefined,
      analysisType: "dashboard_full",
      adaptPartial: adaptDecisionCentrePartial,
      polling: {
        initialDelaysMs: DECISION_INITIAL_STATUS_DELAYS_MS,
        visibleIntervalMs: DECISION_VISIBLE_STATUS_INTERVAL_MS,
        restoreDelayMs: DECISION_VISIBLE_STATUS_INTERVAL_MS,
        errorRetryMs: DECISION_STATUS_ERROR_RETRY_MS,
        pauseWhenHidden: true,
      },
    },
    [identityKey],
    "decision-centre-v2",
  );

  if (state.phase === "error") return <ErrorState message={state.message} />;

  // The route itself renders immediately. Before the first real partial snapshot arrives, the
  // same final layout is populated with explicit pending cards/spinners rather than a full-page
  // loading panel. Once a real panel streams in, it replaces only the relevant placeholders.
  const hasRealData = state.phase === "ready" || state.phase === "streaming";
  const decision = hasRealData ? state.data : PENDING_DECISION;
  const bestMovePending = !hasRealData || decision.best_move.__pending === true;
  const routes = [decision.safe_alternative, decision.upside_alternative, decision.roll_alternative];
  const sellCandidates = squadPlayers.filter((player) => player.risk !== "Low" || player.trend === "down").slice(0, 4);
  const buyCandidates = decision.buy_candidates.slice(0, 4);
  const buyCandidatesPending = state.phase !== "ready" && buyCandidates.length === 0;
  const hitCost = bestMovePending ? 0 : decision.best_move.recommended_action.toLowerCase().includes("hit") ? 4 : 0;
  const netGainAfterHit = decision.expected_gain - hitCost;
  const actionLower = decision.best_move.recommended_action.toLowerCase();
  const isRoll = !bestMovePending && (actionLower.includes("roll") || decision.no_strong_move);
  const verdict = hitCost ? "Hit requires a clear edge" : isRoll ? "Hold the transfer" : "Use the free transfer";
  const recommendedRouteId = routes.find((route) => route.move.trim().toLowerCase() === decision.best_move.move.trim().toLowerCase())?.id;

  const basePlayerPool = [
    ...squadPlayers,
    ...availablePlayers,
    ...buyCandidates.map((signal) => signal.player),
  ];
  const captain = enrichRecommendedPlayer(decision.captain_pick?.id ? decision.captain_pick : null, basePlayerPool);
  const playerPool = captain ? [...basePlayerPool, captain] : basePlayerPool;
  const textMatchedPlayers = resolveMovePlayers(decision.best_move.move, playerPool);
  const outgoing = enrichRecommendedPlayer(decision.recommended_outgoing, playerPool) ?? textMatchedPlayers.outgoing;
  const incoming = enrichRecommendedPlayer(decision.recommended_incoming, playerPool) ?? textMatchedPlayers.incoming;

  const recommendsTransfer = !bestMovePending && !isRoll && (
    actionLower.includes("transfer") ||
    Boolean(decision.recommended_incoming?.id) ||
    Boolean(incoming && outgoing)
  );
  // Never substitute an unrelated market candidate. A transfer recommendation uses the exact
  // backend transfers_in player; roll/captaincy/bench decisions use the route's suggested captain.
  const heroPlayer = recommendsTransfer ? incoming : captain;
  const heroPending = bestMovePending || !heroPlayer;

  return (
    <div className="space-y-6 pb-10">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[#F2ECFF] px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-[#6C1DFF]">{appState.gameweek_label} decision</span>
            <span className="text-xs font-bold text-[#81748E]">Updated from your imported squad</span>
          </div>
          <h1 className="mt-3 text-2xl font-black tracking-[-0.035em] text-[#19052D] sm:text-3xl">Your transfer decision</h1>
          <p className="mt-1 max-w-2xl text-sm font-semibold leading-6 text-[#756781]">One recommendation, the evidence behind it, and the strongest alternatives.</p>
        </div>
        <DataModeBadge source={{ mode: "real", label: "Real backend connected" }} />
      </header>

      <DecisionHero
        action={decision.best_move.recommended_action}
        move={decision.best_move.move}
        noStrongMove={decision.no_strong_move}
        outgoing={outgoing}
        incoming={incoming}
        heroPlayer={heroPlayer}
        expectedGain={decision.expected_gain}
        hitCost={hitCost}
        captain={captain}
        confidence={decision.confidence}
        risk={decision.risk}
        appState={appState}
        pending={bestMovePending}
        heroPending={heroPending}
      />

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(310px,.65fr)]">
        <div className={`${shell} p-5 sm:p-6`}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#6C1DFF]">Why the model prefers this</p>
              <h2 className="mt-2 text-xl font-black tracking-[-0.025em] text-[#19052D]">The decision case</h2>
            </div>
            <span className="hidden items-center gap-2 rounded-full bg-[#F7F4FA] px-3 py-1.5 text-xs font-black text-[#5E4D69] sm:inline-flex">
              {bestMovePending ? <><Spinner className="h-3.5 w-3.5 text-[#6C1DFF]" /> Loading signals</> : `${decision.why_this_move.length} supporting signals`}
            </span>
          </div>

          <div className="mt-5">
            {bestMovePending ? (
              <LoadingLines rows={2} />
            ) : decision.why_this_move.length ? (
              <div className="grid gap-3 md:grid-cols-2">
                {decision.why_this_move.map((item, index) => (
                  <div key={`${item}-${index}`} className="flex gap-3 rounded-2xl border border-[#E5F3ED] bg-[#F7FCFA] p-4">
                    <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#DDF6EB] text-[#008F5A]"><CheckIcon /></span>
                    <p className="text-sm font-semibold leading-6 text-[#3F3348]">{item}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="rounded-2xl bg-[#F7F4FA] p-4 text-sm font-semibold text-[#756781]">No additional supporting signals were returned for this decision.</p>
            )}
          </div>

          <details className="group mt-4 rounded-2xl border border-[#F3E1C8] bg-[#FFF9F0] open:pb-1">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 text-sm font-black text-[#7A4B08] [&::-webkit-details-marker]:hidden">
              <span className="flex items-center gap-2"><WarningIcon /> Risks and failure cases</span>
              <span className="text-lg transition group-open:rotate-45">+</span>
            </summary>
            <div className="space-y-2 px-4 pb-4">
              {bestMovePending ? (
                <p className="inline-flex items-center gap-2 text-sm font-semibold text-[#7A4B08]"><Spinner /> Loading downside checks</p>
              ) : decision.what_could_go_wrong.length ? (
                decision.what_could_go_wrong.map((item, index) => <p key={`${item}-${index}`} className="text-sm font-semibold leading-6 text-[#6B5637]">{item}</p>)
              ) : (
                <p className="text-sm font-semibold leading-6 text-[#6B5637]">No specific downside case was returned.</p>
              )}
            </div>
          </details>
        </div>

        <aside className={`${shell} p-5 sm:p-6`}>
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#6C1DFF]">Transfer economics</p>
          <h2 className="mt-2 flex items-center gap-2 text-xl font-black tracking-[-0.025em] text-[#19052D]">{bestMovePending ? <><Spinner className="h-5 w-5 text-[#6C1DFF]" /> Calculating...</> : verdict}</h2>
          <p className="mt-2 text-sm font-semibold leading-6 text-[#756781]">
            {bestMovePending
              ? "Still working out the full transfer economics for this squad."
              : hitCost
                ? "The raw upside is reduced by the points deduction. Confirm the edge before committing."
                : isRoll
                  ? "The current route values another free transfer more than a marginal immediate gain."
                  : "The recommendation clears the transfer-cost threshold without requiring a hit."}
          </p>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <Metric label="Bank" value={`£${appState.bank.toFixed(1)}m`} detail="available" />
            <Metric label="Free transfers" value={`${appState.free_transfers}`} detail="this gameweek" />
            <Metric label="Net after hit" value={formatGain(netGainAfterHit)} detail="projected pts" tone={netGainAfterHit > 0 ? "positive" : "warning"} loading={bestMovePending} />
            <Metric label="Verdict" value={hitCost ? "Review" : isRoll ? "Roll" : "Proceed"} detail="recommended" tone={hitCost ? "warning" : "positive"} loading={bestMovePending} />
          </div>
        </aside>
      </section>

      <section className={`${shell} p-5 sm:p-6`}>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#6C1DFF]">Alternative strategies</p>
            <h2 className="mt-2 text-xl font-black tracking-[-0.025em] text-[#19052D]">Compare the three viable routes</h2>
          </div>
          <p className="text-xs font-semibold text-[#81748E]">Gain shown versus the current squad baseline</p>
        </div>
        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          {routes.map((route) => <RouteCard key={route.id} route={route} recommended={!decision.no_strong_move && route.id === recommendedRouteId} />)}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className={`${shell} p-5 sm:p-6`}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#C52759]">Squad pressure</p>
              <h2 className="mt-2 text-xl font-black tracking-[-0.025em] text-[#19052D]">Players to consider selling</h2>
            </div>
            <Link href="/squad" className="text-xs font-black text-[#6C1DFF] hover:underline">View squad</Link>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {sellCandidates.length ? sellCandidates.map((player) => <PlayerRow key={player.id} player={player} mode="sell" />) : <p className="sm:col-span-2 rounded-2xl bg-[#F7F4FA] p-4 text-sm font-semibold text-[#756781]">No urgent sell candidates in the current squad.</p>}
          </div>
        </div>

        <div className={`${shell} p-5 sm:p-6`}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#008F5A]">Market opportunity</p>
              <h2 className="mt-2 text-xl font-black tracking-[-0.025em] text-[#19052D]">Players worth considering</h2>
            </div>
            <Link href="/market" className="text-xs font-black text-[#6C1DFF] hover:underline">Open market</Link>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {buyCandidates.length ? (
              buyCandidates.map((signal) => <PlayerRow key={signal.player.id} player={signal.player} mode="buy" />)
            ) : buyCandidatesPending ? (
              <>
                {[0, 1].map((index) => (
                  <div key={index} className="flex items-center gap-3 rounded-2xl border border-[#EEE9F4] bg-[#FBFAFD] p-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#EAF9F3] text-[#008F5A]"><Spinner /></span>
                    <div className="min-w-0 flex-1">
                      <div className="h-2.5 w-2/3 animate-pulse rounded-full bg-[#DDEFE7]" />
                      <div className="mt-2 h-2.5 w-1/2 animate-pulse rounded-full bg-[#EEE9F4]" />
                    </div>
                  </div>
                ))}
              </>
            ) : (
              <p className="sm:col-span-2 rounded-2xl bg-[#F7F4FA] p-4 text-sm font-semibold text-[#756781]">No market option currently clears the model&apos;s buy threshold.</p>
            )}
          </div>
        </div>
      </section>

      <details className={`${shell} group overflow-hidden`}>
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 sm:p-6 [&::-webkit-details-marker]:hidden">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#81748E]">Advanced analysis</p>
            <h2 className="mt-1 text-lg font-black text-[#19052D]">Full route reasoning and downside cases</h2>
          </div>
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#F2ECFF] text-xl font-black text-[#6C1DFF] transition group-open:rotate-45">+</span>
        </summary>
        <div className="border-t border-[#EEE9F4] p-5 sm:p-6">
          <div className="grid gap-4 lg:grid-cols-3">
            {routes.map((route) => {
              const routePending = route.id.startsWith("pending-");
              return (
                <article key={`detail-${route.id}`} className="rounded-2xl border border-[#EEE9F4] bg-[#FBFAFD] p-4">
                  <h3 className="flex items-center gap-2 text-sm font-black text-[#19052D]">{routePending ? <Spinner className="h-4 w-4 text-[#6C1DFF]" /> : null}{route.title}</h3>
                  {routePending ? (
                    <div className="mt-4"><LoadingLines rows={2} /></div>
                  ) : (
                    <>
                      <div className="mt-4">
                        <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#008F5A]">Why it works</p>
                        <ul className="mt-2 space-y-2">
                          {route.why.length ? route.why.map((item, index) => <li key={`${route.id}-why-${index}`} className="text-xs font-semibold leading-5 text-[#5E4D69]">{item}</li>) : <li className="text-xs font-semibold leading-5 text-[#5E4D69]">No additional route reasoning was returned.</li>}
                        </ul>
                      </div>
                      <div className="mt-4 border-t border-[#EEE9F4] pt-4">
                        <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#B86500]">Downside</p>
                        <ul className="mt-2 space-y-2">
                          {route.why_this_could_be_wrong.length ? route.why_this_could_be_wrong.map((item, index) => <li key={`${route.id}-risk-${index}`} className="text-xs font-semibold leading-5 text-[#6F5A42]">{item}</li>) : <li className="text-xs font-semibold leading-5 text-[#6F5A42]">No specific downside was returned.</li>}
                        </ul>
                      </div>
                    </>
                  )}
                </article>
              );
            })}
          </div>
        </div>
      </details>
    </div>
  );
}