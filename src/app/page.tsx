"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { PlayerVisual } from "@/components/player-visual";
import type { Player } from "@/lib/types";

type IconName =
  | "arrow"
  | "captain"
  | "check"
  | "clock"
  | "compare"
  | "globe"
  | "health"
  | "import"
  | "layers"
  | "market"
  | "planner"
  | "review"
  | "scenario"
  | "shield"
  | "spark"
  | "team"
  | "transfer"
  | "trophy";

function Icon({
  name,
  className = "h-5 w-5",
}: {
  name: IconName;
  className?: string;
}) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.9,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  const paths: Record<IconName, ReactNode> = {
    arrow: (
      <>
        <path d="M5 12h14" />
        <path d="m14 7 5 5-5 5" />
      </>
    ),
    captain: (
      <>
        <circle cx="12" cy="12" r="8" />
        <path d="M15.5 8.5a5 5 0 1 0 0 7" />
      </>
    ),
    check: <path d="m5 12 4 4 10-10" />,
    clock: (
      <>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 7.5V12l3 2" />
      </>
    ),
    globe: (
      <>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M3.5 12h17" />
        <path d="M12 3.5c2.6 2.4 4 5.3 4 8.5s-1.4 6.1-4 8.5c-2.6-2.4-4-5.3-4-8.5s1.4-6.1 4-8.5Z" />
      </>
    ),
    layers: (
      <>
        <path d="m12 3 8 4.5-8 4.5-8-4.5L12 3Z" />
        <path d="m4 12 8 4.5 8-4.5" />
        <path d="m4 16.5 8 4.5 8-4.5" />
      </>
    ),
    trophy: (
      <>
        <path d="M7 4h10v5a5 5 0 0 1-10 0V4Z" />
        <path d="M7 5H4a3 3 0 0 0 3 5.5M17 5h3a3 3 0 0 1-3 5.5" />
        <path d="M12 14v3" />
        <path d="M8.5 20.5h7" />
        <path d="M9.5 17.5h5l.6 3h-6.2l.6-3Z" />
      </>
    ),
    compare: (
      <>
        <path d="M8 7H4l3-3" />
        <path d="M4 7c1.3-2.7 3.8-4 7.3-4" />
        <path d="M16 17h4l-3 3" />
        <path d="M20 17c-1.3 2.7-3.8 4-7.3 4" />
        <path d="M9 9h6v6H9z" />
      </>
    ),
    health: (
      <>
        <path d="M12 20s-7-3.9-7-9.8A4.2 4.2 0 0 1 12 7a4.2 4.2 0 0 1 7 3.2C19 16.1 12 20 12 20Z" />
        <path d="M8 12h2l1-2 2 4 1-2h2" />
      </>
    ),
    import: (
      <>
        <path d="M12 4v10" />
        <path d="m8 10 4 4 4-4" />
        <path d="M5 19h14" />
      </>
    ),
    market: (
      <>
        <path d="M4 18V9" />
        <path d="M10 18V5" />
        <path d="M16 18V12" />
        <path d="m3 7 5-4 4 3 8-4" />
      </>
    ),
    planner: (
      <>
        <rect x="4" y="5" width="16" height="15" rx="2" />
        <path d="M8 3v4M16 3v4M7.5 11h3M13.5 11h3M7.5 15h3M13.5 15h3" />
      </>
    ),
    review: (
      <>
        <path d="M5 4h14v16H5z" />
        <path d="M8 8h8M8 12h8M8 16h5" />
      </>
    ),
    scenario: (
      <>
        <circle cx="7" cy="7" r="3" />
        <circle cx="17" cy="17" r="3" />
        <path d="m9.2 9.2 5.6 5.6M15 6l3-3M6 18l-3 3" />
      </>
    ),
    shield: (
      <>
        <path d="M12 3 20 6v5c0 5.1-3.3 8.4-8 10-4.7-1.6-8-4.9-8-10V6l8-3Z" />
        <path d="m8.5 12 2.2 2.2 4.8-5" />
      </>
    ),
    spark: (
      <>
        <path d="m12 3 1.7 4.3L18 9l-4.3 1.7L12 15l-1.7-4.3L6 9l4.3-1.7L12 3Z" />
        <path d="m19 15 .8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z" />
      </>
    ),
    team: (
      <>
        <circle cx="8" cy="8" r="3" />
        <circle cx="17" cy="9" r="2.5" />
        <path d="M3 20c0-4 2-6 5-6s5 2 5 6" />
        <path d="M14 15c3.5-.5 6 1 6 5" />
      </>
    ),
    transfer: (
      <>
        <path d="M4 8h14" />
        <path d="m14 4 4 4-4 4" />
        <path d="M20 16H6" />
        <path d="m10 12-4 4 4 4" />
      </>
    ),
  };

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} {...common}>
      {paths[name]}
    </svg>
  );
}

function demoPlayer(
  id: number,
  code: number,
  name: string,
  team: string,
  position: Player["position"],
  price: number,
  projected: number,
  fixture: string,
): Player {
  return {
    id,
    api_id: id,
    code,
    name,
    team,
    position,
    price,
    projected,
    fixture,
    fixture_difficulty: 3,
    status: "Available",
    risk: "Low",
  };
}

const players = {
  haaland: demoPlayer(430, 223094, "Haaland", "MCI", "FWD", 15.0, 6.3, "CHE (H)"),
  watkins: demoPlayer(64, 178301, "Watkins", "AVL", "FWD", 9.0, 4.8, "BHA (H)"),
  salah: demoPlayer(381, 118748, "M. Salah", "LIV", "MID", 14.5, 7.8, "BOU (H)"),
  palmer: demoPlayer(235, 244851, "Palmer", "CHE", "MID", 10.8, 6.1, "CRY (A)"),
  saka: demoPlayer(16, 223340, "Saka", "ARS", "MID", 10.2, 6.5, "LEE (H)"),
  odegaard: demoPlayer(447, 232233, "Ødegaard", "ARS", "MID", 8.6, 5.4, "LEE (H)"),
  gabriel: demoPlayer(5, 226597, "Gabriel", "ARS", "DEF", 7.3, 4.6, "LEE (H)"),
  saliba: demoPlayer(8, 462424, "Saliba", "ARS", "DEF", 6.5, 4.5, "LEE (H)"),
  gvardiol: demoPlayer(260, 463748, "Gvardiol", "MCI", "DEF", 6.0, 4.3, "CHE (H)"),
  porro: demoPlayer(568, 441164, "Porro", "TOT", "DEF", 5.5, 4.1, "BUR (H)"),
  raya: demoPlayer(1, 154561, "Raya", "ARS", "GK", 5.5, 4.2, "LEE (H)"),
};

type PitchPlayer = {
  player: Player;
  x: string;
  y: string;
  captain?: boolean;
};

const heroPitchPlayers: PitchPlayer[] = [
  { player: players.watkins, x: "20%", y: "12%" },
  { player: players.haaland, x: "50%", y: "9%", captain: true },
  { player: players.salah, x: "80%", y: "12%" },
  { player: players.palmer, x: "22%", y: "37%" },
  { player: players.saka, x: "50%", y: "34%" },
  { player: players.odegaard, x: "78%", y: "37%" },
  { player: players.gabriel, x: "12%", y: "62%" },
  { player: players.saliba, x: "38%", y: "63%" },
  { player: players.gvardiol, x: "62%", y: "63%" },
  { player: players.porro, x: "88%", y: "62%" },
  { player: players.raya, x: "50%", y: "85%" },
];

const routeSteps = [
  {
    gw: "GW1",
    action: "Transfer",
    detail: "Haaland → Watkins",
    gain: "+4.8",
    squadPoints: "61.8 pts",
    body: "Use the free transfer now and release budget without weakening captaincy.",
    out: players.haaland,
    incoming: players.watkins,
    captain: players.salah,
    headline: "Release budget without weakening the five-GW route.",
    copy: "Immediate projection improves and future transfer flexibility increases.",
    diagnosis: "2 pressure points found",
    health: "78%",
    freeTransfers: "1 FT",
    bank: "£1.4m",
    confidence: 82,
    projectedPoints: 61.8,
    risk: "Medium" as const,
    reasons: [
      "Watkins has better fixture quality in GW1.",
      "Aston Villa at home historically strong.",
      "Releases £6.0m in budget flexibility.",
    ],
  },
  {
    gw: "GW2",
    action: "Roll",
    detail: "Keep 2 FTs",
    gain: "+1.1",
    squadPoints: "63.2 pts",
    body: "Preserve flexibility while the squad remains playable.",
    captain: players.palmer,
    headline: "Keep the transfer and enter GW3 with two moves.",
    copy: "The current XI remains playable, so flexibility becomes more valuable than a marginal change.",
    diagnosis: "Squad remains playable",
    health: "81%",
    freeTransfers: "2 FTs",
    bank: "£5.9m",
    confidence: 75,
    projectedPoints: 63.2,
    risk: "Low" as const,
    reasons: [
      "Squad remains fully playable with no injuries.",
      "Preserves two transfers for the GW3 fixture swing.",
      "No available replacement beats holding this week.",
    ],
  },
  {
    gw: "GW3",
    action: "Attack",
    detail: "Porro → Gabriel",
    gain: "+3.7",
    squadPoints: "66.9 pts",
    body: "Use the second transfer when the fixture calendar turns.",
    out: players.porro,
    incoming: players.gabriel,
    captain: players.saka,
    headline: "Attack the defensive fixture swing in GW3.",
    copy: "The route converts saved flexibility into a stronger projected defensive slot.",
    diagnosis: "Fixture swing detected",
    health: "84%",
    freeTransfers: "1 FT",
    bank: "£4.1m",
    confidence: 79,
    projectedPoints: 66.9,
    risk: "Medium" as const,
    reasons: [
      "Fixture swing favors clean-sheet returns.",
      "Gabriel's underlying attacking threat is rising.",
      "Uses the transfer banked from GW2's roll.",
    ],
  },
  {
    gw: "GW4",
    action: "Captain",
    detail: "Palmer → Salah",
    gain: "+2.9",
    squadPoints: "69.8 pts",
    body: "Shift the armband when the captaincy ceiling changes.",
    out: players.palmer,
    incoming: players.salah,
    captain: players.haaland,
    headline: "Reshape the premium slot around the GW4 captaincy swing.",
    copy: "The transfer and armband change together as the strongest ceiling moves.",
    diagnosis: "Captaincy edge moved",
    health: "82%",
    freeTransfers: "1 FT",
    bank: "£2.6m",
    confidence: 74,
    projectedPoints: 69.8,
    risk: "Medium" as const,
    reasons: [
      "Haaland's ceiling exceeds Palmer's this gameweek.",
      "Fixture favors a high-goal-threat captain.",
      "Captaincy edge outweighs the raw transfer cost.",
    ],
  },
  {
    gw: "GW5",
    action: "Arrive",
    detail: "Watkins → Haaland",
    gain: "+3.9",
    squadPoints: "73.7 pts",
    body: "Reach GW5 with a stronger structure and more usable budget.",
    out: players.watkins,
    incoming: players.haaland,
    captain: players.salah,
    headline: "Arrive at the target premium structure for GW5.",
    copy: "The earlier budget release creates the route back into the strongest premium forward.",
    diagnosis: "Target structure reached",
    health: "88%",
    freeTransfers: "1 FT",
    bank: "£0.8m",
    confidence: 85,
    projectedPoints: 73.7,
    risk: "Low" as const,
    reasons: [
      "Completes the planned premium forward structure.",
      "Budget fully released by this point in the route.",
      "Highest sustained ceiling of the five-GW plan.",
    ],
  },
];

const modules = [
  {
    icon: "team" as const,
    label: "Current squad",
    title: "My Team",
    copy: "Your actual XI, bench, captain, vice, bank, free transfers and squad health.",
    color: "bg-[#F4EEFF] text-[#6C1DFF]",
  },
  {
    icon: "transfer" as const,
    label: "Current decision",
    title: "Decision Centre",
    copy: "The strongest move now, the alternatives, and why one route wins.",
    color: "bg-[#E9FFF6] text-[#008D57]",
  },
  {
    icon: "scenario" as const,
    label: "Challenge the model",
    title: "Scenario Simulator",
    copy: "Test your own transfer or captaincy decision against the platform route.",
    color: "bg-[#FFF5DF] text-[#A46700]",
  },
  {
    icon: "planner" as const,
    label: "Future route",
    title: "Multi-GW Planner",
    copy: "See how the decision changes GW2, GW3, GW4 and GW5 before committing.",
    color: "bg-[#F4EEFF] text-[#6C1DFF]",
  },
  {
    icon: "captain" as const,
    label: "Armband decision",
    title: "Captaincy Centre",
    copy: "Projection, ceiling, safety, minutes and downside in one captaincy verdict.",
    color: "bg-[#E9FFF6] text-[#008D57]",
  },
  {
    icon: "market" as const,
    label: "Player movement",
    title: "Market",
    copy: "Track value, form, ownership, trends and squad-specific player alerts.",
    color: "bg-[#FFF0F6] text-[#C52759]",
  },
  {
    icon: "compare" as const,
    label: "Player evidence",
    title: "Compare",
    copy: "Put alternatives side by side without losing price, fixtures or projections.",
    color: "bg-[#EEF4FF] text-[#245EC7]",
  },
  {
    icon: "review" as const,
    label: "Close the loop",
    title: "Review",
    copy: "Understand what changed, what worked and what the next gameweek inherits.",
    color: "bg-[#F4EEFF] text-[#6C1DFF]",
  },
];

function Brand({ dark = true }: { dark?: boolean }) {
  return (
    <Link href="/" className="group flex min-w-0 items-center gap-3">
      <span className="relative grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-[14px] bg-[#6C1DFF] text-xl font-black text-white shadow-[0_14px_34px_rgba(108,29,255,0.34)]">
        <span className="absolute -right-3 -top-3 h-7 w-7 rounded-full bg-white/20" />
        <span className="relative">M</span>
      </span>
      <span className="min-w-0">
        <span className={`block truncate text-lg font-black tracking-[-0.025em] ${dark ? "text-white" : "text-[#17052D]"}`}>
          Matchday OS
        </span>
        <span className={`block truncate text-[11px] font-bold ${dark ? "text-white/45" : "text-[#81748B]"}`}>
          FPL decision operating system
        </span>
      </span>
    </Link>
  );
}

function ModuleExplorer() {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const selected = modules[selectedIndex];

  return (
    <div className="mt-12 grid gap-5 lg:grid-cols-[minmax(0,.88fr)_minmax(340px,.42fr)]">
      <div className="grid gap-4 md:grid-cols-2">
        {modules.map((module, index) => {
          const active = selectedIndex === index;
          return (
            <button
              key={module.title}
              type="button"
              onClick={() => setSelectedIndex(index)}
              className={`group rounded-[22px] border bg-white p-5 text-left transition duration-300 ${
                active
                  ? "-translate-y-1 border-[#BFA8F5] shadow-[0_24px_58px_rgba(55,18,82,0.11)] ring-2 ring-[#6C1DFF]/8"
                  : "border-[#E7E0ED] shadow-[0_16px_42px_rgba(42,14,61,0.05)] hover:-translate-y-0.5 hover:border-[#CEB9FC]"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <span className={`grid h-11 w-11 place-items-center rounded-[14px] ${module.color}`}>
                  <Icon name={module.icon} />
                </span>
                <span className="rounded-full bg-[#F8F5FB] px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.1em] text-[#8A7D93]">
                  {module.label}
                </span>
              </div>
              <h3 className="mt-5 text-xl font-black tracking-[-0.025em] text-[#17052D]">{module.title}</h3>
              <p className="mt-3 text-sm font-semibold leading-6 text-[#716579]">{module.copy}</p>
            </button>
          );
        })}
      </div>

      <aside className="h-fit rounded-[26px] border border-[#D7C7F5] bg-[linear-gradient(145deg,#FFFFFF_0%,#F1E8FF_100%)] p-6 shadow-[0_24px_65px_rgba(55,18,82,0.10)] lg:sticky lg:top-8">
        <span className={`grid h-12 w-12 place-items-center rounded-[16px] ${selected.color}`}>
          <Icon name={selected.icon} />
        </span>
        <p className="mt-6 text-[10px] font-black uppercase tracking-[0.15em] text-[#6C1DFF]">Selected module</p>
        <h3 className="mt-2 text-3xl font-black tracking-[-0.04em] text-[#17052D]">{selected.title}</h3>
        <p className="mt-4 text-sm font-semibold leading-7 text-[#6F6479]">{selected.copy}</p>

        <div className="mt-6 space-y-2.5">
          {[
            "Uses the same imported squad",
            "Inherits the current gameweek state",
            "Feeds the wider decision route",
          ].map((item) => (
            <div key={item} className="flex items-center gap-2.5 rounded-xl border border-[#E2D9ED] bg-white/72 px-3 py-2.5 text-xs font-black text-[#493653]">
              <span className="grid h-5 w-5 place-items-center rounded-full bg-[#E8FFF5] text-[#008D57]">
                <Icon name="check" className="h-3 w-3" />
              </span>
              {item}
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}

function OsLoopStep({
  index,
  icon,
  title,
  copy,
}: {
  index: string;
  icon: IconName;
  title: string;
  copy: string;
}) {
  return (
    <article className="relative border-l border-[#DCCFF0] pl-7">
      <span className="absolute -left-4 top-0 grid h-8 w-8 place-items-center rounded-full border-4 border-white bg-[#6C1DFF] text-[9px] font-black text-white shadow-[0_8px_18px_rgba(108,29,255,0.18)]">
        {index}
      </span>
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#F0E8FF] text-[#6C1DFF]">
        <Icon name={icon} />
      </span>
      <h3 className="mt-4 text-lg font-black text-[#17052D]">{title}</h3>
      <p className="mt-2 text-sm font-semibold leading-6 text-[#756A7D]">{copy}</p>
    </article>
  );
}

// Deadline is computed relative to page load (next Friday 18:30) rather than hardcoded, so the
// countdown in the hero card never shows a stale or negative value no matter when the page loads.
function nextDeadline(): Date {
  const now = new Date();
  const deadline = new Date(now);
  const dayOffset = (5 - now.getDay() + 7) % 7 || 7;
  deadline.setDate(now.getDate() + dayOffset);
  deadline.setHours(18, 30, 0, 0);
  return deadline;
}

function useCountdown(target: Date) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  return useMemo(() => {
    if (now === null) return { days: 0, hours: 0, minutes: 0, seconds: 0, ready: false };
    const diff = Math.max(0, target.getTime() - now);
    const days = Math.floor(diff / 86_400_000);
    const hours = Math.floor((diff % 86_400_000) / 3_600_000);
    const minutes = Math.floor((diff % 3_600_000) / 60_000);
    const seconds = Math.floor((diff % 60_000) / 1000);
    return { days, hours, minutes, seconds, ready: true };
  }, [now, target]);
}

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

const decisionChainIcons = ["team", "transfer", "captain", "planner", "layers"] as const;

const analysisEngineStatus = [
  { label: "Player projections", icon: "spark" as const, state: "done" as const },
  { label: "Fixture analysis", icon: "planner" as const, state: "done" as const },
  { label: "Ownership data", icon: "market" as const, state: "done" as const },
  { label: "AI decision engine", icon: "shield" as const, state: "active" as const },
];

function riskDots(risk: "Low" | "Medium" | "High") {
  const filled = risk === "Low" ? 1 : risk === "Medium" ? 3 : 5;
  return Array.from({ length: 5 }, (_, index) => index < filled);
}

function DecisionChainCard() {
  const [activeStep, setActiveStep] = useState(0);
  const activeRoute = routeSteps[activeStep];
  const deadline = useMemo(() => nextDeadline(), []);
  const countdown = useCountdown(deadline);
  const [activePitchPlayer, setActivePitchPlayer] = useState(players.haaland.id);
  const activePlayer = heroPitchPlayers.find((item) => item.player.id === activePitchPlayer) ?? heroPitchPlayers[0];

  // Computed client-side only, after mount - reading the wall clock directly in the render body
  // (rather than via this effect) produces a different string on the server render vs the client
  // hydration pass a moment later, which React treats as a hydration mismatch and regenerates
  // this entire subtree, breaking it visibly (found live - this is what silently broke the
  // countdown timer next to it, not a bug in the countdown logic itself).
  const [lastUpdateLabel, setLastUpdateLabel] = useState("--:--");
  useEffect(() => {
    const now = new Date();
    setLastUpdateLabel(`${pad2(now.getHours())}:${pad2(now.getMinutes())}`);
  }, []);

  // toLocaleDateString(undefined, ...) resolves the runtime's default locale - that can differ
  // between the server (Node's locale) and the browser, the same hydration-mismatch class as
  // lastUpdateLabel above. Formatted client-side only, after mount.
  const [deadlineLabel, setDeadlineLabel] = useState("");
  useEffect(() => {
    setDeadlineLabel(
      `${deadline.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "short" })}, ${pad2(deadline.getHours())}:${pad2(deadline.getMinutes())}`,
    );
  }, [deadline]);

  return (
    <div className="relative min-w-0">
      <div className="pointer-events-none absolute -inset-10 rounded-full bg-[#6C1DFF]/22 blur-[90px]" />

      <div className="relative min-w-0 overflow-hidden rounded-[24px] border border-white/10 bg-[#0B0916]/92 p-4 shadow-[0_40px_100px_rgba(0,0,0,0.5)] backdrop-blur sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/8 pb-3.5">
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-[11px] bg-[#6C1DFF] text-sm font-black text-white">
              {activeRoute.gw.replace("GW", "")}
            </span>
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.12em] text-white/40">Deadline</p>
              <p className="text-xs font-black text-[#8CFFD5]">
                {countdown.ready ? `${countdown.days}d ${pad2(countdown.hours)}h ${pad2(countdown.minutes)}m` : "…"}
              </p>
            </div>
          </div>

          <div className="text-right">
            <p className="text-[9px] font-black uppercase tracking-[0.12em] text-white/40">Squad value</p>
            <p className="text-sm font-black text-white">£100.0m</p>
          </div>
          <div className="text-right">
            <p className="text-[9px] font-black uppercase tracking-[0.12em] text-white/40">Bank</p>
            <p className="text-sm font-black text-white">{activeRoute.bank}</p>
          </div>
          <div className="text-right">
            <p className="text-[9px] font-black uppercase tracking-[0.12em] text-white/40">FT</p>
            <p className="text-sm font-black text-white">{activeRoute.freeTransfers}</p>
          </div>
        </div>

        <div className="mt-3.5">
          <p className="mb-2 text-[9px] font-black uppercase tracking-[0.14em] text-white/40">Decision chain - click any gameweek</p>
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {routeSteps.map((step, index) => {
              const active = index === activeStep;
              return (
                <div key={step.gw} className="flex shrink-0 items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setActiveStep(index)}
                    className={`flex items-center gap-2 rounded-full border px-2.5 py-1.5 transition ${
                      active
                        ? "border-[#9F7CFF] bg-[#6C1DFF] text-white shadow-[0_10px_24px_rgba(108,29,255,0.32)]"
                        : "border-white/10 bg-white/[0.04] text-white/45 hover:bg-white/[0.08] hover:text-white/80"
                    }`}
                  >
                    <Icon name={decisionChainIcons[index]} className="h-3 w-3 shrink-0" />
                    <span className="whitespace-nowrap text-[10px] font-black">{step.gw}</span>
                  </button>
                  {index < routeSteps.length - 1 ? <span className="h-px w-3 shrink-0 bg-white/12" /> : null}
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,0.98fr)_minmax(0,1.12fr)_minmax(0,0.78fr)]">
          <div className="min-w-0 rounded-[16px] border border-white/8 bg-white/[0.03] p-2.5">
            <p className="mb-1.5 text-[8px] font-black uppercase tracking-[0.12em] text-white/40">Projected XI - {activeRoute.gw}</p>
            <div className="relative h-[320px] overflow-hidden rounded-[12px] border border-[#12824D] bg-[#0A9B57] sm:h-[360px] lg:h-[400px]">
              <div className="absolute inset-0 bg-[repeating-linear-gradient(90deg,rgba(255,255,255,.05)_0,rgba(255,255,255,.05)_12.5%,rgba(0,0,0,.02)_12.5%,rgba(0,0,0,.02)_25%)]" />
              <div className="absolute inset-[9px] rounded-[10px] border border-white/40" />
              <div className="absolute left-[9px] right-[9px] top-1/2 h-px bg-white/35" />
              {heroPitchPlayers.map((item) => {
                const selected = item.player.id === activePitchPlayer;
                const isCaptainThisGw = item.player.id === activeRoute.captain.id;
                return (
                  <button
                    key={item.player.id}
                    type="button"
                    onClick={() => setActivePitchPlayer(item.player.id)}
                    aria-label={`View ${item.player.name}`}
                    className="absolute -translate-x-1/2 -translate-y-1/2 text-center outline-none"
                    style={{ left: item.x, top: item.y }}
                  >
                    <div
                      className={`relative mx-auto rounded-full scale-[0.92] transition duration-200 ${
                        selected ? "-translate-y-0.5 ring-2 ring-[#D7FFF0]" : "ring-1 ring-white/30 hover:ring-white/70"
                      }`}
                    >
                      <PlayerVisual player={item.player} size="sm" />
                      {isCaptainThisGw ? (
                        <span className="absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full border border-white bg-[#FFB800] text-[8px] font-black text-[#17052D]">
                          C
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 max-w-[64px] truncate text-[9px] font-black text-white">{item.player.name}</p>
                    <p className="text-[8px] font-black text-[#A5F1CC]">{item.player.projected.toFixed(1)}</p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="min-w-0 rounded-[16px] border border-[#3A2A5E] bg-[linear-gradient(150deg,#191227_0%,#120C1E_100%)] p-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-[8px] font-black uppercase tracking-[0.12em] text-white/40">This gameweek decision</p>
                <p className="mt-0.5 text-[13px] font-black text-white">Best move for {activeRoute.gw}</p>
              </div>
              <span className="shrink-0 rounded-full bg-[#8CFFD5]/14 px-2.5 py-1 text-[10px] font-black text-[#8CFFD5]">{activeRoute.gain} pts</span>
            </div>

            {activeRoute.out && activeRoute.incoming ? (
              <div className="mt-2.5 grid grid-cols-[minmax(0,1fr)_22px_minmax(0,1fr)] items-stretch gap-1.5">
                <div className="min-w-0 rounded-[11px] border border-[#4A2438] bg-[#20131A] p-1.5 text-center">
                  <span className="rounded-full bg-[#3B1622] px-1.5 py-0.5 text-[5.5px] font-black uppercase tracking-[0.08em] text-[#FF9DBB]">Out</span>
                  <div className="mx-auto mt-1 h-8 w-8 scale-[0.62]"><PlayerVisual player={activeRoute.out} size="sm" /></div>
                  <p className="truncate text-[9px] font-black text-white">{activeRoute.out.name}</p>
                  <p className="truncate text-[6px] font-bold text-white/45">{activeRoute.out.team} · £{activeRoute.out.price.toFixed(1)}m</p>
                </div>
                <span className="grid h-5 w-5 place-self-center place-items-center rounded-full bg-[#6C1DFF] text-white">
                  <Icon name="arrow" className="h-2.5 w-2.5" />
                </span>
                <div className="min-w-0 rounded-[11px] border border-[#1E4A38] bg-[#0F231C] p-1.5 text-center">
                  <span className="rounded-full bg-[#0F3126] px-1.5 py-0.5 text-[5.5px] font-black uppercase tracking-[0.08em] text-[#8CFFD5]">In</span>
                  <div className="mx-auto mt-1 h-8 w-8 scale-[0.62]"><PlayerVisual player={activeRoute.incoming} size="sm" /></div>
                  <p className="truncate text-[9px] font-black text-white">{activeRoute.incoming.name}</p>
                  <p className="truncate text-[6px] font-bold text-white/45">{activeRoute.incoming.team} · £{activeRoute.incoming.price.toFixed(1)}m</p>
                </div>
              </div>
            ) : (
              <div className="mt-2.5 rounded-[11px] border border-white/10 bg-white/[0.03] p-2.5 text-center">
                <p className="text-[10px] font-black text-white">No transfer this gameweek</p>
                <p className="mt-0.5 text-[8px] font-bold text-white/45">{activeRoute.detail} - squad holds unchanged</p>
              </div>
            )}

            <div className="mt-2.5 grid grid-cols-3 gap-1.5">
              <div className="rounded-[11px] border border-white/8 bg-white/[0.03] px-2 py-1.5">
                <p className="text-[6px] font-black uppercase tracking-[0.08em] text-white/40">Confidence</p>
                <p className="mt-0.5 text-[13px] font-black text-[#8CFFD5]">{activeRoute.confidence}%</p>
              </div>
              <div className="rounded-[11px] border border-white/8 bg-white/[0.03] px-2 py-1.5">
                <p className="text-[6px] font-black uppercase tracking-[0.08em] text-white/40">Projected points</p>
                <p className="mt-0.5 text-[13px] font-black text-white">{activeRoute.projectedPoints}</p>
              </div>
              <div className="rounded-[11px] border border-white/8 bg-white/[0.03] px-2 py-1.5">
                <p className="text-[6px] font-black uppercase tracking-[0.08em] text-white/40">Risk level</p>
                <p className="mt-0.5 text-[10px] font-black text-[#F5C15C]">{activeRoute.risk}</p>
                <div className="mt-1 flex gap-0.5">
                  {riskDots(activeRoute.risk).map((filled, index) => (
                    <span key={index} className={`h-1 flex-1 rounded-full ${filled ? "bg-[#F5C15C]" : "bg-white/10"}`} />
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-2.5">
              <p className="text-[7px] font-black uppercase tracking-[0.1em] text-white/40">Why this move?</p>
              <div className="mt-1 space-y-1">
                {activeRoute.reasons.map((reason) => (
                  <div key={reason} className="flex items-start gap-1.5">
                    <span className="mt-0.5 grid h-3 w-3 shrink-0 place-items-center rounded-full bg-[#8CFFD5]/16 text-[#8CFFD5]">
                      <Icon name="check" className="h-1.5 w-1.5" />
                    </span>
                    <p className="text-[7.5px] font-semibold leading-3 text-white/60">{reason}</p>
                  </div>
                ))}
              </div>
            </div>

            <Link href="/import" className="mt-2.5 inline-flex items-center gap-1 text-[8px] font-black text-[#C9B3FF] transition hover:text-white">
              View full analysis <Icon name="arrow" className="h-2.5 w-2.5" />
            </Link>
          </div>

          <div className="flex min-w-0 flex-col gap-2.5">
            <div className="rounded-[16px] border border-white/8 bg-white/[0.03] p-3">
              <p className="text-[8px] font-black uppercase tracking-[0.12em] text-white/40">Deadline pressure</p>
              <div className="mt-2 flex items-center gap-2.5">
                <div className="relative grid h-12 w-12 shrink-0 place-items-center rounded-full border-2 border-[#6C1DFF]/40">
                  <span className="text-sm font-black text-white">{countdown.ready ? countdown.days : "–"}</span>
                  <span className="absolute -bottom-1 rounded-full bg-[#6C1DFF] px-1.5 py-0 text-[5px] font-black uppercase text-white">days</span>
                </div>
                <p className="font-mono text-sm font-black text-[#8CFFD5]">
                  {countdown.ready ? `${pad2(countdown.hours)}:${pad2(countdown.minutes)}:${pad2(countdown.seconds)}` : "--:--:--"}
                </p>
              </div>
              <p className="mt-2 text-[7.5px] font-bold leading-3 text-white/40">
                {activeRoute.gw} deadline
                <span className="mt-0.5 block text-white/60">{deadlineLabel || "…"}</span>
              </p>
            </div>

            <div className="rounded-[16px] border border-white/8 bg-white/[0.03] p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[8px] font-black uppercase tracking-[0.12em] text-white/40">Analysis engine</p>
                <span className="flex items-center gap-1 text-[7px] font-black text-[#8CFFD5]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#8CFFD5] shadow-[0_0_8px_#8CFFD5]" />
                  All systems running
                </span>
              </div>
              <div className="mt-2 space-y-1.5">
                {analysisEngineStatus.map((item) => (
                  <div key={item.label} className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <Icon name={item.icon} className="h-3 w-3 shrink-0 text-white/45" />
                      <p className="truncate text-[8px] font-bold text-white/65">{item.label}</p>
                    </div>
                    {item.state === "active" ? (
                      <span className="relative flex h-2 w-2 shrink-0">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#8CFFD5] opacity-50" />
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-[#8CFFD5]" />
                      </span>
                    ) : (
                      <Icon name="check" className="h-3 w-3 shrink-0 text-[#8CFFD5]" />
                    )}
                  </div>
                ))}
              </div>
              <div className="mt-2.5 flex items-center justify-between border-t border-white/8 pt-2">
                <p className="text-[6.5px] font-bold text-white/35">Last update: {lastUpdateLabel}</p>
                <Link href="/dashboard" className="text-[7px] font-black text-[#C9B3FF] transition hover:text-white">
                  View status →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const heroFeatureStrip = [
  { icon: "spark" as const, title: "AI Decision Engine", copy: "Projections, context and risk scoring." },
  { icon: "layers" as const, title: "Five Gameweek Vision", copy: "See the impact now, plan the route." },
  { icon: "globe" as const, title: "Live Data Layer", copy: "Always current. Always learning." },
  { icon: "shield" as const, title: "Built for Winners", copy: "Less guesswork. More points." },
];

const trustAvatars = [
  { initials: "TC", color: "bg-[#3B82F6]" },
  { initials: "FPL", color: "bg-[#F97316]" },
  { initials: "AH", color: "bg-[#8B5CF6]" },
  { initials: "AH", color: "bg-[#EF4444]" },
  { initials: "GW", color: "bg-[#EC4899]" },
  { initials: "OS", color: "bg-[#6C1DFF]" },
];

const trustStats = [
  { icon: "trophy" as const, title: "Models tested", copy: "Across 6 seasons" },
  { icon: "spark" as const, title: "Projected points accuracy", copy: "Top 5%" },
  { icon: "shield" as const, title: "Secure by design", copy: "Your data is yours" },
  { icon: "globe" as const, title: "Always evolving", copy: "Ship weekly" },
];

const infraStrip = [
  { icon: "globe" as const, title: "Official FPL API", copy: "Live game data" },
  { icon: "layers" as const, title: "Advanced Models", copy: "Custom trained" },
  { icon: "spark" as const, title: "Live Data Layer", copy: "Always updated" },
  { icon: "shield" as const, title: "Secure Infrastructure", copy: "Privacy first" },
];

function HeroFooterStrip() {
  return (
    <div className="relative z-10 border-t border-white/8 bg-white/[0.02]">
      <div className="mx-auto max-w-[1480px] px-4 py-6 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {heroFeatureStrip.map((item) => (
            <div key={item.title} className="flex items-start gap-2.5">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[11px] border border-white/10 bg-white/[0.05] text-[#C9B3FF]">
                <Icon name={item.icon} className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-xs font-black text-white">{item.title}</p>
                <p className="mt-0.5 text-[10px] font-semibold leading-4 text-white/40">{item.copy}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 flex flex-col gap-4 border-t border-white/8 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <p className="text-[9px] font-black uppercase tracking-[0.12em] text-white/35">Trusted by beta managers</p>
            <div className="flex -space-x-2">
              {trustAvatars.map((avatar, index) => (
                <span
                  key={`${avatar.initials}-${index}`}
                  className={`grid h-7 w-7 place-items-center rounded-full border-2 border-[#090711] text-[8px] font-black text-white ${avatar.color}`}
                >
                  {avatar.initials}
                </span>
              ))}
            </div>
            <span className="text-[10px] font-bold text-white/40">+1,842 others</span>
          </div>

          <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:flex sm:items-center sm:gap-7">
            {trustStats.map((stat) => (
              <div key={stat.title} className="flex items-center gap-2">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white/[0.05] text-[#8CFFD5]">
                  <Icon name={stat.icon} className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[10px] font-black text-white">{stat.title}</p>
                  <p className="truncate text-[9px] font-bold text-white/40">{stat.copy}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="border-t border-white/8 bg-[#070510]">
        <div className="mx-auto flex max-w-[1480px] flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p className="text-[9px] font-black uppercase tracking-[0.14em] text-white/35">Data. Models. Infrastructure. Built for the edge.</p>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            {infraStrip.map((item) => (
              <div key={item.title} className="flex items-center gap-2">
                <Icon name={item.icon} className="h-3.5 w-3.5 text-white/30" />
                <div className="leading-tight">
                  <p className="text-[9px] font-black text-white/70">{item.title}</p>
                  <p className="text-[8px] font-semibold text-white/30">{item.copy}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <main className="min-h-screen overflow-x-hidden bg-[#F7F4FB] text-[#17052D]">
      <section className="relative overflow-hidden bg-[#090711] text-white">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-24 top-20 h-[420px] w-[420px] rounded-full bg-[#6C1DFF]/20 blur-[120px]" />
          <div className="absolute right-[-120px] top-[-130px] h-[520px] w-[520px] rounded-full bg-[#8B4CFF]/18 blur-[130px]" />
          <div className="absolute bottom-[-190px] left-[38%] h-[420px] w-[420px] rounded-full bg-[#00A86B]/12 blur-[120px]" />
          <div className="absolute inset-0 opacity-[0.045] [background-image:linear-gradient(rgba(255,255,255,.12)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.12)_1px,transparent_1px)] [background-size:54px_54px]" />
        </div>

        <nav className="relative z-20 mx-auto flex max-w-[1480px] items-center justify-between px-4 py-5 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Brand />
            <span className="rounded-full border border-[#9F7CFF]/35 bg-[#6C1DFF]/18 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.13em] text-[#DCCBFF]">
              Beta
            </span>
          </div>
          <div className="hidden items-center gap-7 md:flex">
            <a href="#system" className="text-sm font-bold text-white/55 transition hover:text-white">The system</a>
            <a href="#modules" className="text-sm font-bold text-white/55 transition hover:text-white">Modules</a>
            <a href="#loop" className="text-sm font-bold text-white/55 transition hover:text-white">How it works</a>
            <a href="#beta" className="text-sm font-bold text-white/55 transition hover:text-white">Beta access</a>
            <a href="#about" className="text-sm font-bold text-white/55 transition hover:text-white">About</a>
          </div>
          <div className="flex items-center gap-2.5">
            <Link href="/dashboard" className="hidden rounded-xl px-4 py-2.5 text-sm font-black text-white/66 transition hover:bg-white/[0.07] hover:text-white sm:inline-flex">
              Open app
            </Link>
            <Link href="/import" className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-black text-[#17052D] shadow-[0_12px_30px_rgba(0,0,0,0.22)] transition hover:-translate-y-0.5 hover:bg-[#F2EBFF] sm:px-5">
              Enter beta <Icon name="arrow" className="h-4 w-4" />
            </Link>
          </div>
        </nav>

        <div className="relative z-10 mx-auto max-w-[1480px] px-4 pb-8 pt-3 sm:px-6 sm:pb-10 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,.74fr)_minmax(620px,1.26fr)] lg:items-center">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.06] px-3.5 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-[#DCCBFF] backdrop-blur">
                <span className="h-2 w-2 rounded-full bg-[#8CFFD5] shadow-[0_0_16px_#8CFFD5]" />
                Beta season · your squad. Our system. One advantage.
              </div>

              <h1 className="mt-5 text-[2.55rem] font-black leading-[0.94] tracking-[-0.052em] text-white sm:text-[3.55rem] lg:text-[3.7rem] xl:text-[3.95rem]">
                The operating
                <span className="block">system for</span>
                <span className="block bg-[linear-gradient(90deg,#C9B3FF_0%,#8CFFD5_100%)] bg-clip-text text-transparent">FPL decisions.</span>
              </h1>

              <p className="mt-5 max-w-2xl text-sm font-semibold leading-6 text-white/61">
                Matchday OS connects every decision from this week to the next five. Diagnose. Decide. Execute. All in one connected system.
              </p>

              <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
                <Link href="/import" className="inline-flex min-h-13 items-center justify-center gap-2 rounded-[14px] bg-[#6C1DFF] px-6 py-3.5 text-sm font-black text-white shadow-[0_18px_42px_rgba(108,29,255,0.34)] transition hover:-translate-y-0.5 hover:bg-[#7A2EFF]">
                  Run my squad in the beta <Icon name="arrow" className="h-4 w-4" />
                </Link>
                <a href="#system" className="inline-flex min-h-13 items-center justify-center rounded-[14px] border border-white/14 bg-white/[0.06] px-6 py-3.5 text-sm font-black text-white transition hover:bg-white/[0.11]">
                  Explore the system
                </a>
              </div>

              <p className="mt-3 flex items-center gap-1.5 text-[11px] font-bold text-white/40">
                <Icon name="shield" className="h-3.5 w-3.5" /> No credit card. Free during beta.
              </p>
            </div>

            <DecisionChainCard />
          </div>
        </div>

        <HeroFooterStrip />
      </section>

      <section id="system" className="relative mx-auto max-w-[1480px] px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,.72fr)_minmax(620px,1.28fr)] lg:items-start">
          <div className="lg:sticky lg:top-10">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#6C1DFF]">The Matchday loop</p>
            <h2 className="mt-4 text-4xl font-black leading-[1] tracking-[-0.048em] text-[#17052D] sm:text-5xl">
              Built around how an FPL decision actually happens.
            </h2>
            <p className="mt-5 max-w-xl text-base font-semibold leading-7 text-[#74687D]">
              Every module inherits the same squad, gameweek, bank, free transfers and route context. The manager moves through one connected decision loop.
            </p>

            <div className="mt-7 rounded-[22px] border border-[#D9C9F4] bg-[linear-gradient(135deg,#FFFFFF_0%,#F2E9FF_100%)] p-5 shadow-[0_18px_50px_rgba(55,18,82,0.08)]">
              <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#6C1DFF]">The core principle</p>
              <p className="mt-2 text-xl font-black leading-7 text-[#17052D]">
                One imported squad should produce one coherent decision state across the entire product.
              </p>
            </div>
          </div>

          <div className="grid gap-x-8 gap-y-10 sm:grid-cols-2">
            <OsLoopStep index="01" icon="import" title="Import the real squad" copy="Load the current 15, captain, vice, formation, bank and available transfers." />
            <OsLoopStep index="02" icon="health" title="Diagnose the XI" copy="Surface availability, minutes, structural and fixture pressure before making a move." />
            <OsLoopStep index="03" icon="transfer" title="Choose the current action" copy="Recommend transfer, roll or hold with expected gain, confidence and failure cases." />
            <OsLoopStep index="04" icon="scenario" title="Test the alternative" copy="Let the manager challenge the recommendation without losing squad context." />
            <OsLoopStep index="05" icon="planner" title="Connect the next five GWs" copy="Show the route consequences of the current action gameweek by gameweek." />
            <OsLoopStep index="06" icon="review" title="Review and carry forward" copy="Explain what happened and what the next gameweek inherits from the last decision." />
          </div>
        </div>
      </section>

      <section id="modules" className="border-y border-[#E6DFEA] bg-white py-20 sm:py-24">
        <div className="mx-auto max-w-[1480px] px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#6C1DFF]">Explore the operating layer</p>
            <h2 className="mt-4 text-4xl font-black leading-[1] tracking-[-0.047em] text-[#17052D] sm:text-5xl">
              Click through every module in the same decision system.
            </h2>
            <p className="mt-5 text-base font-semibold leading-7 text-[#74687D]">
              Eight views into one imported team and one live gameweek state.
            </p>
          </div>

          <ModuleExplorer />
        </div>
      </section>

      <section className="relative overflow-hidden bg-[#100C18] py-20 text-white sm:py-24">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-32 top-[-80px] h-[420px] w-[420px] rounded-full bg-[#6C1DFF]/18 blur-[120px]" />
          <div className="absolute bottom-[-180px] right-[-60px] h-[420px] w-[420px] rounded-full bg-[#00A86B]/12 blur-[120px]" />
        </div>

        <div className="relative mx-auto max-w-[1480px] px-4 sm:px-6 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,.86fr)_minmax(560px,1.14fr)] lg:items-center">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#BFAAFF]">Why it feels different</p>
              <h2 className="mt-4 text-4xl font-black leading-[1] tracking-[-0.047em] text-white sm:text-5xl">
                The product does not end at “buy this player.”
              </h2>
              <p className="mt-5 max-w-xl text-base font-semibold leading-7 text-white/55">
                Every recommendation is placed inside the real squad, the deadline decision and the route after it.
              </p>

              <div className="mt-7 space-y-3">
                {[
                  "Current squad and recommended squad stay clearly separated.",
                  "Captaincy, transfers and planner inherit the same gameweek state.",
                  "Alternative decisions can be tested before the deadline.",
                  "The next gameweek inherits the consequences of this one.",
                ].map((item) => (
                  <div key={item} className="flex items-start gap-3 rounded-[16px] border border-white/9 bg-white/[0.05] p-4">
                    <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#8CFFD5] text-[#063D2A]">
                      <Icon name="check" className="h-3.5 w-3.5" />
                    </span>
                    <p className="text-sm font-semibold leading-6 text-white/72">{item}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[30px] border border-white/12 bg-white/[0.055] p-4 shadow-[0_28px_80px_rgba(0,0,0,0.24)] backdrop-blur sm:p-6">
              <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
                <div className="rounded-[20px] border border-white/10 bg-white/[0.06] p-5">
                  <p className="text-[9px] font-black uppercase tracking-[0.13em] text-white/42">Generic FPL output</p>
                  <p className="mt-3 text-2xl font-black text-white">“Buy Watkins”</p>
                  <div className="mt-5 space-y-2">
                    {["Single projection", "No squad route", "No consequence map"].map((item) => (
                      <p key={item} className="rounded-xl bg-black/16 px-3 py-2 text-xs font-bold text-white/45">{item}</p>
                    ))}
                  </div>
                </div>

                <span className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-[#6C1DFF] text-white shadow-[0_14px_34px_rgba(108,29,255,0.30)]">
                  <Icon name="arrow" />
                </span>

                <div className="rounded-[20px] border border-[#7D5CC7] bg-[linear-gradient(145deg,rgba(108,29,255,.22),rgba(0,168,107,.10))] p-5">
                  <p className="text-[9px] font-black uppercase tracking-[0.13em] text-[#CBB9FF]">Matchday OS</p>
                  <p className="mt-3 text-2xl font-black text-white">“Watkins now, because the route still wins by GW5.”</p>
                  <div className="mt-5 space-y-2">
                    {["Current XI context", "Alternative route", "Five-GW consequence map"].map((item) => (
                      <p key={item} className="rounded-xl bg-white/[0.08] px-3 py-2 text-xs font-black text-[#A7F3D0]">{item}</p>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="beta" className="relative overflow-hidden bg-[#6C1DFF] px-4 py-16 text-white sm:px-6 sm:py-20">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-20 -top-32 h-80 w-80 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -bottom-44 right-0 h-96 w-96 rounded-full bg-[#00D998]/20 blur-3xl" />
          <div className="absolute inset-0 opacity-[0.07] [background-image:linear-gradient(rgba(255,255,255,.15)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.15)_1px,transparent_1px)] [background-size:44px_44px]" />
        </div>

        <div className="relative mx-auto flex max-w-5xl flex-col items-center text-center">
          <span className="rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em]">
            Matchday OS Beta
          </span>
          <span className="mt-6 grid h-14 w-14 place-items-center rounded-[18px] bg-white text-[#6C1DFF] shadow-[0_18px_42px_rgba(28,6,68,0.22)]">
            <Icon name="spark" className="h-7 w-7" />
          </span>
          <h2 className="mt-7 text-4xl font-black leading-[1] tracking-[-0.047em] sm:text-5xl">
            Import the squad.
            <span className="block text-[#BAFFE8]">Explore the entire decision state.</span>
          </h2>
          <p className="mt-5 max-w-2xl text-base font-semibold leading-7 text-white/72">
            Current XI. This gameweek. The five after it. Beta users help test the model against real FPL squads and real deadline decisions.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/import" className="inline-flex min-h-13 items-center justify-center gap-2 rounded-[14px] bg-white px-7 py-3.5 text-sm font-black text-[#17052D] shadow-[0_18px_40px_rgba(30,7,71,0.22)] transition hover:-translate-y-0.5 hover:bg-[#F3EEFF]">
              Enter the beta with my team <Icon name="arrow" className="h-4 w-4" />
            </Link>
            <Link href="/dashboard" className="inline-flex min-h-13 items-center justify-center rounded-[14px] border border-white/22 bg-white/[0.08] px-7 py-3.5 text-sm font-black text-white transition hover:bg-white/[0.14]">
              Open Matchday OS
            </Link>
          </div>
        </div>
      </section>


      <style jsx global>{`
        @keyframes landingSwap {
          from {
            opacity: 0;
            transform: translateY(7px) scale(0.992);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        .landing-swap {
          animation: landingSwap 260ms cubic-bezier(0.22, 1, 0.36, 1) both;
        }

        @media (prefers-reduced-motion: reduce) {
          .landing-swap {
            animation: none;
          }
        }
      `}</style>

      <footer className="bg-[#090711] text-white">
        <div className="mx-auto flex max-w-[1480px] flex-col gap-6 px-4 py-8 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
          <div className="flex items-center gap-3">
            <Brand />
            <span className="rounded-full border border-white/12 bg-white/[0.06] px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.12em] text-white/50">
              Beta
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-bold text-white/42">
            <a href="#system" className="transition hover:text-white">The system</a>
            <a href="#modules" className="transition hover:text-white">Modules</a>
            <Link href="/trust" className="transition hover:text-white">Model trust</Link>
            <Link href="/import" className="transition hover:text-white">Import team</Link>
          </div>
          <p className="text-xs font-bold text-white/28">Beta decision support, not certainty.</p>
        </div>
      </footer>
    </main>
  );
}